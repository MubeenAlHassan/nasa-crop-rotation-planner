"""Capture genuine POWER responses; all pytest checks run offline."""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import math
import random
import tempfile
import time
from collections.abc import Callable, Mapping
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import httpx
import pytest
from pydantic import JsonValue

JsonRequest = Callable[[str, Mapping[str, str], float], Mapping[str, JsonValue]]
PowerArchive = dict[str, JsonValue]
URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
FARM_ID = "faisalabad_2025"
LOCATION = {"latitude": 31.4504, "longitude": 73.1350}
OBSERVATION_START = date(2025, 7, 18)
OBSERVATION_END = date(2025, 10, 15)
PERIODS = [(OBSERVATION_START, OBSERVATION_END)] + [
    (date(year, 1, 1), date(year, 12, 31)) for year in range(1991, 2021)
]
ARCHIVE_PATH = Path(__file__).resolve().parents[1] / "tests/fixtures/power_archive.json"


class PowerCaptureError(Exception):
    """Required POWER acquisition failed."""


class RateLimitError(PowerCaptureError):
    """The provider's retry delay cannot fit the capture deadline."""


def _number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _utc(value: object) -> None:
    if not isinstance(value, str):
        raise ValueError("retrieved_at must be a UTC timestamp")
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Invalid retrieved_at") from error
    if timestamp.utcoffset() != timedelta(0):
        raise ValueError("retrieved_at must be timezone-aware UTC")


def _finite_json(value: object) -> None:
    if isinstance(value, dict):
        for item in value.values():
            _finite_json(item)
    elif isinstance(value, list):
        for item in value:
            _finite_json(item)
    elif isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Nonfinite JSON number")


def _atomic_write(output: Path, archive: Mapping[str, JsonValue]) -> None:
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


def _retry_delay(value: str | None) -> float:
    if value is None:
        return random.uniform(0.05, 0.15)
    try:
        delay = float(value)
    except ValueError:
        try:
            timestamp = parsedate_to_datetime(value)
            delay = (timestamp - datetime.now(timezone.utc)).total_seconds()
        except (ValueError, TypeError, OverflowError) as error:
            raise PowerCaptureError("Invalid Retry-After") from error
    if not math.isfinite(delay):
        raise PowerCaptureError("Invalid Retry-After")
    return max(0.0, delay)


async def _fetch_power_json(
    url: str, params: Mapping[str, str], timeout: float
) -> Mapping[str, JsonValue]:
    """At most two GET attempts, with one monotonic deadline."""
    if url != URL:
        raise PowerCaptureError("POWER URL is not allowlisted")
    if not _number(timeout) or not 0 < timeout <= 8:
        raise PowerCaptureError("Capture timeout must be in (0, 8]")
    deadline = time.monotonic() + timeout
    async with httpx.AsyncClient() as client:
        for attempt in range(2):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise PowerCaptureError("Capture deadline exhausted")
            limits = httpx.Timeout(
                min(4.0, remaining),
                connect=min(2.0, remaining),
                write=min(2.0, remaining),
                pool=min(1.0, remaining),
            )
            delay = 0.0
            rate_limited = False
            try:
                async with client.stream("GET", url, params=params, timeout=limits) as response:
                    if response.status_code == 200:
                        chunks = []
                        async for chunk in response.aiter_bytes():
                            if time.monotonic() >= deadline:
                                raise PowerCaptureError("Capture deadline exhausted")
                            chunks.append(chunk)
                        if time.monotonic() >= deadline:
                            raise PowerCaptureError("Capture deadline exhausted")
                        try:
                            data = json.loads(b"".join(chunks))
                        except (ValueError, UnicodeDecodeError) as error:
                            raise PowerCaptureError("Invalid JSON response") from error
                        if not isinstance(data, dict):
                            raise PowerCaptureError("Payload must be a JSON object")
                        _finite_json(data)
                        return data
                    if response.status_code != 429 and not 500 <= response.status_code < 600:
                        raise PowerCaptureError(f"HTTP {response.status_code}")
                    rate_limited = response.status_code == 429
                    delay = _retry_delay(response.headers.get("Retry-After"))
                    failure = f"HTTP {response.status_code}"
            except (httpx.ConnectError, httpx.TimeoutException) as error:
                delay = _retry_delay(None)
                failure = type(error).__name__
            remaining = deadline - time.monotonic()
            if attempt == 1 or delay >= remaining:
                error_type = RateLimitError if rate_limited else PowerCaptureError
                raise error_type(failure)
            await asyncio.sleep(delay)
    raise PowerCaptureError("Capture deadline exhausted")


def default_request_adapter(
    url: str, params: Mapping[str, str], timeout: float
) -> Mapping[str, JsonValue]:
    """Synchronous preprocessing interface; one cancellable wall-clock budget."""
    if not _number(timeout) or not 0 < timeout <= 8:
        raise PowerCaptureError("Capture timeout must be in (0, 8]")

    async def bounded() -> Mapping[str, JsonValue]:
        try:
            async with asyncio.timeout(timeout):
                return await _fetch_power_json(url, params, timeout)
        except TimeoutError as error:
            raise PowerCaptureError("Capture deadline exhausted") from error

    return asyncio.run(bounded())


def verify_power_archive(archive: Mapping[str, JsonValue]) -> None:
    """Validate the complete pinned acquisition, including query provenance."""
    if set(archive) != {"schema_version", "provider", "farm_id", "location", "requests"}:
        raise ValueError("Invalid POWER archive keys")
    if archive["schema_version"] != "fixture-1" or archive["provider"] != "power":
        raise ValueError("Invalid POWER schema/provider")
    if archive["farm_id"] != FARM_ID or archive["location"] != LOCATION:
        raise ValueError("POWER farm/location must match the pinned scenario")
    location = archive["location"]
    if not isinstance(location, dict) or set(location) != set(LOCATION):
        raise ValueError("Invalid location")
    if not all(_number(value) for value in location.values()):
        raise ValueError("Invalid coordinate numbers")
    requests = archive["requests"]
    if not isinstance(requests, list) or len(requests) != 31:
        raise ValueError("Exactly 31 POWER requests are required")
    expected_periods = {(start.isoformat(), end.isoformat()) for start, end in PERIODS}
    seen_periods = set()
    for request in requests:
        fields = {
            "start_date",
            "end_date",
            "retrieved_at",
            "url",
            "params",
            "status_code",
            "payload",
        }
        if not isinstance(request, dict) or set(request) != fields:
            raise ValueError("Invalid POWER request keys")
        if not all(isinstance(request[key], str) for key in ("start_date", "end_date")):
            raise ValueError("POWER period boundaries must be ISO dates")
        period = (request["start_date"], request["end_date"])
        if period not in expected_periods or period in seen_periods:
            raise ValueError("Invalid/duplicate POWER period")
        seen_periods.add(period)
        start, end = map(date.fromisoformat, period)
        _utc(request["retrieved_at"])
        if (
            request["url"] != URL
            or type(request["status_code"]) is not int
            or request["status_code"] != 200
        ):
            raise ValueError("Invalid POWER request URL/status")
        pairs = request["params"]
        if not isinstance(pairs, list) or any(
            not isinstance(pair, list)
            or len(pair) != 2
            or any(not isinstance(value, str) for value in pair)
            for pair in pairs
        ):
            raise ValueError("params must be string pairs")
        params = dict(pairs)
        expected_params = {
            "parameters": "PRECTOTCORR,T2M",
            "community": "AG",
            "format": "JSON",
            "time-standard": "UTC",
            "latitude": str(LOCATION["latitude"]),
            "longitude": str(LOCATION["longitude"]),
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
        }
        if len(params) != len(pairs) or params != expected_params:
            raise ValueError("POWER query does not match the pinned period/location/UTC")
        payload = request["payload"]
        if not isinstance(payload, dict):
            raise ValueError("Payload must be a JSON object")
        _finite_json(payload)
        header = payload.get("header", {})
        if not isinstance(header, dict) or not _number(header.get("fill_value")):
            raise ValueError("Missing/invalid fill_value")
        if header.get("time_standard") != "UTC":
            raise ValueError("POWER time standard must be UTC")
        if str(header.get("start")) != start.strftime("%Y%m%d") or str(
            header.get("end")
        ) != end.strftime("%Y%m%d"):
            raise ValueError("POWER header dates disagree with query")
        geometry = payload.get("geometry", {})
        coords = geometry.get("coordinates", []) if isinstance(geometry, dict) else []
        # POWER emits three-decimal geometry; the request/cache pin stays exact.
        requested_point = [LOCATION["longitude"], LOCATION["latitude"]]
        if (
            not isinstance(geometry, dict)
            or geometry.get("type") != "Point"
            or not isinstance(coords, list)
            or len(coords) < 2
            or coords[:2] not in (requested_point, [round(value, 3) for value in requested_point])
        ):
            raise ValueError("POWER payload geometry does not match the requested point")
        units = payload.get("parameters", {})
        if (
            not isinstance(units, dict)
            or not isinstance(units.get("PRECTOTCORR"), dict)
            or units["PRECTOTCORR"].get("units") != "mm/day"
        ):
            raise ValueError("Invalid rainfall units")
        if not isinstance(units.get("T2M"), dict) or units["T2M"].get("units") != "C":
            raise ValueError("Invalid temperature units")
        properties = payload.get("properties", {})
        parameter_data = properties.get("parameter", {}) if isinstance(properties, dict) else {}
        if not isinstance(parameter_data, dict):
            raise ValueError("Missing POWER parameter object")
        expected_days = {
            (start + timedelta(days=offset)).strftime("%Y%m%d")
            for offset in range((end - start).days + 1)
        }
        for parameter in ("PRECTOTCORR", "T2M"):
            data = parameter_data.get(parameter)
            if not isinstance(data, dict) or set(data) != expected_days:
                raise ValueError(f"Absent or impossible date keys in {parameter}")
            for value in data.values():
                if not _number(value):
                    raise ValueError("Observation must be a finite number, not bool/string")
                if parameter == "PRECTOTCORR" and value < 0 and value != header["fill_value"]:
                    raise ValueError("Negative rainfall is not a declared fill value")
            if all(value == header["fill_value"] for value in data.values()):
                raise ValueError(f"No usable observations in {parameter}")
    if seen_periods != expected_periods:
        raise ValueError("Incomplete POWER periods")


def capture_power_archive(
    *,
    farm_id: str,
    latitude: float,
    longitude: float,
    observation_start: date,
    observation_end: date,
    baseline_start_year: int,
    baseline_end_year: int,
    request_json: JsonRequest,
    output: Path,
) -> PowerArchive:
    if (
        farm_id != FARM_ID
        or not _number(latitude)
        or not _number(longitude)
        or {"latitude": latitude, "longitude": longitude} != LOCATION
        or (observation_start, observation_end) != (OBSERVATION_START, OBSERVATION_END)
        or (baseline_start_year, baseline_end_year) != (1991, 2020)
    ):
        raise ValueError("Capture must use the pinned Faisalabad scenario")
    records = []
    for start, end in PERIODS:
        params = {
            "parameters": "PRECTOTCORR,T2M",
            "community": "AG",
            "format": "JSON",
            "time-standard": "UTC",
            "latitude": str(latitude),
            "longitude": str(longitude),
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
        }
        payload = dict(request_json(URL, params, 8.0))
        records.append(
            {
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "url": URL,
                "params": [list(pair) for pair in params.items()],
                "status_code": 200,
                "payload": payload,
            }
        )
    archive = {
        "schema_version": "fixture-1",
        "provider": "power",
        "farm_id": farm_id,
        "location": {"latitude": latitude, "longitude": longitude},
        "requests": records,
    }
    verify_power_archive(archive)
    _atomic_write(output, archive)
    return archive


@pytest.fixture
def archive() -> PowerArchive:
    return json.loads(ARCHIVE_PATH.read_text())


def test_validate_committed_archive(archive):
    verify_power_archive(archive)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda data: data.update(requests=[]),
        lambda data: data.update(farm_id="other"),
        lambda data: data.update(location={"latitude": 39.5, "longitude": -98.5}),
        lambda data: data.update(unexpected=True),
        lambda data: data["requests"][0].update(start_date="2023-01-01"),
        lambda data: data["requests"].__setitem__(1, copy.deepcopy(data["requests"][0])),
        lambda data: data["requests"][0].update(retrieved_at="2025-10-15T00:00:00"),
        lambda data: data["requests"][0]["payload"]["header"].update(time_standard="LST"),
    ],
)
def test_reject_archive_mutations(archive, mutation):
    mutation(archive)
    with pytest.raises(ValueError):
        verify_power_archive(archive)


def test_leap_years_and_raw_fill_values(archive):
    leap = next(row for row in archive["requests"] if row["start_date"] == "1992-01-01")
    assert "19920229" in leap["payload"]["properties"]["parameter"]["PRECTOTCORR"]
    row = archive["requests"][0]
    values = row["payload"]["properties"]["parameter"]
    values["PRECTOTCORR"]["20250718"] = row["payload"]["header"]["fill_value"]
    values["T2M"]["20250718"] = -2.0
    verify_power_archive(archive)
    assert values["PRECTOTCORR"]["20250718"] == row["payload"]["header"]["fill_value"]


@pytest.mark.parametrize("bad", [True, "1.2", float("nan"), float("inf"), -5.0])
def test_reject_invalid_rainfall(archive, bad):
    archive["requests"][0]["payload"]["properties"]["parameter"]["PRECTOTCORR"]["20250718"] = bad
    with pytest.raises(ValueError):
        verify_power_archive(archive)


@pytest.mark.parametrize(
    "key,value",
    [
        ("geometry", None),
        ("geometry", {"type": "Point", "coordinates": None}),
        ("parameters", None),
        ("parameters", {"PRECTOTCORR": []}),
        ("properties", {"parameter": None}),
        (
            "header",
            {"fill_value": -999, "time_standard": "UTC", "start": "20230101", "end": "20230131"},
        ),
    ],
)
def test_reject_malformed_payload_objects(archive, key, value):
    archive["requests"][0]["payload"][key] = value
    with pytest.raises(ValueError):
        verify_power_archive(archive)


def test_preservation_of_existing_file(tmp_path):
    output = tmp_path / "out.json"
    output.write_text('{"existing": true}')

    def failure(url, params, timeout):
        raise PowerCaptureError("timeout")

    with pytest.raises(PowerCaptureError):
        capture_power_archive(
            farm_id=FARM_ID,
            **LOCATION,
            observation_start=OBSERVATION_START,
            observation_end=OBSERVATION_END,
            baseline_start_year=1991,
            baseline_end_year=2020,
            request_json=failure,
            output=output,
        )
    assert output.read_text() == '{"existing": true}'


def test_capture_preserves_raw_payloads(tmp_path, archive):
    records = iter(archive["requests"])
    result = capture_power_archive(
        farm_id=FARM_ID,
        **LOCATION,
        observation_start=OBSERVATION_START,
        observation_end=OBSERVATION_END,
        baseline_start_year=1991,
        baseline_end_year=2020,
        request_json=lambda url, params, timeout: next(records)["payload"],
        output=tmp_path / "capture.json",
    )
    assert [row["payload"] for row in result["requests"]] == [
        row["payload"] for row in archive["requests"]
    ]


def _mock_client(monkeypatch, handler):
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(httpx, "AsyncClient", lambda: client_type(transport=transport))


def test_rate_limiting_retry(monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"verified": True})

    _mock_client(monkeypatch, handler)
    assert default_request_adapter(URL, {}, 8.0) == {"verified": True}
    assert len(calls) == 2


def test_timeout_exhaustion(monkeypatch):
    _mock_client(monkeypatch, lambda request: httpx.Response(429, headers={"Retry-After": "20"}))
    with pytest.raises(RateLimitError):
        default_request_adapter(URL, {}, 8.0)


@pytest.mark.parametrize("status", [400, 401, 403, 404])
def test_no_retry_other_4xx(monkeypatch, status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status)

    _mock_client(monkeypatch, handler)
    with pytest.raises(PowerCaptureError):
        default_request_adapter(URL, {}, 8.0)
    assert len(calls) == 1


def test_retries_bounded_and_timeout_clamped(monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        assert all(limit <= 0.1 for limit in request.extensions["timeout"].values())
        raise httpx.ReadTimeout("read timeout", request=request)

    _mock_client(monkeypatch, handler)
    monkeypatch.setattr(time, "sleep", lambda delay: None)
    monkeypatch.setattr(random, "uniform", lambda start, end: 0.01)
    with pytest.raises(PowerCaptureError):
        default_request_adapter(URL, {}, 0.1)
    assert len(calls) == 2


def test_slow_stream_cannot_extend_deadline(monkeypatch):
    delivered = []

    class SlowStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            await asyncio.sleep(1)
            delivered.append(True)
            yield b'{"too_late": true}'

    _mock_client(monkeypatch, lambda request: httpx.Response(200, stream=SlowStream()))
    with pytest.raises(PowerCaptureError, match="deadline"):
        default_request_adapter(URL, {}, 0.03)
    assert delivered == []


@pytest.mark.parametrize("status", [500, 502, 503, 504])
def test_server_errors_get_only_two_attempts(monkeypatch, status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, headers={"Retry-After": "0"})

    _mock_client(monkeypatch, handler)
    with pytest.raises(PowerCaptureError):
        default_request_adapter(URL, {}, 8.0)
    assert len(calls) == 2


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="Opt in to live NASA acquisition")
    parser.add_argument("--output", type=Path, default=ARCHIVE_PATH)
    args = parser.parse_args()
    if not args.capture:
        parser.error("--capture is required; ordinary pytest is offline")
    capture_power_archive(
        farm_id=FARM_ID,
        **LOCATION,
        observation_start=OBSERVATION_START,
        observation_end=OBSERVATION_END,
        baseline_start_year=1991,
        baseline_end_year=2020,
        request_json=default_request_adapter,
        output=args.output,
    )


if __name__ == "__main__":
    main()
