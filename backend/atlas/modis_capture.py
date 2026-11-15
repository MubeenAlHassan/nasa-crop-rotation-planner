"""Public NASA ORNL MOD13Q1 seasonal subsets, retained as regional context only.

A representative CSV's full granule IDs verify Collection 061 independently of
product short name; CSV/JSON encoded values must agree before any output is used.
No credentials, no field downscaling, no bare-field classification.
"""
from __future__ import annotations
import argparse,csv,io,json,math
from datetime import datetime,timedelta,timezone
from pathlib import Path
from field_evidence_capture import Capture,dump,digest
BASE='https://modis.ornl.gov/rst/api/v1'
PREFIX='250m_16_days_'
BANDS=['NDVI','EVI','VI_Quality','pixel_reliability','composite_day_of_the_year']
REFERENCES=['https://modis.ornl.gov/data/modis_webservice.html','https://lpdaac.usgs.gov/documents/103/MOD13_User_Guide_V6.pdf','https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061','https://modis.gsfc.nasa.gov/data/dataprod/mod13.php']

def modis_valid(ndvi,evi,quality,reliability,day,start_doy,end_doy):
    if not all(isinstance(v,int) for v in (ndvi,evi,quality,reliability,day)):return False
    return (-2000<=ndvi<=10000 and -2000<=evi<=10000 and 0<=quality<65535 and reliability==0 and quality&3==0 and (quality>>2)&15<=2 and (quality>>6)&3 in (1,2) and not quality&((1<<8)|(1<<10)|(1<<14)|(1<<15)) and (quality>>11)&7==1 and start_doy<=day<=end_doy)

def parse_subset(data,csv_text,band_meta):
    grid={k:data[k] for k in ('xllcorner','yllcorner','cellsize','nrows','ncols')}
    if not math.isclose(data['cellsize'],231.656358264,rel_tol=1e-8) or (data['nrows'],data['ncols'])!=(9,9):raise ValueError('Unexpected MODIS native subset support')
    for key in ('NDVI','EVI'):
        m=band_meta[PREFIX+key]
        if float(m['scale_factor'])!=.0001 or float(m['add_offset'])!=0 or int(m['fill_value'])!=-3000:raise ValueError('Unexpected MODIS VI packing')
    csv_rows={};granules={}
    for row in csv.reader(io.StringIO(csv_text)):
        if not row:continue
        parts=row[0].split('.')
        if len(parts)<6 or parts[0]!='MOD13Q1' or parts[3]!='061':raise ValueError('MODIS collection is not verified 061')
        key=(row[2],'.'.join(parts[5:]));csv_rows[key]=[int(v) for v in row[5:]];granules.setdefault(row[2],set()).add('.'.join(parts[:5]))
    grouped={}
    for row in data['subset']:
        key=(row['modis_date'],row['band'])
        if csv_rows.get(key)!=row['data']:raise ValueError('MODIS CSV/JSON mismatch')
        if len(row['data'])!=81:raise ValueError('Unexpected subset length')
        grouped.setdefault(row['modis_date'],{})[row['band']]=row
    results=[]
    for date,layers in sorted(grouped.items()):
        if any(PREFIX+b not in layers for b in BANDS):raise ValueError('Missing MODIS QA, date or VI layer')
        first=layers[PREFIX+'NDVI']['calendar_date'];start=datetime.strptime(first,'%Y-%m-%d');end=min(start+timedelta(days=15),datetime(start.year,12,31))
        lo=int(start.strftime('%j'));hi=int(end.strftime('%j'));valid=[]
        for i in range(81):
            values=[layers[PREFIX+b]['data'][i] for b in BANDS]
            if modis_valid(*values,lo,hi):valid.append(values)
        fraction=len(valid)/81
        results.append({'periodStart':first,'periodEnd':end.strftime('%Y-%m-%d'),'ndvi':round(sum(v[0] for v in valid)/len(valid)*.0001,4) if fraction>=.8 else None,'evi':round(sum(v[1] for v in valid)/len(valid)*.0001,4) if fraction>=.8 else None,'validPixels':len(valid),'totalPixels':81,'validFraction':round(fraction,6),'status':'available' if fraction>=.8 else 'insufficient-regional-coverage','selectedPixelDateMin':(datetime(start.year,1,1)+timedelta(days=min(v[4] for v in valid)-1)).strftime('%Y-%m-%d') if valid else None,'selectedPixelDateMax':(datetime(start.year,1,1)+timedelta(days=max(v[4] for v in valid)-1)).strftime('%Y-%m-%d') if valid else None,'sourceGranules':sorted(granules[date]),'grid':grid})
    return results

def capture(out,offline,start,end):
    c=Capture(out,offline,False);files=[]
    metadata=c.json('modis/bands.json',BASE+'/MOD13Q1/bands');files.append(c.raw/'modis/bands.json')
    dates=c.json('modis/dates.json',BASE+'/MOD13Q1/dates',params={'latitude':42.025,'longitude':-93.65});files.append(c.raw/'modis/dates.json')
    selected=[d for d in dates['dates'] if start<=d['calendar_date'] and (datetime.strptime(d['calendar_date'],'%Y-%m-%d')+timedelta(days=15)).strftime('%Y-%m-%d')<=end]
    if not selected:raise ValueError('No complete 16-day composite in the requested season')
    series=[]
    for offset in range(0,len(selected),10):
        chunk=selected[offset:offset+10];name=f"modis/subset-{chunk[0]['modis_date']}-{chunk[-1]['modis_date']}"
        params={'latitude':42.025,'longitude':-93.65,'startDate':chunk[0]['modis_date'],'endDate':chunk[-1]['modis_date'],'kmAboveBelow':1,'kmLeftRight':1}
        data=c.json(name+'.json',BASE+'/MOD13Q1/subset',params=params);csv_path=c.raw/(name+'.csv')
        if not csv_path.exists():
            if offline:raise RuntimeError('Missing archived MODIS CSV collection confirmation')
            response=c.session.get(BASE+'/MOD13Q1/subset',params=params,headers={'Accept':'text/csv'},timeout=120);response.raise_for_status();csv_path.write_text(response.text)
            dump(csv_path.with_suffix('.csv.provenance.json'),{'url':response.url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'sha256':digest(csv_path)})
        rows=parse_subset(data,csv_path.read_text(),{b['band']:b for b in metadata['bands']})
        if [r['periodStart'] for r in rows]!=[d['calendar_date'] for d in chunk]:raise ValueError('MODIS response dates differ from the requested catalog dates')
        series.extend(rows);files.extend([c.raw/(name+'.json'),csv_path]);print('Verified MODIS composites',len(rows),flush=True)
    record={'id':'modis','status':'available','evidenceKind':'regional-composite-context','product':'MOD13Q1.061 Terra MODIS Vegetation Indices','version':'061 verified from captured CSV granule IDs; matching JSON encoded arrays','sourceUrl':REFERENCES[2],'spatialSupport':'Native nominal 250 m sinusoidal grid (231.656358264 m postings). Full 9 × 9 cell neighborhood (~2.085 × 2.085 km), not the 44 ha field. No resampling.','dates':[r['periodStart'] for r in series],'units':'NDVI/EVI dimensionless; encoded scale 0.0001, offset 0, fill -3000; QA unscaled; composite pixel day-of-year 1–366, fill -1','qa':{'policy':'mod13q1-061-conservative-v1','minimumRegionalValidFraction':.8,'method':'Pixel reliability 0; MODLAND 0; usefulness 0–2; low/intermediate aerosol; land only; no adjacent/mixed cloud, snow or shadow; valid VI and selected day within composite period. No gap filling.','bandMetadata':metadata['bands']},'summary':{'requestedStart':start,'requestedEnd':end,'center':[42.025,-93.65],'regionAreaKm2':round(81*231.656358264**2/1e6,6),'series':series},'limitations':['A composite selects different observation days at different pixels; its start date is not a simultaneous overpass or a 16-day mean.','Mixed land covers and coarse support: regional seasonal context only, never used to fill Landsat gaps or confirm a field condition.','Conservative QA can withhold an entire regional mean. No calibrated uncertainty, bare-soil classification or agronomic benefit inference.','Only composites fully inside the requested season are included; edge days remain unsupported.'],'assets':[{'path':'/atlas/'+str(p.relative_to(out)),'sha256':digest(p)} for p in files],'provenance':{'pipeline':'backend/atlas/modis_capture.py','pipelineSha256':digest(Path(__file__)),'verificationDate':'2026-11-08','primaryReferences':REFERENCES,'authentication':'Public ORNL DAAC TESViS REST API; no credentials supplied.'}}
    dump(out/'modis-context.json',record);return record

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=Path('frontend/public/atlas'));p.add_argument('--offline',action='store_true');p.add_argument('--start',default='2024-03-01');p.add_argument('--end',default='2024-11-30');a=p.parse_args()
    start=datetime.strptime(a.start,'%Y-%m-%d');end=datetime.strptime(a.end,'%Y-%m-%d')
    if not 15<=(end-start).days<=366:p.error('Choose 16–367 days')
    capture(a.out,a.offline,a.start,a.end)
if __name__=='__main__':main()
