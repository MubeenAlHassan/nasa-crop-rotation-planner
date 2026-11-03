"""Reproducible Iowa POWER capture. No synthetic replacement for missing observations.

Run: python backend/atlas/pipeline.py --output frontend/public/atlas/iowa.json
Raw provider replies and hashes are retained beside the package in raw/.
"""
from __future__ import annotations
import argparse
import calendar
import hashlib
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

LAT, LON = 42.025, -93.65
PARAMETERS = 'PRECTOTCORR,T2M_MIN,T2M_MAX,RH2M,WS2M,ALLSKY_SFC_SW_DWN'
URL = 'https://power.larc.nasa.gov/api/temporal/daily/point'


def clean(value, fill=-999):
    return float(value) if isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value) and value != fill else None


def precipitation_mm(rate, interval_minutes):
    if interval_minutes <= 0:
        raise ValueError('Interval must be positive')
    value = clean(rate)
    return None if value is None or value < 0 else value * interval_minutes / 60


def weighted_summary(values, overlap_areas, valid):
    """Field-overlap weighted mean; unavailable observations are never zero-filled."""
    if not (len(values) == len(overlap_areas) == len(valid)):
        raise ValueError('Array lengths differ')
    pairs = [(float(v), float(w)) for v, w, ok in zip(values, overlap_areas, valid)
             if ok and clean(v) is not None and clean(w) is not None and w > 0]
    total = sum(w for _, w in pairs)
    return None if not total else sum(v * w for v, w in pairs) / total


def normalize_power(body, year):
    header = body['header']
    if header['time_standard'] != 'UTC':
        raise ValueError('Expected UTC daily observations')
    metadata = body['parameters']
    expected = {'PRECTOTCORR': 'mm/day', 'T2M_MIN': 'C', 'T2M_MAX': 'C', 'RH2M': '%', 'WS2M': 'm/s'}
    for key, unit in expected.items():
        if metadata[key]['units'] != unit:
            raise ValueError(f'Unexpected unit for {key}: {metadata[key]["units"]}')
    radiation_unit = metadata['ALLSKY_SFC_SW_DWN']['units']
    if radiation_unit not in ('MJ/m^2/day', 'kW-hr/m^2/day'):
        raise ValueError(f'Unexpected radiation unit: {radiation_unit}')
    data, fill = body['properties']['parameter'], header['fill_value']
    rows = []
    for month in range(1, 13):
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            current = date(year, month, day)
            key = current.strftime('%Y%m%d')
            values = [clean(data[p].get(key), fill) for p in PARAMETERS.split(',')]
            rain, tmin, tmax, rh, wind, solar = values
            if rain is not None and rain < 0: rain = None
            if rh is not None and not 0 <= rh <= 100: rh = None
            if wind is not None and wind < 0: wind = None
            if solar is not None: solar *= 3.6 if radiation_unit == 'kW-hr/m^2/day' else 1
            if tmin is not None and tmax is not None and tmin > tmax: tmin = tmax = None
            rows.append({'date': current.isoformat(), 'rain': rain, 'tmin': tmin, 'tmax': tmax,
                         'rh': rh, 'wind': wind, 'solar': solar})
    return rows


def capture_year(year, raw_dir):
    params = {'parameters': PARAMETERS, 'community': 'AG', 'format': 'JSON', 'time-standard': 'UTC',
              'latitude': LAT, 'longitude': LON, 'start': f'{year}0101', 'end': f'{year}1231'}
    url = URL + '?' + urlencode(params)
    path = raw_dir / f'power-{year}.json'
    if path.exists():
        raw = path.read_bytes()
    else:
        with urlopen(url, timeout=90) as response: raw = response.read()
        json.loads(raw)
        path.write_bytes(raw)
    body = json.loads(raw)
    rows = normalize_power(body, year)
    return rows, {'id': f'power-{year}', 'url': url, 'sha256': hashlib.sha256(raw).hexdigest(),
                  'provider_header': body['header'], 'parameters': body['parameters'],
                  'native_geometry': body.get('geometry'), 'raw_file': f'raw/power-{year}.json'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw_dir = args.output.parent / 'raw'
    raw_dir.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        parts = list(pool.map(lambda year: capture_year(year, raw_dir), range(2013, 2025)))
    rows = [row for part, _ in parts for row in part]
    missing = sum(any(v is None for k, v in row.items() if k != 'date') for row in rows)
    package = {'schemaVersion': 'atlas-evidence-1', 'id': 'iowa-power-2013-2024',
               'retrievedAt': datetime.now(timezone.utc).isoformat(), 'latitude': LAT, 'longitude': LON,
               'elevationM': parts[0][1].get('native_geometry', {}).get('coordinates', [0, 0, 300])[2],
               'start': '2013-01-01', 'end': '2024-12-31', 'timeStandard': 'UTC',
               'kind': 'gridded-observation', 'provider': 'NASA POWER',
               'spatialSupport': 'Regional meteorology and satellite-derived radiation; not a field sensor',
               'missingDays': missing, 'weather': rows, 'sources': [source for _, source in parts],
               'satellites': [
                 {'id': 'SMAP', 'status': 'unavailable', 'support': '9 km grid; broader effective footprint', 'reason': 'No authenticated, quality-screened granules captured.'},
                 {'id': 'IMERG', 'status': 'unavailable', 'support': '0.1 degree grid', 'reason': 'Not captured; precipitation in this package is POWER PRECTOTCORR, not GPM.'},
                 {'id': 'HLS', 'status': 'unavailable', 'support': '30 m pixels', 'reason': 'No cloud-screened field observations captured. Cover timeline is modeled.'},
                 {'id': 'ECOSTRESS', 'status': 'unavailable', 'support': '70 m pixels', 'reason': 'No quality-screened thermal scenes captured.'},
                 {'id': 'SSURGO', 'status': 'unavailable', 'support': 'Soil survey map units', 'reason': 'Available water capacity is an editable demonstration assumption, not a soil measurement.'}
               ]}
    encoded = json.dumps(package, separators=(',', ':'), allow_nan=False)
    args.output.write_text(encoded)
    args.output.with_suffix('.sha256').write_text(hashlib.sha256(encoded.encode()).hexdigest() + '\n')
    print(f'Captured {len(rows)} days, {missing} incomplete days; {args.output}')

if __name__ == '__main__': main()
