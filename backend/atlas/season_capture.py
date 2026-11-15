"""Resume and register additional bounded Landsat seasons without replacing the 2024 pack."""
import argparse,json
from datetime import datetime
from pathlib import Path
from field_evidence_capture import Capture,GEOMETRY,QA_VERSION,dump,digest

def capture(out,start,end,offline):
    a=datetime.strptime(start,'%Y-%m-%d');b=datetime.strptime(end,'%Y-%m-%d')
    if not 0<=(b-a).days<=366:raise ValueError('Choose an ordered season of at most 367 days')
    base=json.loads((out/'field-evidence.json').read_text())
    if base['field']['geometry']!=GEOMETRY:raise ValueError('Pilot boundary mismatch')
    c=Capture(out,offline,False);observations,_,assets=c.landsat(start,end)
    path=out/'landsat-seasons.json';record=json.loads(path.read_text()) if path.exists() else {'schemaVersion':'landsat-seasons-v1','field':base['field'],'seasons':[]}
    if record['field']!=base['field']:raise ValueError('Registered seasons belong to another boundary')
    key=start+'_'+end
    for s in record['seasons']:
        if s['id']!=key and not (end<s['start'] or start>s['end']):raise ValueError('Registered seasons must not overlap')
    if not (end<base['season']['start'] or start>base['season']['end']):raise ValueError('Additional season overlaps the original captured period')
    season={'id':key,'start':start,'end':end,'catalogComplete':True,'qaPolicy':QA_VERSION,'minimumValidFraction':.8,'nativeSupportM':30,'observations':observations,'assets':assets,'summary':{'discovered':len(observations),'acquired':sum(o['validFraction'] is not None for o in observations),'usable':sum(o['status']=='available' for o in observations)},'provenance':{'pipeline':'backend/atlas/season_capture.py','pipelineSha256':digest(Path(__file__)),'nativeCaptureSha256':digest(Path(__file__).with_name('field_evidence_capture.py')),'verifiedAt':'2026-11-12','resumption':'Existing native windows reused; failed missing assets retried on connected runs. Original 2024 pack preserved.'}}
    record['seasons']=sorted([s for s in record['seasons'] if s['id']!=key]+[season],key=lambda s:s['start'])
    if (out/'access-attempt.json').exists():record['accessAttempt']=json.loads((out/'access-attempt.json').read_text())
    dump(path,record);print(json.dumps(season['summary']))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=Path('frontend/public/atlas'));p.add_argument('--start',required=True);p.add_argument('--end',required=True);p.add_argument('--offline',action='store_true');a=p.parse_args();capture(a.out,a.start,a.end,a.offline)
