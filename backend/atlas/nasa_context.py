"""Decode verified native SMAP L3 V006 / IMERG Final V07B files into regional context.
No interpolation, field attribution, forcing replacement or agronomic inference.
Run offline against backend/.provider_cache/earthdata; full files stay outside public assets.
"""
import argparse, hashlib, json, math
from datetime import datetime, timedelta, timezone
from pathlib import Path
import h5py
import numpy as np

POLICY='nasa-regional-v1'
POINT=[-93.65,42.025]
EPOCH=datetime(1980,1,6,tzinfo=timezone.utc)
SMAP_DOC='https://nsidc.org/sites/default/files/documents/user-guide/spl3smp_e-v006-userguide.pdf'
IMERG_DOC='https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation'
def sha(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def text(v):return v.decode() if isinstance(v,bytes) else str(v)
def scalar(v):
    if isinstance(v,bytes):return v.decode()
    if isinstance(v,np.generic):return v.item()
    if isinstance(v,np.ndarray):return [scalar(x) for x in v]
    return v

def schema(d):return {'shape':list(d.shape),'dtype':str(d.dtype),'attributes':{k:scalar(v) for k,v in d.attrs.items() if k not in ['DIMENSION_LIST','REFERENCE_LIST']}}
def check(d,units=None,shape=None):
    if units is not None and text(d.attrs.get('units',''))!=units:raise ValueError('Unexpected units: '+d.name)
    if shape is not None and d.shape!=shape:raise ValueError('Unexpected dimensions: '+d.name)
    if float(d.attrs.get('scale_factor',1))!=1 or float(d.attrs.get('add_offset',0))!=0:raise ValueError('Unverified packing: '+d.name)
def valid(v,fill,low=0,high=math.inf):return math.isfinite(float(v)) and float(v)!=float(fill) and low<=float(v)<=high

def smap_value(v,flag,surface,fill=-9999,low=.02,high=.5):
    return float(v) if valid(v,fill,low,high) and flag!=65534 and surface!=65534 and flag&3==0 and surface==0 else None

def polygon(w,s,e,n):return {'type':'Polygon','coordinates':[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
def imerg_total(rows,start,end):
    """Clip half-open intervals; disallow overlap, retain partial sum but withhold full total."""
    a=datetime.fromisoformat(start.replace('Z','+00:00'));b=datetime.fromisoformat(end.replace('Z','+00:00'))
    if b<=a:raise ValueError('Invalid aggregation period')
    seconds=0;partial=0.;last=None
    for r in sorted(rows,key=lambda r:r['start']):
        lo=max(a,datetime.fromisoformat(r['start'].replace('Z','+00:00')));hi=min(b,datetime.fromisoformat(r['end'].replace('Z','+00:00')))
        if hi<=lo:continue
        if last and lo<last:raise ValueError('Overlapping precipitation intervals')
        last=hi
        if r['value'] is not None:
            if not math.isfinite(r['value']) or r['value']<0:raise ValueError('Invalid precipitation rate')
            dt=(hi-lo).total_seconds();seconds+=dt;partial+=r['value']*dt/3600
    expected=(b-a).total_seconds()
    return {'totalMm':partial if seconds==expected else None,'partialMm':partial if seconds else None,'validSeconds':seconds,'expectedSeconds':expected,'coverage':seconds/expected}

def extract_smap(path,source):
    cells=[];rows=[];raw={};metadata={}
    with h5py.File(path) as f:
        identification=f['Metadata/DatasetIdentification'].attrs
        if text(identification['ECSVersionID'])!='006' or text(identification['shortName'])!='SPL3SMP_E':raise ValueError('Unverified SMAP version')
        for period in ['AM','PM']:
            g=f['Soil_Moisture_Retrieval_Data_'+period];suffix='' if period=='AM' else '_pm'
            keys=['soil_moisture','soil_moisture_error','retrieval_qual_flag','surface_flag','latitude','longitude','tb_time_utc']
            d={k:g[k+suffix] for k in keys}
            for k in keys:check(d[k],shape=(1624,3856))
            check(d['soil_moisture'],'cm**3/cm**3');check(d['soil_moisture_error'],'cm**3/cm**3')
            check(d['latitude'],'degrees_north');check(d['longitude'],'degrees_east')
            lat=d['latitude'][:];lon=d['longitude'][:];distance=(lat-POINT[1])**2+((lon-POINT[0])*math.cos(math.radians(POINT[1])))**2
            r,c=np.unravel_index(np.argmin(distance),distance.shape)
            if distance[r,c]>.04:raise ValueError('No regional coordinate near pilot')
            metadata[period]={k:schema(v) for k,v in d.items()};raw[period]=[]
            for rr in range(r-1,r+2):
                for cc in range(c-1,c+2):
                    cid=f'{rr}:{cc}';values={k:scalar(v[rr,cc]) for k,v in d.items()};raw[period].append({'cell':cid,**values})
                    if period=='AM':
                        # Cell boundaries halfway between native centers locally; not an effective footprint.
                        w=float((lon[rr,cc-1]+lon[rr,cc])/2);e=float((lon[rr,cc]+lon[rr,cc+1])/2)
                        n=float((lat[rr-1,cc]+lat[rr,cc])/2);s=float((lat[rr,cc]+lat[rr+1,cc])/2)
                        cells.append({'id':cid,'center':[values['longitude'],values['latitude']],'geometry':polygon(w,s,e,n),'pilot':bool(rr==r and cc==c)})
                    timestamp=values['tb_time_utc'];value=smap_value(values['soil_moisture'],values['retrieval_qual_flag'],values['surface_flag'],float(d['soil_moisture'].attrs['_FillValue']),float(d['soil_moisture'].attrs['valid_min']),float(d['soil_moisture'].attrs['valid_max']))
                    try:datetime.fromisoformat(timestamp.replace('Z','+00:00'))
                    except ValueError:timestamp=None;value=None
                    error=values['soil_moisture_error'];error=float(error) if valid(error,d['soil_moisture_error'].attrs['_FillValue'],0,.2) else None
                    rows.append({'id':period+'-'+cid,'cell':cid,'period':period,'observedAt':timestamp,'value':value,'uncertainty':error if value is not None else None,'retrievalFlag':values['retrieval_qual_flag'],'surfaceFlag':values['surface_flag'],'status':'accepted' if value is not None else 'withheld','source':source['file']})
    return {'cells':cells,'rows':rows,'raw':raw,'schema':metadata}

def extract_imerg(path,source):
    cells=[];rows=[];raw=[]
    with h5py.File(path) as f:
        header=text(f.attrs['FileHeader'])
        if 'ProductVersion=V07B;' not in header or 'AlgorithmID=3IMERGHH;' not in header:raise ValueError('Unverified IMERG version')
        g=f['Grid'];names=['precipitation','randomError','precipitationQualityIndex','time','time_bnds','lon','lat','lon_bnds','lat_bnds']
        metadata={k:schema(g[k]) for k in names}
        for k in ['precipitation','randomError','precipitationQualityIndex']:check(g[k],shape=(1,3600,1800))
        for k in ['precipitation','randomError']:check(g[k],'mm/hr')
        for k in ['time','time_bnds']:check(g[k],'seconds since 1980-01-06 00:00:00 UTC')
        check(g['lat'],'degrees_north',(1800,));check(g['lon'],'degrees_east',(3600,));check(g['time_bnds'],shape=(1,2))
        a,b=[int(v) for v in g['time_bnds'][0]]
        if b-a!=1800 or int(g['time'][0])!=a:raise ValueError('Unverified half-hour time support')
        start=(EPOCH+timedelta(seconds=a)).isoformat().replace('+00:00','Z');end=(EPOCH+timedelta(seconds=b)).isoformat().replace('+00:00','Z')
        if f'StartGranuleDateTime={start[:-1]}.000Z;' not in header:raise ValueError('Header/time disagreement')
        lon=g['lon'][:];lat=g['lat'][:];i=int(np.argmin(abs(lon-POINT[0])));j=int(np.argmin(abs(lat-POINT[1])))
        for ii in range(i-1,i+2):
            for jj in range(j-1,j+2):
                cid=f'{ii}:{jj}';w,e=[float(v) for v in g['lon_bnds'][ii]];s,n=[float(v) for v in g['lat_bnds'][jj]]
                cells.append({'id':cid,'center':[float(lon[ii]),float(lat[jj])],'geometry':polygon(w,s,e,n),'pilot':ii==i and jj==j})
                values={k:float(g[k][0,ii,jj]) for k in ['precipitation','randomError','precipitationQualityIndex']};raw.append({'cell':cid,**values})
                accepted=valid(values['precipitation'],g['precipitation'].attrs['_FillValue'])
                quality=values['precipitationQualityIndex'];quality=quality if valid(quality,g['precipitationQualityIndex'].attrs['_FillValue'],0,1) else None
                error=values['randomError'];error=error if valid(error,g['randomError'].attrs['_FillValue']) else None
                rows.append({'id':start+'-'+cid,'cell':cid,'start':start,'end':end,'value':values['precipitation'] if accepted else None,'uncertainty':error,'qualityIndex':quality,'status':'accepted' if accepted else 'withheld','source':source['file']})
    return {'cells':cells,'rows':rows,'raw':raw,'schema':metadata,'start':start,'end':end}

def extract_l4(path,source):
    with h5py.File(path) as f:
        meta=f['Metadata/DatasetIdentification'].attrs
        if text(meta['ECSVersionID'])!='008' or text(meta['shortName'])!='SPL4SMGP':raise ValueError('Unverified L4 product')
        extent=f['Metadata/Extent'].attrs;start=text(extent['rangeBeginningDateTime']);end=text(extent['rangeEndingDateTime'])
        a=datetime.fromisoformat(start.replace('Z','+00:00'));b=datetime.fromisoformat(end.replace('Z','+00:00'))
        if (b-a).total_seconds()!=10800:raise ValueError('Invalid L4 time support')
        names=['cell_lat','cell_lon','time','Geophysical_Data/sm_surface','Geophysical_Data/sm_rootzone'];metadata={k:schema(f[k]) for k in names}
        metadata['extent']={k:text(v) for k,v in extent.items()};metadata['processingVersion']=text(meta['VersionID'])
        metadata['sharedPrecipitationForcing']=text(f['Metadata/CRID/GPH'].attrs['L4_SM_PRECIP_version'])
        for k in ['sm_surface','sm_rootzone']:check(f['Geophysical_Data/'+k],'m3 m-3',(1624,3856))
        lat=f['cell_lat'][:];lon=f['cell_lon'][:];r,c=np.unravel_index(np.argmin((lat-POINT[1])**2+((lon-POINT[0])*.743)**2),lat.shape)
        cells=[];rows=[];raw=[]
        for rr in range(r-1,r+2):
            for cc in range(c-1,c+2):
                cid=f'{rr}:{cc}';w=float((lon[rr,cc-1]+lon[rr,cc])/2);e=float((lon[rr,cc]+lon[rr,cc+1])/2);s=float((lat[rr+1,cc]+lat[rr,cc])/2);n=float((lat[rr-1,cc]+lat[rr,cc])/2)
                cells.append({'id':cid,'center':[float(lon[rr,cc]),float(lat[rr,cc])],'geometry':polygon(w,s,e,n),'pilot':bool(rr==r and cc==c)})
                for variable in ['sm_surface','sm_rootzone']:
                    d=f['Geophysical_Data/'+variable];v=float(d[rr,cc]);accepted=valid(v,d.attrs['_FillValue'],d.attrs['valid_min'],d.attrs['valid_max']);raw.append({'cell':cid,'variable':variable,'value':v})
                    rows.append({'id':variable+'-'+cid,'cell':cid,'period':variable,'start':start,'end':end,'observedAt':(a+(b-a)/2).isoformat().replace('+00:00','Z'),'value':v if accepted else None,'uncertainty':None,'status':'accepted' if accepted else 'withheld','source':source['file']})
    return {'cells':cells,'rows':rows,'raw':raw,'schema':metadata,'start':start,'end':end}

def build(cache,out):
    sources=json.loads((cache/'imerg-manifest.json').read_text())['files']
    # Preserve source identity from the previous successful authenticated acquisition.
    smap=next(cache.glob('SMAP_L3_SM_P_E_20240601_R19240_001.h5'))
    source={'file':smap.name,'sha256':sha(smap),'bytes':smap.stat().st_size,'sourceUrl':None}
    # Use the actual catalog URL, not a reconstructed path.
    access=Path('frontend/public/atlas/access-attempt.json')
    source['sourceUrl']=next(x['sourceUrl'] for x in json.loads(access.read_text())['products'] if x['id']=='smap-surface')
    subset=out/'nasa-native';subset.mkdir(parents=True,exist_ok=True)
    def archive(name,data,src):
        p=subset/(name+'.json');p.write_text(json.dumps({'source':src,'schema':data['schema'],'cells':data['cells'],'values':data['raw']},indent=2,allow_nan=False)+'\n')
        return {'path':'/atlas/nasa-native/'+p.name,'sha256':sha(p)}
    sm=extract_smap(smap,source);sasset=archive(smap.name,sm,source);allrows=[];assets=[];cells=None
    l4source=json.loads((cache/'smap-l4-manifest.json').read_text())['files'][0];l4path=cache/l4source['file']
    if sha(l4path)!=l4source['sha256']:raise ValueError('L4 checksum mismatch')
    l4=extract_l4(l4path,l4source);l4asset=archive(l4path.name,l4,l4source)
    for src in sources:
        p=cache/src['file']
        if sha(p)!=src['sha256']:raise ValueError('Raw checksum mismatch')
        d=extract_imerg(p,src)
        if cells is not None and cells!=d['cells']:raise ValueError('Grid changed')
        cells=d['cells'];allrows+=d['rows'];assets.append(archive(p.name,d,src))
    daystart='2024-06-01T00:00:00Z';dayend='2024-06-02T00:00:00Z'
    totals=[{'cell':c['id'],**imerg_total([r for r in allrows if r['cell']==c['id']],daystart,dayend)} for c in cells]
    pack={'schemaVersion':'nasa-context-v1','verifiedAt':'2026-11-12','region':{'id':'iowa-pilot-region','point':POINT},'start':daystart,'end':dayend,'policy':POLICY,
      'smap':{'product':'SPL3SMP_E','version':'006','kind':'satellite-surface-retrieval','units':'m3/m3','depthCm':[0,5],'spatialSupport':'9 km EASE-Grid posting; approximately 36 km radiometer footprint, ~33 km interpolation contributing domain. Cells are correlated, not field measurements.','qa':'Require retrieval bits 0 and 1 clear, surface flag zero, finite in-range non-fill moisture and valid observation time. Error fill remains null.','cells':sm['cells'],'rows':sm['rows'],'assets':[sasset],'sources':[source],'documentation':SMAP_DOC},
      'imerg':{'product':'GPM_3IMERGHH','version':'07','processingVersion':'V07B','kind':'merged-satellite-gauge-estimate','units':'mm/hr','spatialSupport':'Native 0.1 degree grid; merged/interpolated estimates, not a field rain gauge.','qa':'Reject fill, nonfinite and negative rates. Retain quality index as qualitative metadata, no invented calibrated acceptance threshold. Random error is product RMS estimate, not a calibrated interval.','cells':cells,'rows':allrows,'totals':totals,'assets':assets,'sources':sources,'documentation':IMERG_DOC},
      'rootZone':{'product':'SPL4SMGP','version':'008','status':'available','kind':'land-model-assimilation','units':'m3/m3','spatialSupport':'9 km EASE-Grid land-model assimilation; surface 0–5 cm and root zone 0–100 cm vertical averages. Not field measurements.','qa':'Finite, non-fill values within file valid range. No retrieval flag applies to these model outputs. GPH has no selected soil-moisture uncertainty fields; AUP diagnostics not acquired.','cells':l4['cells'],'rows':l4['rows'],'sources':[l4source],'assets':[l4asset],'documentation':'https://nsidc.org/sites/default/files/documents/user-guide/multi_spl4smau-v008-userguide.pdf','reason':'One three-hour mean only; surface and root-zone values are model-assimilation estimates, not direct retrievals.','start':l4['start'],'end':l4['end']},
      'limitations':['Only this bounded day is captured; no seasonal completeness, anomalies or agronomic calibration.','No resampling to field scale, gap filling, exposure classification, POWER replacement or scoring changes.','IMERG and POWER share MERRA-2-related inputs. L4 metadata lists IMGv7BFnCPCUcorrv3 precipitation forcing; L4 and IMERG agreement is not independent confirmation.','Do not sum random errors as independent; temporal and spatial error dependence is unresolved.'],
      'provenance':{'pipeline':'backend/atlas/nasa_context.py','pipelineSha256':sha(__file__),'acquiredAt':'2026-11-12','timePolicy':'IMERG uses actual time_bnds, half-open UTC intervals; seconds since 1980-01-06 with no leap seconds per file metadata. SMAP L3 uses per-cell tb_time_utc, not nominal 6am. L4 uses explicit Metadata/Extent UTC bounds for three-hour means; raw J2000 time is retained and not naively converted as Unix time.','packing':'Native floating values; no scale/offset attributes (implicit 1/0) verified. cm3/cm3 numerically equals m3/m3.','geometryPolicy':'IMERG native bounds; SMAP local adjacent-coordinate midpoint cell outlines are approximate, not footprint boundaries.','credentialHandling':'Credentials loaded only by acquisition process; no secrets or signed URLs in archive.'}}
    (out/'nasa-context.json').write_text(json.dumps(pack,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'smapRows':len(sm['rows']),'smapAccepted':sum(r['value'] is not None for r in sm['rows']),'imergFiles':len(sources),'pilotTotal':next(t for t in totals if t['cell']==next(c['id'] for c in cells if c['pilot']))}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,default=Path('backend/.provider_cache/earthdata'));p.add_argument('--out',type=Path,default=Path('frontend/public/atlas'));a=p.parse_args();build(a.cache,a.out)
