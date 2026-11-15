"""Bounded, resumable DAP4 native-index subsets. No resampling; two workers maximum.
CMR supplies all source URLs. Only unsigned base URLs/constraints and subset hashes persist.
"""
import argparse,concurrent.futures,contextlib,hashlib,json,logging,os,time,threading
from datetime import datetime,timedelta,timezone
from pathlib import Path
import requests,h5py
from dotenv import load_dotenv
import earthaccess
PRODUCTS={'smap':('SPL3SMP_E','006'),'rootZone':('SPL4SMGP','008'),'diagnostics':('SPL4SMAU','008'),'imerg':('GPM_3IMERGHH','07')}
def constraint(key):
 if key=='imerg':return ';'.join(['/Grid/'+v+'[0][862:1:864][1319:1:1321]' for v in ['precipitation','randomError','precipitationQualityIndex']]+['/Grid/time','/Grid/time_bnds','/Grid/lat[1319:1:1321]','/Grid/lon[862:1:864]','/Grid/lat_bnds[1319:1:1321][0:1:1]','/Grid/lon_bnds[862:1:864][0:1:1]'])
 if key=='smap':return ';'.join('/Soil_Moisture_Retrieval_Data_'+period+'/'+v+('' if period=='AM' else '_pm')+'[266:1:268][923:1:925]' for period in ['AM','PM'] for v in ['soil_moisture','soil_moisture_error','retrieval_qual_flag','surface_flag','latitude','longitude','tb_time_utc'])
 group='Geophysical_Data' if key=='rootZone' else 'Analysis_Data'
 names=['sm_surface','sm_rootzone'] if key=='rootZone' else ['sm_surface_analysis','sm_rootzone_analysis','sm_surface_analysis_ensstd','sm_rootzone_analysis_ensstd']
 return ';'.join(['/cell_lat[266:1:268][923:1:925]','/cell_lon[266:1:268][923:1:925]','/time']+['/'+group+'/'+v+'[266:1:268][923:1:925]' for v in names])
def digest(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--start',default='2024-06-01');p.add_argument('--end',default='2024-06-30');p.add_argument('--products',nargs='+',choices=PRODUCTS,default=list(PRODUCTS));p.add_argument('--limit',type=int);p.add_argument('--workers',type=int,choices=[1,2],default=2);a=p.parse_args()
 start=datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc);end=datetime.fromisoformat(a.end).replace(tzinfo=timezone.utc)+timedelta(days=1)
 if not 0<(end-start).days<=275:raise SystemExit('Choose 1–275 days')
 cache=Path('backend/.provider_cache/nasa-season');cache.mkdir(parents=True,exist_ok=True)
 load_dotenv('.env',override=True,interpolate=False);logging.disable(logging.CRITICAL)
 with open(os.devnull,'w') as q,contextlib.redirect_stdout(q),contextlib.redirect_stderr(q):earthaccess.login(strategy='environment',persist=False)
 for key in a.products:
  name,version=PRODUCTS[key];entries=[];page=1
  while True:
   r=requests.get('https://cmr.earthdata.nasa.gov/search/granules.json',params={'short_name':name,'version':version,'temporal':start.isoformat()+','+(end-timedelta(seconds=1)).isoformat(),'page_size':2000,'page_num':page,'sort_key':'start_date'},timeout=60);r.raise_for_status();batch=r.json()['feed']['entry'];entries+=batch
   if len(batch)<2000:break
   page+=1;time.sleep(.5)
  def inperiod(e):
   if key in ['rootZone','diagnostics']:
    nominal=datetime.strptime(e['producer_granule_id'].split('_')[4],'%Y%m%dT%H%M%S').replace(tzinfo=timezone.utc)
    return start<=nominal<end
   return start<=datetime.fromisoformat(e['time_start'].replace('Z','+00:00'))<end
  entries=[e for e in entries if inperiod(e)]
  if a.limit:entries=entries[:a.limit]
  ce=constraint(key);started=time.monotonic();folder=cache/key;folder.mkdir(exist_ok=True);local=threading.local()
  def capture(e):
   filename=e['producer_granule_id'];dest=folder/(filename+'.nc4');receipt=dest.with_suffix('.json')
   if receipt.exists() and dest.exists():
    old=json.loads(receipt.read_text())
    if old['constraint']==ce and old['sha256']==digest(dest):return {'status':'cached','bytes':0}
   url=next(l['href'] for l in e['links'] if 'opendap' in l.get('href','').lower() and not l.get('inherited'))
   source=next(l['href'] for l in e['links'] if 'data#' in l.get('rel','') and l.get('href','').startswith('https://') and not l.get('inherited'))
   for attempt in range(3):
    try:
     t=time.monotonic()
     if not hasattr(local,'session'):local.session=earthaccess.get_requests_https_session()
     session=local.session
     with session.get(url+'.dap.nc4',params={'dap4.ce':ce},timeout=180) as response:
      response.raise_for_status();content=response.content
     if content[:8]!=b'\x89HDF\r\n\x1a\n':raise ValueError('Subset is not NetCDF4/HDF5')
     tmp=dest.with_suffix('.part');tmp.write_bytes(content)
     with h5py.File(tmp):pass
     tmp.replace(dest)
     record={'product':name,'version':version,'key':key,'granuleId':e['id'],'file':filename,'sourceUrl':source.split('?')[0],'dapUrl':url.split('?')[0],'constraint':ce,'sha256':digest(dest),'bytes':len(content),'seconds':time.monotonic()-t,'acquiredAt':datetime.now(timezone.utc).isoformat(),'catalogStart':e['time_start'],'catalogEnd':e['time_end'],'checksumScope':'server-produced native-index NetCDF4 subset, not the full source granule'}
     receipt_tmp=receipt.with_suffix('.receipt-part');receipt_tmp.write_text(json.dumps(record,indent=2)+'\n');receipt_tmp.replace(receipt);time.sleep(.25);return {'status':'acquired','bytes':len(content)}
    except Exception as ex:
     status=getattr(getattr(ex,'response',None),'status_code',None)
     if attempt==2:return {'status':'failed','file':filename,'httpStatus':status,'errorType':type(ex).__name__}
     retry=getattr(getattr(ex,'response',None),'headers',{}).get('Retry-After','')
     time.sleep(min(120,int(retry)) if retry.isdigit() else min(30,2**(attempt+1)))
  outcomes=[]
  def checkpoint():
   summary={'start':a.start,'end':a.end,'product':key,'discovered':len(entries),'seconds':time.monotonic()-started,'outcomes':outcomes}
   report=cache/(key+'-'+a.start+'-'+a.end+'-run.json');tmp=report.with_suffix('.part');tmp.write_text(json.dumps(summary,indent=2)+'\n');tmp.replace(report)
  with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
   for i,result in enumerate(pool.map(capture,entries),1):
    outcomes.append(result)
    if result['status']=='failed':
     with (cache/'failure-history.jsonl').open('a') as audit:audit.write(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'start':a.start,'end':a.end,'product':key,**result})+'\n')
    if i%20==0 or i==len(entries):checkpoint();print(json.dumps({'product':key,'done':i,'discovered':len(entries),'failed':sum(r['status']=='failed' for r in outcomes),'seconds':round(time.monotonic()-started)}),flush=True)
  summary={'start':a.start,'end':a.end,'product':key,'discovered':len(entries),'seconds':time.monotonic()-started,'outcomes':outcomes}
  (cache/(key+'-'+a.start+'-'+a.end+'-run.json')).write_text(json.dumps(summary,indent=2)+'\n')
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'errorType':type(e).__name__,'stage':'authentication/catalog/setup','httpStatus':getattr(getattr(e,'response',None),'status_code',None)}));raise SystemExit(1)
