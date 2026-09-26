import json
import math
import time
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Callable, Mapping, Any

import httpx
import pytest

JsonValue = str | int | float | bool | None | dict[str, 'JsonValue'] | list['JsonValue']
JsonRequest = Callable[[str, Mapping[str, str], float], Mapping[str, JsonValue]]
PowerArchive = dict[str, JsonValue]

class PowerCaptureError(Exception):
    pass

class RateLimitError(PowerCaptureError):
    pass

def default_request_adapter(url: str, params: Mapping[str, str], timeout: float) -> Mapping[str, JsonValue]:
    budget = timeout
    attempts = 0
    max_attempts = 2
    
    timeout_config = httpx.Timeout(budget, connect=2.0, read=4.0, write=2.0, pool=1.0)
    
    while attempts < max_attempts:
        start_time = time.monotonic()
        attempts += 1
        try:
            with httpx.Client(timeout=timeout_config) as client:
                response = client.get(url, params=params)
                
            if response.status_code == 200:
                try:
                    data = response.json()
                    if not isinstance(data, dict):
                        raise PowerCaptureError("Payload is not a JSON object")
                    return data
                except ValueError:
                    raise PowerCaptureError("Invalid JSON in response")
            elif response.status_code in (429, 500, 502, 503, 504):
                elapsed = time.monotonic() - start_time
                budget -= elapsed
                
                retry_after = 0.0
                if "Retry-After" in response.headers:
                    try:
                        retry_after = float(response.headers["Retry-After"])
                    except ValueError:
                        pass
                
                if budget <= 0 or retry_after > budget or attempts >= max_attempts:
                    if response.status_code == 429:
                        raise RateLimitError(f"HTTP {response.status_code}")
                    raise PowerCaptureError(f"HTTP {response.status_code}")
                    
                if retry_after > 0:
                    time.sleep(retry_after)
                    budget -= retry_after
                    
                timeout_config = httpx.Timeout(budget, connect=2.0, read=4.0, write=2.0, pool=1.0)
                continue
            else:
                raise PowerCaptureError(f"HTTP {response.status_code}")
                
        except (httpx.RequestError, httpx.TimeoutException) as e:
            elapsed = time.monotonic() - start_time
            budget -= elapsed
            if budget <= 0 or attempts >= max_attempts:
                raise PowerCaptureError(f"Request failed: {e}")
            timeout_config = httpx.Timeout(budget, connect=2.0, read=4.0, write=2.0, pool=1.0)
            
    raise PowerCaptureError("Max attempts reached")

def verify_power_archive(archive: Mapping[str, JsonValue]) -> None:
    if archive.get("schema_version") != "1.0":
        raise ValueError("Invalid schema version")
        
    reqs = archive.get("requests")
    if not isinstance(reqs, list):
        raise ValueError("requests must be a list")
        
    for req in reqs:
        payload = req.get("payload")
        if not isinstance(payload, dict):
             raise ValueError("Payload must be a dict")
             
        if req.get("status_code") != 200:
             raise ValueError("Expected status_code 200")
             
        parameters = payload.get("parameters", {})
        if not isinstance(parameters, dict):
            raise ValueError("Missing or invalid parameters in payload")
            
        prec_meta = parameters.get("PRECTOTCORR", {})
        t2m_meta = parameters.get("T2M", {})
        
        if not isinstance(prec_meta, dict) or prec_meta.get("units") not in ("mm/day", "mm"):
            raise ValueError("Invalid rainfall units")
        if not isinstance(t2m_meta, dict) or t2m_meta.get("units") != "C":
            raise ValueError("Invalid temperature units")
            
        header = payload.get("header", {})
        if not isinstance(header, dict):
             raise ValueError("Missing header")
        fill_value = header.get("fill_value")
        if not isinstance(fill_value, (int, float)):
            raise ValueError("Missing or invalid fill_value")
            
        props = payload.get("properties", {})
        if not isinstance(props, dict):
             raise ValueError("Missing properties")
        param_data = props.get("parameter", {})
        if not isinstance(param_data, dict):
            raise ValueError("Missing parameter data")
            
        prec_data = param_data.get("PRECTOTCORR", {})
        t2m_data = param_data.get("T2M", {})
        if not isinstance(prec_data, dict) or not isinstance(t2m_data, dict):
            raise ValueError("Absent parameter maps")
            
        start_date = date.fromisoformat(str(req.get("start_date")))
        end_date = date.fromisoformat(str(req.get("end_date")))
        
        current = start_date
        expected_keys = set()
        while current <= end_date:
            date_key = current.strftime("%Y%m%d")
            expected_keys.add(date_key)
            
            if date_key not in prec_data or date_key not in t2m_data:
                raise ValueError(f"Absent date key: {date_key}")
                
            p_val = prec_data[date_key]
            t_val = t2m_data[date_key]
            
            for v in (p_val, t_val):
                if isinstance(v, bool):
                    raise ValueError(f"Boolean not allowed: {v}")
                if not isinstance(v, (int, float)):
                    raise ValueError(f"Numeric string or invalid type: {v}")
                if not math.isfinite(v):
                    raise ValueError(f"Nonfinite number: {v}")
                    
            current += timedelta(days=1)
            
        if set(prec_data.keys()) - expected_keys:
             raise ValueError("Impossible date keys in PRECTOTCORR")
        if set(t2m_data.keys()) - expected_keys:
             raise ValueError("Impossible date keys in T2M")

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
    if not (math.isfinite(latitude) and math.isfinite(longitude)):
         raise ValueError("Coordinates must be finite")
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
         raise ValueError("Coordinates out of bounds")

    if observation_start > observation_end:
        raise ValueError("Invalid observation dates")
    if baseline_start_year > baseline_end_year:
        raise ValueError("Invalid baseline years")
        
    requests_data = []
    
    def fetch_period(start: date, end: date):
        url = "https://power.larc.nasa.gov/api/temporal/daily/point"
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
        
        retrieved_at = datetime.now(timezone.utc).isoformat()
        payload = request_json(url, params, 8.0)
        
        requests_data.append({
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "retrieved_at": retrieved_at,
            "url": url,
            "query_params": params,
            "status_code": 200,
            "payload": payload
        })
        
    fetch_period(observation_start, observation_end)
    
    for year in range(baseline_start_year, baseline_end_year + 1):
        fetch_period(date(year, 1, 1), date(year, 12, 31))
        
    archive = {
        "schema_version": "1.0",
        "provider": "nasa_power",
        "farm_id": farm_id,
        "location": {
            "latitude": latitude,
            "longitude": longitude
        },
        "requests": requests_data
    }
    
    verify_power_archive(archive)
    
    temp_file = output.with_suffix('.tmp')
    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(archive, f, indent=2)
        temp_file.replace(output)
    except Exception as e:
        if temp_file.exists():
            temp_file.unlink()
        raise e
        
    return archive

# --- Tests ---

def test_validate_committed_archive():
    fixture_path = Path(__file__).parent.parent / "tests" / "fixtures" / "power_archive.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        archive = json.load(f)
    verify_power_archive(archive)
    
def mock_request_json(url: str, params: Mapping[str, str], timeout: float):
    start = date.fromisoformat(params["start"][:4] + "-" + params["start"][4:6] + "-" + params["start"][6:])
    end = date.fromisoformat(params["end"][:4] + "-" + params["end"][4:6] + "-" + params["end"][6:])
    
    prec_data = {}
    t2m_data = {}
    
    current = start
    while current <= end:
        dk = current.strftime("%Y%m%d")
        prec_data[dk] = 0.0
        t2m_data[dk] = 10.0
        current += timedelta(days=1)
        
    return {
        "header": {"fill_value": -999.0},
        "parameters": {
            "PRECTOTCORR": {"units": "mm/day"},
            "T2M": {"units": "C"}
        },
        "properties": {
            "parameter": {
                "PRECTOTCORR": prec_data,
                "T2M": t2m_data
            }
        }
    }

def test_leap_years(tmp_path):
    out = tmp_path / "out.json"
    capture_power_archive(
        farm_id="f1",
        latitude=0.0,
        longitude=0.0,
        observation_start=date(2023,1,1),
        observation_end=date(2023,1,2),
        baseline_start_year=2024,
        baseline_end_year=2024,
        request_json=mock_request_json,
        output=out
    )
    
    with open(out, "r") as f:
        data = json.load(f)
    verify_power_archive(data)
    
    req_2024 = [r for r in data["requests"] if r["start_date"].startswith("2024")][0]
    assert "20240229" in req_2024["payload"]["properties"]["parameter"]["PRECTOTCORR"]

def test_sentinels(tmp_path):
    def mock_sentinel(url, params, timeout):
        payload = mock_request_json(url, params, timeout)
        dk = params["start"]
        payload["properties"]["parameter"]["PRECTOTCORR"][dk] = -999.0
        return payload
        
    out = tmp_path / "out.json"
    capture_power_archive(
        farm_id="f1", latitude=0.0, longitude=0.0,
        observation_start=date(2023,1,1), observation_end=date(2023,1,2),
        baseline_start_year=2020, baseline_end_year=2020,
        request_json=mock_sentinel, output=out
    )
    assert out.exists()

def test_malformed_payload_missing_keys(tmp_path):
    def mock_missing(url, params, timeout):
        payload = mock_request_json(url, params, timeout)
        dk = params["start"]
        del payload["properties"]["parameter"]["PRECTOTCORR"][dk]
        return payload
        
    out = tmp_path / "out.json"
    with pytest.raises(ValueError, match="Absent date key"):
        capture_power_archive(
            farm_id="f1", latitude=0.0, longitude=0.0,
            observation_start=date(2023,1,1), observation_end=date(2023,1,2),
            baseline_start_year=2020, baseline_end_year=2020,
            request_json=mock_missing, output=out
        )

def test_malformed_payload_impossible_date(tmp_path):
    def mock_impossible(url, params, timeout):
        payload = mock_request_json(url, params, timeout)
        payload["properties"]["parameter"]["PRECTOTCORR"]["20990101"] = 0.0
        return payload
        
    out = tmp_path / "out.json"
    with pytest.raises(ValueError, match="Impossible date keys"):
        capture_power_archive(
            farm_id="f1", latitude=0.0, longitude=0.0,
            observation_start=date(2023,1,1), observation_end=date(2023,1,2),
            baseline_start_year=2020, baseline_end_year=2020,
            request_json=mock_impossible, output=out
        )

def test_preservation_of_existing_file(tmp_path):
    out = tmp_path / "out.json"
    out.write_text('{"existing": true}')
    
    def mock_fail(url, params, timeout):
        payload = mock_request_json(url, params, timeout)
        payload["parameters"]["PRECTOTCORR"]["units"] = "wrong"
        return payload
        
    with pytest.raises(ValueError, match="Invalid rainfall units"):
        capture_power_archive(
            farm_id="f1", latitude=0.0, longitude=0.0,
            observation_start=date(2023,1,1), observation_end=date(2023,1,2),
            baseline_start_year=2020, baseline_end_year=2020,
            request_json=mock_fail, output=out
        )
        
    assert out.read_text() == '{"existing": true}'
    assert not out.with_suffix('.tmp').exists()

def test_rate_limiting_retry(monkeypatch):
    class MockResponse:
        def __init__(self, status_code, json_data=None, headers=None):
            self.status_code = status_code
            self._json_data = json_data or {}
            self.headers = headers or {}
            
        def json(self):
            return self._json_data
            
    calls = []
    
    class MockClient:
        def __init__(self, **kwargs):
            pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url, params=None):
            calls.append(url)
            if len(calls) == 1:
                return MockResponse(429, headers={"Retry-After": "0.1"})
            return MockResponse(200, json_data={"a": "b"})
            
    monkeypatch.setattr(httpx, "Client", MockClient)
    
    result = default_request_adapter("http://fake", {}, 5.0)
    assert result == {"a": "b"}
    assert len(calls) == 2

def test_timeout_exhaustion(monkeypatch):
    class MockResponse:
        def __init__(self, status_code, headers=None):
            self.status_code = status_code
            self.headers = headers or {}
            
    class MockClient:
        def __init__(self, **kwargs):
            pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url, params=None):
            return MockResponse(429, headers={"Retry-After": "2.0"})
            
    monkeypatch.setattr(httpx, "Client", MockClient)
    
    with pytest.raises(RateLimitError):
        default_request_adapter("http://fake", {}, 1.0)
