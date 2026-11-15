"""Read-only CMR collection preflight; no login, downloads or credential contents."""
from pathlib import Path
import argparse
from field_evidence_capture import Capture,dump,digest
PRODUCTS=[('smap-surface','SPL3SMP_E','006'),('smap-rootzone','SPL4SMGP','008'),('imerg','GPM_3IMERGHH','07'),('ecostress-lst','ECO_L2T_LSTE','003'),('ecostress-et','ECO_L3T_JET','003'),('ecostress-esi','ECO_L4T_ESI','003'),('grace','TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4','RL06.3Mv04')]
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=Path('frontend/public/atlas'));p.add_argument('--offline',action='store_true');a=p.parse_args()
    c=Capture(a.out,a.offline,False);results=[]
    for key,name,version in PRODUCTS:
        try:
            data=c.json(f'access-{key}-{version}.json','https://cmr.earthdata.nasa.gov/search/collections.json',params={'short_name':name,'version':version,'page_size':20})
            entries=data.get('feed',{}).get('entry',[])
            results.append({'id':key,'requestedShortName':name,'requestedVersion':version,'status':'catalog-verified-file-pending' if entries else 'identifier-needs-review','collections':[{'id':e['id'],'title':e['title'],'version':e.get('version_id'),'timeStart':e.get('time_start'),'timeEnd':e.get('time_end'),'links':[l for l in e.get('links',[]) if l.get('href','').startswith('https://')]} for e in entries],'representativeFileChecked':False,'numericOutputsEnabled':False})
            print(key,len(entries),'matching collections; no numeric outputs enabled',flush=True)
        except Exception as e:
            if a.offline:raise
            results.append({'id':key,'status':'catalog-unavailable','errorType':type(e).__name__,'representativeFileChecked':False,'numericOutputsEnabled':False})
    dump(a.out/'access-status.json',{'checkedAt':'2026-11-08','documentation':'https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html','credentialSetup':'See backend/atlas/EARTHDATA_SETUP.md; setup remains outside the web application.','products':results,'pipelineSha256':digest(Path(__file__))})
if __name__=='__main__':main()
