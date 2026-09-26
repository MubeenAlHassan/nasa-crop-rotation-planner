"""Single opt-in SoilGrids probe and honest, independently verified archives."""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import math
import tempfile
import time
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
import pytest
from pydantic import JsonValue

JsonRequest = Callable[[str, Mapping[str, str], float], Mapping[str, JsonValue]]
SoilArchive = dict[str, JsonValue]
FARM_ID = "faisalabad_2025"
LOCATION = {"latitude": 31.4504, "longitude": 73.1350}
URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPERTIES = ("phh2o", "soc", "nitrogen", "sand", "silt", "clay")
DEPTHS = {"0-5cm": (0, 5), "5-15cm": (5, 15), "15-30cm": (15, 30)}
DIVISORS = {"phh2o": 10, "soc": 10, "nitrogen": 100, "sand": 10, "silt": 10, "clay": 10}
ARCHIVE_PATH = Path(__file__).resolve().parents[1] / "tests/fixtures/soilgrids_archive.json"
FIELDS = {
    "schema_version",
    "provider",
    "farm_id",
    "location",
    "acquisition",
    "retrieved_at",
    "product",
    "source_urls",
    "available",
    "unavailable_reason",
    "layers",
}
LAYER_FIELDS = {
    "property",
    "depth_top_cm",
    "depth_bottom_cm",
    "mean_raw",
    "q05_raw",
    "q95_raw",
    "conversion_factor",
}


def _number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _source_url(value: object) -> None:
    if not isinstance(value, str):
        raise ValueError("Source URL must be a string")
    parsed = urlparse(value)
    if (
        parsed.scheme != "https"
        or parsed.hostname
        not in {
            "rest.isric.org",
            "maps.isric.org",
            "files.isric.org",
        }
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Source URL must be an official HTTPS ISRIC URL")


def _atomic_write(output: Path, archive: SoilArchive) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent, delete=False
        ) as handle:
            temporary = Path(handle.name)
            json.dump(archive, handle, indent=2, allow_nan=False)
            handle.write("\n")
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _envelope(acquisition: str, source_urls: Sequence[str]) -> SoilArchive:
    return {
        "schema_version": "fixture-1",
        "provider": "soilgrids",
        "farm_id": FARM_ID,
        "location": dict(LOCATION),
        "acquisition": acquisition,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "product": "SoilGrids-2.0",
        "source_urls": list(source_urls),
        "available": False,
        "unavailable_reason": "Acquisition has not completed",
        "layers": [],
    }


def verify_soil_archive(archive: Mapping[str, JsonValue]) -> None:
    if set(archive) != FIELDS:
        raise ValueError("Invalid SoilGrids archive keys")
    if archive["schema_version"] != "fixture-1" or archive["provider"] != "soilgrids":
        raise ValueError("Invalid SoilGrids schema/provider")
    if archive["farm_id"] != FARM_ID or archive["location"] != LOCATION:
        raise ValueError("SoilGrids must use the pinned farm/location")
    location = archive["location"]
    if (
        not isinstance(location, dict)
        or set(location) != set(LOCATION)
        or not all(_number(value) for value in location.values())
    ):
        raise ValueError("Invalid coordinates")
    if archive["product"] != "SoilGrids-2.0" or archive["acquisition"] not in {"rest", "wcs"}:
        raise ValueError("Invalid product/acquisition")
    try:
        stamp = datetime.fromisoformat(archive["retrieved_at"].replace("Z", "+00:00"))
    except (ValueError, AttributeError, TypeError) as error:
        raise ValueError("Invalid retrieval timestamp") from error
    if stamp.utcoffset() != timedelta(0):
        raise ValueError("retrieved_at must be UTC")
    sources = archive["source_urls"]
    if (
        not isinstance(sources, list)
        or not sources
        or any(not isinstance(source, str) for source in sources)
        or len(sources) != len(set(sources))
    ):
        raise ValueError("Missing/duplicate source URLs")
    for source in sources:
        _source_url(source)
    if archive["acquisition"] == "rest" and sources != [URL]:
        raise ValueError("REST provenance must name the attempted REST endpoint")
    if archive["acquisition"] == "wcs" and any(
        urlparse(source).hostname not in {"maps.isric.org", "files.isric.org"} for source in sources
    ):
        raise ValueError("WCS provenance must identify source coverages/rasters")
    if type(archive["available"]) is not bool or not isinstance(archive["layers"], list):
        raise ValueError("Invalid availability/layers")
    if not archive["available"]:
        if (
            archive["layers"] != []
            or not isinstance(archive["unavailable_reason"], str)
            or not archive["unavailable_reason"].strip()
        ):
            raise ValueError("Unavailable SoilGrids requires empty layers and a reason")
        return
    if archive["unavailable_reason"] is not None:
        raise ValueError("Available archive must have null unavailable_reason")
    expected = {(prop, top, bottom) for prop in PROPERTIES for top, bottom in DEPTHS.values()}
    seen = set()
    for layer in archive["layers"]:
        if not isinstance(layer, dict) or set(layer) != LAYER_FIELDS:
            raise ValueError("Invalid layer fields")
        if type(layer["depth_top_cm"]) is not int or type(layer["depth_bottom_cm"]) is not int:
            raise ValueError("Depth boundaries must be integers")
        key = (layer["property"], layer["depth_top_cm"], layer["depth_bottom_cm"])
        if key not in expected or key in seen:
            raise ValueError("Unknown/duplicate property-depth pair")
        seen.add(key)
        if (
            not _number(layer["conversion_factor"])
            or layer["conversion_factor"] != DIVISORS[layer["property"]]
        ):
            raise ValueError("Unverified conversion divisor")
        for stat in ("mean_raw", "q05_raw", "q95_raw"):
            value = layer[stat]
            if value is not None and (not _number(value) or value < 0):
                raise ValueError("Soil values must be finite, nonnegative numbers or null")
        if (
            layer["q05_raw"] is not None
            and layer["q95_raw"] is not None
            and layer["q05_raw"] > layer["q95_raw"]
        ):
            raise ValueError("q05_raw exceeds q95_raw")
    if seen != expected:
        raise ValueError("Available archive requires all 18 property-depth pairs")
    if all(layer["mean_raw"] is None for layer in archive["layers"]):
        raise ValueError("Available SoilGrids needs at least one nonmissing mean")
    if all(
        layer[stat] in (0, None)
        for layer in archive["layers"]
        for stat in ("mean_raw", "q05_raw", "q95_raw")
    ):
        raise ValueError("An all-zero fabricated soil profile is not usable data")


async def _probe_soil_json(
    url: str, params: Mapping[str, str], timeout: float
) -> Mapping[str, JsonValue]:
    """One probe, no retry: expand logical lists to repeated wire parameters."""
    if url != URL:
        raise ValueError("SoilGrids URL is not allowlisted")
    if not _number(timeout) or not 0 < timeout <= 8:
        raise ValueError("Invalid timeout")
    pairs = []
    for key, value in params.items():
        pairs.extend((key, part) for part in value.split(",")) if key in {
            "property",
            "depth",
            "value",
        } else pairs.append((key, value))
    deadline = time.monotonic() + timeout
    async with httpx.AsyncClient() as client:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("SoilGrids probe deadline exhausted")
        limits = httpx.Timeout(
            min(4, remaining),
            connect=min(2, remaining),
            write=min(2, remaining),
            pool=min(1, remaining),
        )
        async with client.stream("GET", url, params=pairs, timeout=limits) as response:
            response.raise_for_status()
            chunks = []
            async for chunk in response.aiter_bytes():
                if time.monotonic() >= deadline:
                    raise TimeoutError("SoilGrids probe deadline exhausted")
                chunks.append(chunk)
            if time.monotonic() >= deadline:
                raise TimeoutError("SoilGrids probe deadline exhausted")
            body = json.loads(b"".join(chunks))
    if not isinstance(body, dict):
        raise ValueError("REST payload must be an object")
    return body


def default_request_adapter(
    url: str, params: Mapping[str, str], timeout: float
) -> Mapping[str, JsonValue]:
    """One opt-in request with a cancellable deadline across all read chunks."""
    if not _number(timeout) or not 0 < timeout <= 8:
        raise ValueError("Invalid timeout")

    async def bounded() -> Mapping[str, JsonValue]:
        try:
            async with asyncio.timeout(timeout):
                return await _probe_soil_json(url, params, timeout)
        except TimeoutError as error:
            raise TimeoutError("SoilGrids probe exceeded its wall-clock deadline") from error

    return asyncio.run(bounded())


def capture_soil_archive(
    *,
    farm_id: str,
    latitude: float,
    longitude: float,
    request_json: JsonRequest,
    output: Path,
) -> SoilArchive:
    if (
        farm_id != FARM_ID
        or not _number(latitude)
        or not _number(longitude)
        or {"latitude": latitude, "longitude": longitude} != LOCATION
    ):
        raise ValueError("Capture must use the pinned farm/location")
    params = {
        "lat": str(latitude),
        "lon": str(longitude),
        "property": ",".join(PROPERTIES),
        "depth": ",".join(DEPTHS),
        "value": "mean,Q0.05,Q0.95",
    }
    archive = _envelope("rest", [URL])
    try:
        payload = request_json(URL, params, 8.0)
        if not isinstance(payload, dict):
            raise ValueError("REST payload must be an object")
        properties = payload.get("properties", {})
        layers = properties.get("layers") if isinstance(properties, dict) else None
        if not isinstance(layers, list):
            raise ValueError("Missing REST properties.layers")
        by_name = {}
        for layer in layers:
            if (
                not isinstance(layer, dict)
                or not isinstance(layer.get("name"), str)
                or layer["name"] in by_name
            ):
                raise ValueError("Invalid/duplicate REST property")
            by_name[layer.get("name")] = layer
        result = []
        for prop in PROPERTIES:
            layer = by_name.get(prop)
            if not isinstance(layer, dict):
                raise ValueError(f"Missing property {prop}")
            measure = layer.get("unit_measure", {})
            if (
                not isinstance(measure, dict)
                or not _number(measure.get("d_factor"))
                or measure["d_factor"] != DIVISORS[prop]
            ):
                raise ValueError(f"Unverified source unit divisor for {prop}")
            nodata = layer.get("nodata_value")
            depths = layer.get("depths")
            if not isinstance(depths, list):
                raise ValueError("Missing depths")
            by_depth = {}
            for depth in depths:
                if (
                    not isinstance(depth, dict)
                    or not isinstance(depth.get("label"), str)
                    or depth["label"] in by_depth
                ):
                    raise ValueError("Invalid/duplicate REST depth")
                by_depth[depth.get("label")] = depth
            for label, (top, bottom) in DEPTHS.items():
                depth = by_depth.get(label)
                values = depth.get("values") if isinstance(depth, dict) else None
                if not isinstance(values, dict) or not {"mean", "Q0.05", "Q0.95"} <= values.keys():
                    raise ValueError(f"Missing statistics for {prop}/{label}")
                record = {
                    "property": prop,
                    "depth_top_cm": top,
                    "depth_bottom_cm": bottom,
                    "conversion_factor": DIVISORS[prop],
                }
                for target, origin in (
                    ("mean_raw", "mean"),
                    ("q05_raw", "Q0.05"),
                    ("q95_raw", "Q0.95"),
                ):
                    record[target] = None if values[origin] == nodata else values[origin]
                result.append(record)
        archive.update(available=True, unavailable_reason=None, layers=result)
        verify_soil_archive(archive)
    except (httpx.RequestError, httpx.HTTPStatusError, TimeoutError, ValueError) as error:
        archive.update(
            available=False,
            layers=[],
            unavailable_reason=f"{type(error).__name__}: {error}",
        )
    archive["retrieved_at"] = datetime.now(timezone.utc).isoformat()
    verify_soil_archive(archive)
    _atomic_write(output, archive)
    return archive


def _mock_payload():
    return {
        "properties": {
            "layers": [
                {
                    "name": prop,
                    "unit_measure": {"d_factor": DIVISORS[prop]},
                    "nodata_value": -32768,
                    "depths": [
                        {"label": label, "values": {"mean": 50, "Q0.05": 40, "Q0.95": 60}}
                        for label in reversed(DEPTHS)
                    ],
                }
                for prop in reversed(PROPERTIES)
            ]
        }
    }


def test_validate_committed_archive():
    verify_soil_archive(json.loads(ARCHIVE_PATH.read_text()))


def test_available_and_unavailable(tmp_path):
    archive = capture_soil_archive(
        farm_id=FARM_ID,
        **LOCATION,
        request_json=lambda *args: _mock_payload(),
        output=tmp_path / "available.json",
    )
    assert archive["available"] and len(archive["layers"]) == 18

    def fail(*args):
        raise TimeoutError("probe timed out")

    unavailable = capture_soil_archive(
        farm_id=FARM_ID,
        **LOCATION,
        request_json=fail,
        output=tmp_path / "unavailable.json",
    )
    assert unavailable["available"] is False and unavailable["layers"] == []
    assert unavailable["source_urls"] == [URL]


def test_nodata_and_raw_units(tmp_path):
    payload = _mock_payload()
    payload["properties"]["layers"][0]["depths"][0]["values"]["mean"] = -32768
    archive = capture_soil_archive(
        farm_id=FARM_ID,
        **LOCATION,
        request_json=lambda *args: payload,
        output=tmp_path / "soil.json",
    )
    assert archive["available"]
    assert any(layer["mean_raw"] is None for layer in archive["layers"])
    assert (
        next(layer for layer in archive["layers"] if layer["property"] == "nitrogen")[
            "conversion_factor"
        ]
        == 100
    )
    assert "mean" not in archive["layers"][0]


@pytest.mark.parametrize(
    "mutation",
    [
        lambda a: a.update(available=True),
        lambda a: a.update(farm_id="other"),
        lambda a: a.update(acquisition="REST"),
        lambda a: a.update(unavailable_reason=""),
        lambda a: a.update(source_urls=["https://example.org/soil"]),
        lambda a: a.update(retrieved_at="2025-01-01T00:00:00"),
    ],
)
def test_reject_unavailable_mutations(mutation):
    archive = _envelope("rest", [URL])
    mutation(archive)
    with pytest.raises(ValueError):
        verify_soil_archive(archive)


@pytest.mark.parametrize("kind", ["duplicate", "missing", "factor", "quantiles", "nan"])
def test_reject_invalid_layer_payload(tmp_path, kind):
    payload = _mock_payload()
    layers = payload["properties"]["layers"]
    if kind == "duplicate":
        layers.append(copy.deepcopy(layers[0]))
    elif kind == "missing":
        layers.pop()
    elif kind == "factor":
        layers[0]["unit_measure"]["d_factor"] = 1
    elif kind == "quantiles":
        layers[0]["depths"][0]["values"]["Q0.05"] = 80
    else:
        layers[0]["depths"][0]["values"]["mean"] = float("nan")
    archive = capture_soil_archive(
        farm_id=FARM_ID,
        **LOCATION,
        request_json=lambda *args: payload,
        output=tmp_path / "soil.json",
    )
    assert not archive["available"] and archive["layers"] == []


def test_repeated_query_parameters(monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.params.get_list("property") == list(PROPERTIES)
        assert request.url.params.get_list("depth") == list(DEPTHS)
        assert request.url.params.get_list("value") == ["mean", "Q0.05", "Q0.95"]
        return httpx.Response(503)

    client_type = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: client_type(transport=httpx.MockTransport(handler), **kwargs),
    )
    with pytest.raises(httpx.HTTPStatusError):
        default_request_adapter(
            URL,
            {
                "property": ",".join(PROPERTIES),
                "depth": ",".join(DEPTHS),
                "value": "mean,Q0.05,Q0.95",
            },
            8.0,
        )
    assert len(calls) == 1


def test_slow_stream_cannot_extend_probe_deadline(monkeypatch):
    delivered = []

    class SlowStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            await asyncio.sleep(1)
            delivered.append(True)
            yield b'{"properties": {}}'

    client_type = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda: client_type(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, stream=SlowStream()))
        ),
    )
    with pytest.raises(TimeoutError):
        default_request_adapter(URL, {}, 0.03)
    assert delivered == []


def test_fabricated_zero_layers_are_rejected(tmp_path):
    payload = _mock_payload()
    for layer in payload["properties"]["layers"]:
        for depth in layer["depths"]:
            depth["values"] = {"mean": 0, "Q0.05": 0, "Q0.95": 0}
    archive = capture_soil_archive(
        farm_id=FARM_ID,
        **LOCATION,
        request_json=lambda *args: payload,
        output=tmp_path / "soil.json",
    )
    assert archive["available"] is False and archive["layers"] == []


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true")
    parser.add_argument("--output", type=Path, default=ARCHIVE_PATH)
    args = parser.parse_args()
    if not args.capture:
        parser.error("--capture is required for the single live REST probe")
    capture_soil_archive(
        farm_id=FARM_ID,
        **LOCATION,
        request_json=default_request_adapter,
        output=args.output,
    )


if __name__ == "__main__":
    main()
