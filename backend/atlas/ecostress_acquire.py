"""Bounded authenticated CMR discovery and full COG acquisition. No credentials in receipts."""
import argparse,contextlib,hashlib,json,logging,os,time
from pathlib import Path
from datetime import datetime,timezone
import requests,earthaccess,rasterio
from dotenv import load_dotenv
PRODUCTS={'ECO_L2T_LSTE':['LST','LST_err','QC','cloud','water'],'ECO_L3T_JET':['ETdaily','ETinstUncertainty','PTJPLSMinst','cloud','water'],'ECO_L4T_ESI':['ESI','PET','cloud','water']}
CACHE=Path('backend/.provider_cache/ecostress')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def discover(start,end,version='002'):
 result={}
 for product in PRODUCTS:
  r=requests.get('https://cmr.earthdata.nasa.gov/search/granules.json',params={'short_name':product,'version':version,'bounding_box':'-93.66,42.015,-93.64,42.035','temporal':start+'T00:00:00Z,'+end+'T23:59:59Z','page_size':2000,'sort_key':'start_date'},timeout=60);r.raise_for_status();entries=r.json()['feed']['entry']
  if len(entries)==2000:raise ValueError('Catalog pagination required')
  result[product]=entries;time.sleep(.25)
 return result

def acquire(catalog,dates,all_june=False):
 load_dotenv('.env',override=True,interpolate=False);logging.disable(logging.CRITICAL)
 with open(os.devnull,'w') as quiet,contextlib.redirect_stdout(quiet),contextlib.redirect_stderr(quiet):earthaccess.login(strategy='environment',persist=False)
 session=earthaccess.get_requests_https_session();receipts=CACHE/'receipts';receipts.mkdir(exist_ok=True)
 for product,entries in catalog.items():
  for e in entries:
   if e['time_start'][:10] not in dates and not(all_june and e['time_start'].startswith('2024-06')):continue
   granule=e['producer_granule_id'];oldpath=receipts/(granule+'.json');old=json.loads(oldpath.read_text()) if oldpath.exists() else {'assets':[]};record={'id':granule,'conceptId':e['id'],'product':product,'version':'002','start':e['time_start'],'end':e['time_end'],'assets':[]};failed=[]
   for link in e['links']:
    url=link['href'];filename=url.rsplit('/',1)[-1]
    if not url.startswith('https://') or not (any(filename.endswith('_'+b+'.tif') for b in PRODUCTS[product]) or filename==granule+'.json'):continue
    p=CACHE/filename
    for attempt in range(3):
     try:
      prior=next((v for v in old['assets'] if v['file']==filename),None)
      if p.exists() and prior and sha(p)!=prior['sha256']:raise ValueError('Cached source checksum mismatch; operator must inspect file')
      if not p.exists():
       with session.get(url,timeout=120) as r:r.raise_for_status();content=r.content
       tmp=p.with_suffix(p.suffix+'.part');tmp.write_bytes(content)
       if p.suffix=='.tif':
        with rasterio.open(tmp) as f:
         if f.count!=1:raise ValueError('Unexpected bands')
       else:json.loads(content)
       tmp.replace(p)
      record['assets'].append({'file':filename,'sourceUrl':url.split('?')[0],'sha256':sha(p),'bytes':p.stat().st_size,'acquiredAt':datetime.fromtimestamp(p.stat().st_mtime,timezone.utc).isoformat()});break
     except Exception as ex:
      status=getattr(getattr(ex,'response',None),'status_code',None)
      if attempt==2:failed.append({'file':filename,'stage':'scientific-file-download','httpStatus':status,'errorType':type(ex).__name__})
      else:time.sleep(2**(attempt+1))
    time.sleep(.25)
   record['failures']=failed;(receipts/(granule+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'product':product,'date':e['time_start'],'files':len(record['assets']),'failures':failed}),flush=True)

def main():
 p=argparse.ArgumentParser();p.add_argument('--start',default='2024-03-01');p.add_argument('--end',default='2024-11-30');p.add_argument('--dates',nargs='*',default=['2024-06-27','2024-06-28']);p.add_argument('--all-june',action='store_true');p.add_argument('--discover-only',action='store_true');args=p.parse_args();CACHE.mkdir(parents=True,exist_ok=True)
 catalog=discover(args.start,args.end);(CACHE/'catalog.json').write_text(json.dumps({'queriedAt':datetime.now(timezone.utc).isoformat(),'bbox':[-93.66,42.015,-93.64,42.035],'start':args.start,'end':args.end,'version':'002','products':catalog},indent=2))
 if not args.discover_only:acquire(catalog,args.dates,args.all_june)
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'stage':'discovery/authentication/setup','errorType':type(e).__name__,'httpStatus':getattr(getattr(e,'response',None),'status_code',None)}));raise SystemExit(1)
