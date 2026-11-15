"""Authenticated current JPL CRI file, bounded one-file capture, checksum-verified resume."""
import contextlib,hashlib,json,logging,os
from datetime import datetime,timezone
from pathlib import Path
import earthaccess,requests,h5py
from dotenv import load_dotenv
CACHE=Path('backend/.provider_cache/grace')
PRODUCT='TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 CACHE.mkdir(parents=True,exist_ok=True)
 notes=CACHE/'release-notes.txt'
 if not notes.exists():
  doc=requests.get('https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-docs/gracefo/open/docs/GRACE_GRACE-FO_ReleaseNotes_JPL_MASCON.txt',timeout=60);doc.raise_for_status();notes.write_text(doc.text)
 r=requests.get('https://cmr.earthdata.nasa.gov/search/granules.json',params={'short_name':PRODUCT,'version':'RL06.3Mv04','page_size':20},timeout=60);r.raise_for_status();catalog=r.json();entries=catalog['feed']['entry']
 if len(entries)!=1:raise ValueError('Expected one complete historical file; inspect discovery')
 e=entries[0];url=next(l['href'] for l in e['links'] if l['href'].startswith('https://') and l['href'].endswith('.nc'));p=CACHE/url.rsplit('/',1)[-1];receipt=CACHE/'receipt.json'
 if p.exists():
  if not receipt.exists() or json.loads(receipt.read_text())['sha256']!=sha(p):raise ValueError('Cached file requires checksum inspection')
  print(json.dumps({'stage':'verified-cache','bytes':p.stat().st_size}));return
 load_dotenv('.env',override=True,interpolate=False);logging.disable(logging.CRITICAL)
 with open(os.devnull,'w') as quiet,contextlib.redirect_stdout(quiet),contextlib.redirect_stderr(quiet):earthaccess.login(strategy='environment',persist=False)
 session=earthaccess.get_requests_https_session()
 with session.get(url,timeout=180,stream=True) as response:
  response.raise_for_status()
  with p.with_suffix('.part').open('wb') as out:
   for chunk in response.iter_content(1024*1024):out.write(chunk)
 with h5py.File(p.with_suffix('.part')) as f:
  if 'lwe_thickness' not in f:raise ValueError('Unexpected scientific schema')
 p.with_suffix('.part').replace(p);(CACHE/'catalog.json').write_text(json.dumps(catalog,indent=2))
 receipt.write_text(json.dumps({'product':PRODUCT,'version':'RL06.3Mv04','conceptId':e['id'],'granule':e['producer_granule_id'],'sourceUrl':url,'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size,'acquiredAt':datetime.now(timezone.utc).isoformat(),'access':'authenticated Earthdata HTTPS'},indent=2)+'\n');print(json.dumps({'stage':'scientific-file-acquired','bytes':p.stat().st_size,'sha256':sha(p)}))
if __name__=='__main__':
 try:main()
 except Exception as ex:print(json.dumps({'stage':'GRACE discovery/authentication/download','errorType':type(ex).__name__,'httpStatus':getattr(getattr(ex,'response',None),'status_code',None)}));raise SystemExit(1)
