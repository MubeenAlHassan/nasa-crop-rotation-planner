"""Resumable bounded NASA acquisition; .env loaded only here, without interpolation.
Run --product imerg (48 intervals), smap (one day), or smap-rootzone (one 3-hour mean).
No authentication logs, cookies, headers or signed redirects are persisted.
"""
import argparse,concurrent.futures,contextlib,hashlib,json,logging,os
from pathlib import Path
from dotenv import load_dotenv
import earthaccess
import requests
PRODUCTS={
 'imerg':('GPM_3IMERGHH','07','2024-06-01T00:00:00Z,2024-06-01T23:59:59Z','imerg-manifest.json',48),
 'smap':('SPL3SMP_E','006','2024-06-01T00:00:01Z,2024-06-01T00:00:02Z','smap-manifest.json',1),
 'smap-rootzone':('SPL4SMGP','008','2024-06-01T00:00:01Z,2024-06-01T00:00:02Z','smap-l4-manifest.json',1)}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--product',choices=PRODUCTS,default='imerg');a=p.parse_args()
 product,version,temporal,manifest,count=PRODUCTS[a.product];cache=Path('backend/.provider_cache/earthdata');cache.mkdir(parents=True,exist_ok=True)
 load_dotenv('.env',override=True,interpolate=False);logging.disable(logging.CRITICAL);stage='authentication';files=None
 try:
  with open(os.devnull,'w') as quiet,contextlib.redirect_stdout(quiet),contextlib.redirect_stderr(quiet):
   auth=earthaccess.login(strategy='environment',persist=False)
   if not auth.authenticated:raise ValueError('Unavailable authentication')
   stage='catalog discovery';r=requests.get('https://cmr.earthdata.nasa.gov/search/granules.json',params={'short_name':product,'version':version,'temporal':temporal,'page_size':100,'sort_key':'start_date'},timeout=60);r.raise_for_status();entries=r.json()['feed']['entry']
   if len(entries)!=count:raise ValueError('Unexpected bounded catalog count')
   stage='scientific-file acquisition'
   def capture(e):
    name=e['producer_granule_id'];url=next(l['href'] for l in e['links'] if 'data#' in l.get('rel','') and l.get('href','').startswith('https://') and not l.get('inherited'))
    if Path(name).name!=name:raise ValueError('Unsafe source filename')
    dest=cache/name
    if not dest.exists():
     with earthaccess.get_requests_https_session().get(url,stream=True,timeout=90) as response:
      response.raise_for_status();tmp=dest.with_suffix('.part')
      with tmp.open('wb') as f:
       for chunk in response.iter_content(1024*1024):f.write(chunk)
      tmp.replace(dest)
    with dest.open('rb') as f:
     if f.read(8)!=b'\x89HDF\r\n\x1a\n':raise ValueError('Not HDF5')
    with dest.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
    return {'id':e['id'],'file':name,'sourceUrl':url.split('?')[0],'sha256':digest,'bytes':dest.stat().st_size,'start':e['time_start'],'end':e['time_end']}
   with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(capture,entries))
 except Exception as e:
  status=getattr(getattr(e,'response',None),'status_code',None)
  print(json.dumps({'stage':stage,'errorType':type(e).__name__,'httpStatus':status,'action':'Check local credentials and provider authorization; no raw errors retained.'}));return 1
 (cache/manifest).write_text(json.dumps({'product':product,'version':version,'acquiredAt':'2026-11-12','files':files},indent=2)+'\n')
 print(json.dumps({'product':product,'files':len(files),'bytes':sum(f['bytes'] for f in files)}));return 0
if __name__=='__main__':raise SystemExit(main())
