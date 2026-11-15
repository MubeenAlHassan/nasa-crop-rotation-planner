"""Capture a separate 2005–2024 POWER historical baseline; never replace model forcing."""
import argparse,json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from pipeline import capture_year,LAT,LON
from field_evidence_capture import dump,digest

def capture(out,offline):
    raw=out/'raw';raw.mkdir(parents=True,exist_ok=True)
    years=list(range(2005,2025))
    if offline and any(not (raw/f'power-{y}.json').exists() for y in years):raise ValueError('Offline replay requires all twenty archived yearly responses')
    with ThreadPoolExecutor(max_workers=2) as pool:parts=list(pool.map(lambda year:capture_year(year,raw),years))
    for year,(_,source) in zip(years,parts):
        h=source['provider_header'];g=source['native_geometry']
        if h['start']!=f'{year}0101' or h['end']!=f'{year}1231' or g['coordinates'][:2]!=[LON,LAT]:raise ValueError('POWER dates or requested point changed')
        if set(h['sources'])!={'MERRA2','SYN1DEG','POWER'}:raise ValueError('POWER source family changed; review before combining baseline')
    rows=[r for part,_ in parts for r in part]
    base=json.loads((out/'iowa.json').read_text())
    if [r for r in rows if r['date']>='2013-01-01']!=base['weather']:raise ValueError('Historical overlap differs from original forcing archive')
    result={**base,'id':'iowa-power-history-2005-2024','start':'2005-01-01','end':'2024-12-31','retrievedAt':base['retrievedAt'],'processedAt':'2026-11-12','weather':rows,'missingDays':sum(any(v is None for k,v in r.items() if k!='date') for r in rows),'sources':[s for _,s in parts],'satellites':[], 'role':'historical regional context only; model forcing remains iowa-power-2013-2024','provenance':{'pipeline':'backend/atlas/power_history_capture.py','pipelineSha256':digest(Path(__file__)),'normalizerSha256':digest(Path(__file__).with_name('pipeline.py')),'verifiedAt':'2026-11-12','primaryReferences':['https://power.larc.nasa.gov/docs/services/api/temporal/daily/'],'limitations':['Twenty archived years are a descriptive baseline, not a climate projection or field station.','Shared forcing and model dependencies must be assessed before combining POWER with SMAP L4; product agreement is not independent validation.','Provider/API metadata is retained per year; this is not proof of homogeneous station-quality accuracy.']}}
    # Raw receipt times are per asset, not the inherited original forcing retrieval date.
    result['retrievedAt']='2026-11-12'
    result['kind']='regional-model-and-satellite-derived-context'
    for _,source in parts:
        if int(source['id'][-4:])<2013:
            receipt=raw/(source['id']+'.receipt.json')
            if not receipt.exists():dump(receipt,{'acquiredOn':'2026-11-12','url':source['url'],'sha256':source['sha256'],'note':'Acquisition day recorded; precise request time was not instrumented.'})
    result['sourceRetrievalNote']='Original 2013–2024 raw archive retained; 2005–2012 acquired 2026-11-12. Per-file receipts retained for new years.'
    dump(out/'power-history.json',result)
    print(json.dumps({'days':len(rows),'missingDays':result['missingDays'],'start':result['start'],'end':result['end']}))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=Path('frontend/public/atlas'));p.add_argument('--offline',action='store_true');a=p.parse_args();capture(a.out,a.offline)
