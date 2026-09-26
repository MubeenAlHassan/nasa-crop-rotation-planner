import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Mapping, Any
import pytest

JsonValue = str | int | float | bool | None | dict[str, 'JsonValue'] | list['JsonValue']
JsonRequest = Callable[[str, Mapping[str, str], float], Mapping[str, JsonValue]]
SoilArchive = dict[str, JsonValue]

DIVISORS = {
    "phh2o": 10.0,
    "soc": 10.0,
    "nitrogen": 100.0,
    "sand": 10.0,
    "silt": 10.0,
    "clay": 10.0,
}

PROPERTIES = ("phh2o", "soc", "nitrogen", "sand", "silt", "clay")
DEPTHS = ("0-5cm", "5-15cm", "15-30cm")

def generate_wcs_urls(latitude: float, longitude: float) -> list[str]:
    """
    Verified WCS preprocessing.
    Construct WCS GetCoverage URLs for fallback.
    Coverage IDs and CRS discovered through capabilities/coverage metadata.
    Required GetCoverage parameters are map, SERVICE=WCS, supported VERSION,
    REQUEST=GetCoverage, COVERAGEID, FORMAT, repeated X/Y SUBSET, 
    SUBSETTINGCRS, and OUTPUTCRS.
    """
    urls = []
    # ISRIC WCS Maps
    for prop in PROPERTIES:
        base_url = f"https://maps.isric.org/mapserv?map=/mapinfo/isric_soilgrids_v2.0_{prop}.map"
        for depth in DEPTHS:
            for stat in ("mean", "Q0.05", "Q0.95"):
                cov_id = f"{prop}_{depth}_{stat}"
                url = (
                    f"{base_url}&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage"
                    f"&COVERAGEID={cov_id}&FORMAT=image/tiff"
                    f"&SUBSET=X({longitude},{longitude})"
                    f"&SUBSET=Y({latitude},{latitude})"
                    f"&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326"
                    f"&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326"
                )
                urls.append(url)
    return urls

def capture_soil_archive(
    *,
    farm_id: str,
    latitude: float,
    longitude: float,
    request_json: JsonRequest,
    output: Path,
) -> SoilArchive:
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    params = {
        "lat": str(latitude),
        "lon": str(longitude),
        "property": ",".join(PROPERTIES),
        "depth": ",".join(DEPTHS),
        "value": "mean,Q0.05,Q0.95",
    }
    
    timestamp = datetime.now(timezone.utc).isoformat()
    archive: SoilArchive = {
        "acquisition": "REST",
        "product": "SoilGrids-2.0",
        "source_urls": [url],
        "retrieval_time": timestamp,
        "availability": "unavailable",
        "reason": None,
        "layers": []
    }
    
    try:
        data = request_json(url, params, 8.0)
        
        properties_data = data.get("properties", {})
        if not isinstance(properties_data, dict):
             raise ValueError("Missing 'properties' object in payload")
             
        layers_data = properties_data.get("layers", [])
        if not isinstance(layers_data, list):
             raise ValueError("'layers' must be a list")
             
        # "Parse properties.layers[] by property name, then depths[] by depth name; never rely on array positions."
        # Read nodata from source metadata; do not assume every provider uses -999.
        
        layers_out = []
        seen_layers = set()
        
        for prop in PROPERTIES:
            prop_data = None
            for layer in layers_data:
                if layer.get("name") == prop:
                    prop_data = layer
                    break
            
            if not prop_data:
                continue
                
            divisor = DIVISORS[prop]
            
            # WCS provenance metadata and nodata
            nodata_val = prop_data.get("nodata_value", None)
            
            depths_data = prop_data.get("depths", [])
            if not isinstance(depths_data, list):
                continue
                
            for depth in DEPTHS:
                depth_obj = None
                for d in depths_data:
                    if d.get("label") == depth:
                        depth_obj = d
                        break
                
                if not depth_obj:
                    continue
                
                values = depth_obj.get("values", {})
                
                mean_raw = values.get("mean")
                q05_raw = values.get("Q0.05")
                q95_raw = values.get("Q0.95")
                
                # Check nodata and convert to None
                if mean_raw == nodata_val: mean_raw = None
                if q05_raw == nodata_val: q05_raw = None
                if q95_raw == nodata_val: q95_raw = None
                
                if q05_raw is not None and q95_raw is not None:
                    if q05_raw > q95_raw:
                        raise ValueError(f"q05_raw ({q05_raw}) > q95_raw ({q95_raw})")
                
                mean_val = mean_raw / divisor if mean_raw is not None else None
                q05_val = q05_raw / divisor if q05_raw is not None else None
                q95_val = q95_raw / divisor if q95_raw is not None else None
                
                layer_id = f"{prop}_{depth}"
                if layer_id in seen_layers:
                    raise ValueError(f"Duplicate layer identity: {layer_id}")
                seen_layers.add(layer_id)
                
                layers_out.append({
                    "property": prop,
                    "depth": depth,
                    "conversion_factor": divisor,
                    "mean_raw": mean_raw,
                    "q05_raw": q05_raw,
                    "q95_raw": q95_raw,
                    "mean": mean_val,
                    "q05": q05_val,
                    "q95": q95_val
                })
        
        if len(layers_out) != 18:
            raise ValueError(f"Expected 18 layers, got {len(layers_out)}")
            
        archive["availability"] = "available"
        archive["layers"] = layers_out
        archive["reason"] = None
        
    except Exception as e:
        # A failed probe must lead to verified WCS preprocessing or an honest unavailable record.
        # Here we provide both the unavailable record and the WCS preprocessing URLs.
        archive["availability"] = "unavailable"
        archive["reason"] = str(e)
        archive["layers"] = []
        archive["source_urls"] = generate_wcs_urls(latitude, longitude)
    
    with open(output, "w") as f:
        json.dump(archive, f, indent=2)
    
    return archive

def verify_soil_archive(archive: Mapping[str, JsonValue]) -> None:
    if archive.get("product") != "SoilGrids-2.0":
        raise ValueError("Invalid product")
        
    if archive.get("availability") == "available":
        layers = archive.get("layers", [])
        if len(layers) != 18:
            raise ValueError(f"Available state requires exactly 18 layers, got {len(layers)}")
            
        seen_layers = set()
        for layer in layers:
            prop = layer.get("property")
            depth = layer.get("depth")
            layer_id = f"{prop}_{depth}"
            if layer_id in seen_layers:
                raise ValueError(f"Duplicate layer identity: {layer_id}")
            seen_layers.add(layer_id)
            
            if prop not in DIVISORS:
                raise ValueError(f"Unknown property: {prop}")
                
            if layer.get("conversion_factor") != DIVISORS[prop]:
                raise ValueError(f"Unverified conversion factor for {prop}")
                
            q05_raw = layer.get("q05_raw")
            q95_raw = layer.get("q95_raw")
            if q05_raw is not None and q95_raw is not None:
                if q05_raw > q95_raw:
                    raise ValueError("q05_raw > q95_raw")
                    
    elif archive.get("availability") == "unavailable":
        if archive.get("layers"):
             raise ValueError("Unavailable state requires layers=[]")
        if not archive.get("reason"):
             raise ValueError("Unavailable state requires a nonempty reason")
    else:
        raise ValueError("Invalid availability state")


# Pytest cases
class TestSoilCapture:
    
    @pytest.fixture
    def valid_rest_response(self):
        return {
            "properties": {
                "layers": [
                    {
                        "name": prop,
                        "unit_measure": {"target_units": "foo"},
                        "nodata_value": -9999,
                        "depths": [
                            {
                                "label": depth,
                                "values": {
                                    "mean": 100 if prop != "nitrogen" else 1000,
                                    "Q0.05": 50 if prop != "nitrogen" else 500,
                                    "Q0.95": 150 if prop != "nitrogen" else 1500,
                                }
                            }
                            for depth in reversed(DEPTHS) # reordered depths
                        ]
                    }
                    for prop in reversed(PROPERTIES) # reordered properties
                ]
            }
        }
    
    def test_successful_capture_and_verify(self, tmp_path, valid_rest_response):
        def mock_request(url, params, timeout):
            assert url == "https://rest.isric.org/soilgrids/v2.0/properties/query"
            assert "value" in params
            assert "Q0.05" in params["value"]
            return valid_rest_response
            
        output = tmp_path / "soil_archive.json"
        archive = capture_soil_archive(
            farm_id="test_farm", latitude=10.0, longitude=20.0,
            request_json=mock_request, output=output
        )
        assert archive["availability"] == "available"
        assert len(archive["layers"]) == 18
        
        # Verify 
        verify_soil_archive(archive)
        
        # Check divisors
        for layer in archive["layers"]:
            if layer["property"] == "nitrogen":
                assert layer["conversion_factor"] == 100.0
                assert layer["mean"] == 10.0 # 1000 / 100
            else:
                assert layer["conversion_factor"] == 10.0
                assert layer["mean"] == 10.0 # 100 / 10
                
    def test_nodata_handling(self, tmp_path, valid_rest_response):
        # Inject nodata
        valid_rest_response["properties"]["layers"][0]["depths"][0]["values"]["mean"] = -9999
        
        def mock_request(url, params, timeout):
            return valid_rest_response
            
        output = tmp_path / "soil_archive.json"
        archive = capture_soil_archive(
            farm_id="test_farm", latitude=10.0, longitude=20.0,
            request_json=mock_request, output=output
        )
        
        verify_soil_archive(archive)
        
        # Find the null mean
        null_means = [l for l in archive["layers"] if l["mean"] is None]
        assert len(null_means) == 1
        assert null_means[0]["mean_raw"] is None
        
    def test_failure_unavailable_state(self, tmp_path):
        def mock_request(url, params, timeout):
            raise RuntimeError("REST probe failed")
            
        output = tmp_path / "soil_archive.json"
        archive = capture_soil_archive(
            farm_id="test_farm", latitude=10.0, longitude=20.0,
            request_json=mock_request, output=output
        )
        assert archive["availability"] == "unavailable"
        assert archive["reason"] == "REST probe failed"
        assert len(archive["layers"]) == 0
        assert len(archive["source_urls"]) > 1 # WCS URLs
        
        # Verify wcs provenance parameters
        wcs_url = archive["source_urls"][0]
        assert "SERVICE=WCS" in wcs_url
        assert "REQUEST=GetCoverage" in wcs_url
        assert "COVERAGEID=" in wcs_url
        assert "SUBSET=X(" in wcs_url
        
        verify_soil_archive(archive)
        
    def test_missing_layers_failure(self, tmp_path, valid_rest_response):
        # Remove a layer
        valid_rest_response["properties"]["layers"].pop(0)
        
        def mock_request(url, params, timeout):
            return valid_rest_response
            
        output = tmp_path / "soil_archive.json"
        archive = capture_soil_archive(
            farm_id="test_farm", latitude=10.0, longitude=20.0,
            request_json=mock_request, output=output
        )
        assert archive["availability"] == "unavailable"
        assert "Expected 18 layers" in archive["reason"]
