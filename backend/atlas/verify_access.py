import json,urllib.request,urllib.parse,urllib.error,os,netrc
from pathlib import Path
# Never read credential values into output. This probe tests only unauthenticated access.
try:
    path=Path.home()/'.netrc'
    configured=bool(netrc.netrc(str(path)).authenticators('urs.earthdata.nasa.gov')) if path.exists() else False
except (OSError,netrc.NetrcParseError):
    raise SystemExit('Credential file cannot be parsed; inspect locally without exposing its contents.')
if configured or os.getenv('EARTHDATA_TOKEN') or os.getenv('EARTHDATA_ACCESS_TOKEN') or (os.getenv('EARTHDATA_USERNAME') and os.getenv('EARTHDATA_PASSWORD')):
    raise SystemExit('Credentials are configured. Use earthdata_capture.py for authenticated acquisition; this unauthenticated probe cannot validate them.')
products=[('smap-surface','SPL3SMP_E','006'),('smap-rootzone','SPL4SMGP','008'),('imerg','GPM_3IMERGHH','07')]
report={'checkedAt':'2026-11-12','authentication':'unavailable: no environment pair, token or Earthdata netrc entry','products':[]}
for key,name,version in products:
 row={'id':key,'product':name,'version':version,'representativeFileAcquired':False,'failedStep':'credential-resolution','operatorAction':'Configure Earthdata Login environment/netrc credentials outside the repository and authorize the requested DAAC application (GES DISC for IMERG).'}
 try:
  q=urllib.parse.urlencode({'short_name':name,'version':version,'temporal':'2024-06-01T00:00:00Z,2024-06-01T23:59:59Z','bounding_box':'-93.654,42.022,-93.646,42.028','page_size':1})
  body=json.load(urllib.request.urlopen('https://cmr.earthdata.nasa.gov/search/granules.json?'+q,timeout=60))
  entries=body['feed']['entry'];row['catalogMatchesInPage']=len(entries)
  if entries:
   e=entries[0];row['granuleId']=e['id'];row['producerGranuleId']=e.get('producer_granule_id')
   links=[l['href'] for l in e.get('links',[]) if 'data#' in l.get('rel','') and l.get('href','').startswith('https://') and not l.get('inherited')]
   if links:
    url=links[0];row['sourceUrl']=url.split('?')[0]
    try:
     with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':'bytes=0-31'}),timeout=60) as response:
      prefix=response.read(32);row['httpStatus']=response.status;row['responseContentType']=response.headers.get('Content-Type');row['scientificMagicDetected']=prefix.startswith(b'\x89HDF') or prefix.startswith(b'CDF');row['finalHost']=urllib.parse.urlsplit(response.url).hostname
    except urllib.error.HTTPError as error:row['httpStatus']=error.code
 except Exception as error:row['probeFailureType']=type(error).__name__
 report['products'].append(row);print(key,row.get('httpStatus'),row.get('probeFailureType'),'no scientific file acquired',flush=True)
Path('frontend/public/atlas/access-attempt.json').write_text(json.dumps(report,indent=2)+'\n')
