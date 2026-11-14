"""Replay compact seasonal evidence from verified native-index DAP4 subsets, without network."""
import argparse,json,hashlib,math
from datetime import datetime,timedelta,timezone
from pathlib import Path
import h5py,numpy as np
from nasa_context import smap_value,imerg_total,sha,text
EPOCH=datetime(1980,1,6,tzinfo=timezone.utc)
def number(v):return float(np.asarray(v).reshape(-1)[0])
def array(d,units=None,shape=(3,3),low=0,high=math.inf):
 if d.shape!=shape:raise ValueError('Unexpected subset dimensions: '+d.name)
 if units and text(d.attrs.get('units',''))!=units:raise ValueError('Unexpected units: '+d.name)
 if number(d.attrs.get('scale_factor',1))!=1 or number(d.attrs.get('add_offset',0))!=0:raise ValueError('Unverified packing')
 fill=number(d.attrs.get('_FillValue',-9999));values=d[:].reshape(-1)
 return [float(v) if math.isfinite(float(v)) and float(v)!=fill and low<=float(v)<=high else None for v in values]
def check_smap_coordinates(lat,lon,allow_fill=False):
 expected_lat=np.repeat([42.1379585,42.043377,41.9489365],3);expected_lon=np.tile([-93.7811203,-93.6877594,-93.5943985],3)
 for a,b,x,y in zip(np.asarray(lat).reshape(-1),np.asarray(lon).reshape(-1),expected_lat,expected_lon,strict=True):
  if allow_fill and a==-9999 and b==-9999:continue
  if not math.isfinite(float(a)) or not math.isfinite(float(b)) or abs(float(a)-x)>.00002 or abs(float(b)-y)>.00002:raise ValueError('Changed native SMAP support')
def stamp(v):return v.isoformat().replace('+00:00','Z')
def decode(path,receipt):
 key=receipt['key'];records=[]
 with h5py.File(path) as f:
  if key=='imerg':
   g=f['Grid'];bounds=g['time_bnds'][0]
   if text(g['time_bnds'].attrs['units'])!='seconds since 1980-01-06 00:00:00 UTC' or int(bounds[1]-bounds[0])!=1800:raise ValueError('Unverified IMERG time')
   if 'ProductVersion=V07B;' not in text(f.attrs['FileHeader']):raise ValueError('Unverified IMERG processing version')
   for k,indices in [('lat',[41.95,42.05,42.15]),('lon',[-93.75,-93.65,-93.55])]:
    if not np.allclose(g[k][:],indices,atol=.00002):raise ValueError('Changed IMERG support')
   records=[{'start':stamp(EPOCH+timedelta(seconds=int(bounds[0]))),'end':stamp(EPOCH+timedelta(seconds=int(bounds[1]))),'values':array(g['precipitation'],'mm/hr',(1,3,3)),'errors':array(g['randomError'],'mm/hr',(1,3,3)),'quality':array(g['precipitationQualityIndex'],shape=(1,3,3),high=1)}]
  elif key=='smap':
   if 'R19240' not in receipt['file']:raise ValueError('Unverified L3 processing version')
   for period in ['AM','PM']:
    g=f['Soil_Moisture_Retrieval_Data_'+period];suffix='' if period=='AM' else '_pm';d=g['soil_moisture'+suffix]
    raw=array(d,'cm**3/cm**3',low=-10000);flags=g['retrieval_qual_flag'+suffix][:].reshape(-1).astype(int).tolist();surface=g['surface_flag'+suffix][:].reshape(-1).astype(int).tolist()
    lat=g['latitude'+suffix][:].reshape(-1);lon=g['longitude'+suffix][:].reshape(-1)
    check_smap_coordinates(lat,lon,allow_fill=True)
    times=[];values=[];reasons=[]
    for i,chars in enumerate(g['tb_time_utc'+suffix][:].reshape(9,-1)):
     time=b''.join(chars).rstrip(b'\0').decode();reason=[]
     try:datetime.fromisoformat(time.replace('Z','+00:00'))
     except ValueError:time=None;reason.append('missing-observation-time')
     if raw[i] is None:reason.append('missing-value')
     if lat[i]==-9999 or lon[i]==-9999:reason.append('missing-observation-coordinates')
     if flags[i]==65534 or flags[i]&3:reason.append('retrieval-quality-not-recommended')
     if surface[i]!=0:reason.append('surface-condition-flags')
     v=smap_value(raw[i] if raw[i] is not None else -9999,flags[i],surface[i],number(d.attrs['_FillValue']),number(d.attrs['valid_min']),number(d.attrs['valid_max']))
     if v is None and not reason:reason.append('outside-native-valid-range')
     times.append(time);values.append(v if time and lat[i]!=-9999 and lon[i]!=-9999 else None);reasons.append(reason)
    records.append({'date':receipt['catalogStart'][:10],'period':period,'times':times,'rawValues':raw,'values':values,'errors':array(g['soil_moisture_error'+suffix],'cm**3/cm**3',high=.2),'flags':flags,'surfaceFlags':surface,'reasons':reasons})
  else:
   check_smap_coordinates(f['cell_lat'][:],f['cell_lon'][:])
   if 'Vv8012' not in receipt['file']:raise ValueError('Unverified L4 science version')
   nominal=datetime.strptime(receipt['file'].split('_')[4],'%Y%m%dT%H%M%S').replace(tzinfo=timezone.utc)
   if key=='rootZone':
    start=datetime.fromisoformat(receipt['catalogStart'].replace('Z','+00:00'));end=datetime.fromisoformat(receipt['catalogEnd'].replace('Z','+00:00'))
    if end-start!=timedelta(hours=3) or start+(end-start)/2!=nominal:raise ValueError('L4 GPH interval mismatch')
    g=f['Geophysical_Data'];records=[{'start':stamp(start),'end':stamp(end),'surface':array(g['sm_surface'],'m3 m-3',high=.9),'root':array(g['sm_rootzone'],'m3 m-3',high=.9)}]
   else:
    g=f['Analysis_Data'];records=[{'snapshot':stamp(nominal),'surface':array(g['sm_surface_analysis'],'m3 m-3',high=.9),'root':array(g['sm_rootzone_analysis'],'m3 m-3',high=.9),'surfaceSpread':array(g['sm_surface_analysis_ensstd'],'m3 m-3',high=1),'rootSpread':array(g['sm_rootzone_analysis_ensstd'],'m3 m-3',high=1)}]
 return records

def build(cache,out,start,end):
 base=json.loads(Path('frontend/public/atlas/nasa-context.json').read_text());a=datetime.fromisoformat(start).replace(tzinfo=timezone.utc);b=datetime.fromisoformat(end).replace(tzinfo=timezone.utc)+timedelta(days=1)
 if start[:7]!=end[:7] or b<=a:raise ValueError('Process one calendar month at a time')
 data={'schemaVersion':'nasa-season-v1','month':start[:7],'start':stamp(a),'end':stamp(b),'region':base['region'],'cells':{k:base[k]['cells'] for k in ['smap','imerg','rootZone']},'productSchema':{},'sources':[],'smap':[],'imerg':[],'rootZone':[],'diagnostics':[],'policy':'native-dap4-season-v1','diagnosticDefinition':'SPL4SMAU Analysis_Data/sm_surface_analysis_ensstd and sm_rootzone_analysis_ensstd: ensemble standard deviation (m3/m3) of snapshot analysis, surface 0–5 cm and root zone 0–100 cm. Research diagnostics, not total predictive uncertainty or confidence intervals; not assigned to three-hour GPH means.','limitations':['One season is not a climatology; no standardized anomaly or causal rotation effect.','Native support is unchanged: L3 9 km posting / ~36 km footprint; L4 9 km model grid; IMERG 0.1 degree merged estimate.','POWER, IMERG and L4 share forcing inputs; agreement is not independent confirmation.','Absent intervals and rejected retrievals remain missing. No temporal interpolation or QA relaxation.'],'failures':[],'excludedSources':[],'provenance':{'pipeline':'backend/atlas/nasa_season_process.py','pipelineSha256':sha(__file__),'sourceSubsetMethod':'NASA OPeNDAP DAP4 native array indices, no resampling; representative subsets matched native full files.','documentation':['https://ntrs.nasa.gov/api/citations/20250006429/downloads/SMAP_L4_SM_PSD_v1-7_for_L4SM_Version_8.pdf','https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation'],'verifiedAt':'2026-11-12'}}
 for key in ['smap','imerg','rootZone','diagnostics']:
  for receiptpath in sorted((cache/key).glob('*.json')):
   receipt=json.loads(receiptpath.read_text());p=receiptpath.with_suffix('.nc4')
   if not p.exists():continue
   if key in ['rootZone','diagnostics']:t=datetime.strptime(receipt['file'].split('_')[4],'%Y%m%dT%H%M%S').replace(tzinfo=timezone.utc)
   else:t=datetime.fromisoformat(receipt['catalogStart'].replace('Z','+00:00'))
   if not a<=t<b:continue
   if sha(p)!=receipt['sha256']:raise ValueError('Subset checksum mismatch')
   if key in ['rootZone','diagnostics'] and 'Vv8012' not in receipt['file']:
    data['excludedSources'].append({**receipt,'reason':'Processing version outside verified Vv8012 policy; retained but not substituted or numerically interpreted'});continue
   records=decode(p,receipt)
   if key not in data['productSchema']:
    schema={}
    with h5py.File(p) as f:
     def inspect(name,obj):
      if isinstance(obj,h5py.Dataset) and name not in ['x','y']:
       attrs={}
       for k in ['units','long_name','_FillValue','valid_min','valid_max','scale_factor','add_offset','coordinates']:
        if k in obj.attrs:
         v=obj.attrs[k];attrs[k]=text(v) if np.asarray(v).dtype.kind in 'SO U'.replace(' ','') else np.asarray(v).tolist()
       schema[name]={'subsetShape':list(obj.shape),'dtype':str(obj.dtype),'attributes':attrs}
     f.visititems(inspect)
    data['productSchema'][key]=schema
   idx=len(data['sources']);data['sources'].append(receipt)
   for r in records:r['source']=idx;data[key].append(r)
 for key,identity in [('smap',lambda r:r['date']+r['period']),('diagnostics',lambda r:r['snapshot']),('rootZone',lambda r:r['start'])]:
  ids=[identity(r) for r in data[key]]
  if len(ids)!=len(set(ids)):raise ValueError('Duplicate '+key+' records')
 for run in sorted(cache.glob('*-run.json')):
  report=json.loads(run.read_text())
  if report['start']==start and report['end']==end:data['failures'] += [dict(r,product=report['product']) for r in report['outcomes'] if r['status']=='failed']
 days=[]
 for i in range((b-a).days):
  begin=a+timedelta(days=i);finish=begin+timedelta(days=1);ds=stamp(begin);de=stamp(finish);date=ds[:10]
  rain=[];roots=[]
  for cell in range(9):
   rain.append(imerg_total([{'start':r['start'],'end':r['end'],'value':r['values'][cell]} for r in data['imerg']],ds,de))
   rr=[r for r in data['rootZone'] if ds<=r['start']<de];starts=[r['start'] for r in rr]
   if len(starts)!=len(set(starts)):raise ValueError('Duplicate L4 intervals')
   if any((datetime.fromisoformat(t.replace('Z','+00:00'))-begin).total_seconds()%10800 for t in starts):raise ValueError('Unaligned L4 interval')
   values=[r['root'][cell] for r in rr if r['root'][cell] is not None]
   roots.append({'mean':sum(values)/8 if len(values)==8 else None,'validIntervals':len(values),'expectedIntervals':8})
  days.append({'date':date,'rain':rain,'root':roots})
 data['days']=days;data['coverage']={'expected':{'smap':(b-a).days*2,'imerg':(b-a).days*48,'rootZone':(b-a).days*8,'diagnostics':(b-a).days*8},'acquired':{k:len(data[k]) for k in ['smap','imerg','rootZone','diagnostics']},'smapAccepted':sum(v is not None for r in data['smap'] for v in r['values'])}
 out.mkdir(exist_ok=True,parents=True);file=out/(start[:7]+'.json');file.write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')
 indexpath=out.parent/'nasa-season-index.json';index=json.loads(indexpath.read_text()) if indexpath.exists() else {'schemaVersion':'nasa-season-index-v1','months':[]}
 item={'month':data['month'],'path':'/atlas/nasa-season/'+file.name,'sha256':sha(file),'bytes':file.stat().st_size,'coverage':data['coverage']};index['months']=[m for m in index['months'] if m['month']!=data['month']]+[item];indexpath.write_text(json.dumps(index,indent=2)+'\n');print(json.dumps(item))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,default=Path('backend/.provider_cache/nasa-season'));p.add_argument('--out',type=Path,default=Path('frontend/public/atlas/nasa-season'));p.add_argument('--start',default='2024-06-01');p.add_argument('--end',default='2024-06-30');args=p.parse_args();build(args.cache,args.out,args.start,args.end)
