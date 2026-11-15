"""Independent arithmetic/coverage checks and isolated replay of every published month."""
import json,hashlib,tempfile,math
from pathlib import Path
from datetime import datetime
from nasa_season_process import build
ROOT=Path('frontend/public/atlas');CACHE=Path('backend/.provider_cache/nasa-season')
def seconds(t):return datetime.fromisoformat(t.replace('Z','+00:00')).timestamp()
def verify():
 reports=[]
 for entry in json.loads((ROOT/'nasa-season-index.json').read_text())['months']:
  p=ROOT/'nasa-season'/f"{entry['month']}.json";raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==entry['sha256'];d=json.loads(raw);a=seconds(d['start']);b=seconds(d['end']);seen=set()
  for r in d['imerg']:
   x,y=seconds(r['start']),seconds(r['end']);assert a<=x<y<=b and y-x==1800 and (x,y) not in seen;seen.add((x,y))
  for day in d['days']:
   rows=[r for r in d['imerg'] if r['start'].startswith(day['date'])]
   for i in range(9):
    valid=[r for r in rows if r['values'][i] is not None];s=sum(r['values'][i]*(seconds(r['end'])-seconds(r['start']))/3600 for r in valid);published=day['rain'][i];assert published['validSeconds']==len(valid)*1800
    assert (published['totalMm'] is None)==(len(valid)!=48)
    if valid:assert math.isclose(s,published['partialMm'],abs_tol=1e-9)
    roots=[r['root'][i] for r in d['rootZone'] if r['start'].startswith(day['date']) and r['root'][i] is not None];assert day['root'][i]['validIntervals']==len(roots)
    if len(roots)==8:assert math.isclose(sum(roots)/8,day['root'][i]['mean'],abs_tol=1e-12)
  with tempfile.TemporaryDirectory() as temp:
   build(CACHE,Path(temp)/'nasa-season',d['start'][:10],d['days'][-1]['date']);assert (Path(temp)/'nasa-season'/p.name).read_bytes()==raw
  reports.append({'month':d['month'],'sha256':entry['sha256'],'coverage':d['coverage'],'completeRainDays':sum(v['rain'][4]['totalMm'] is not None for v in d['days']),'validL3Pilot':sum(r['values'][4] is not None for r in d['smap']),'validL4Pilot':sum(r['root'][4] is not None for r in d['rootZone']),'replay':'byte-identical','independentAggregation':'all days and nine cells checked'})
 Path('artifacts').mkdir(exist_ok=True);Path('artifacts/nasa-campaign-replay.json').write_text(json.dumps(reports,indent=2)+'\n');return reports
if __name__=='__main__':print(json.dumps(verify()))
