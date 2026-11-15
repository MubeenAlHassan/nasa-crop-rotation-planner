"""Sequential monthly acquisition, isolated replay verification and atomic publication.
Resume by rerunning: cached subset hashes are rechecked and completed months skipped.
"""
import calendar,hashlib,json,os,shutil,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
CACHE=Path('backend/.provider_cache/nasa-season');PUBLIC=Path('frontend/public/atlas');STATUS=CACHE/'campaign-2024.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):
 t=p.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2)+'\n');t.replace(p)
def run():
 CACHE.mkdir(parents=True,exist_ok=True);state=json.loads(STATUS.read_text()) if STATUS.exists() else {'scope':'March–November 2024','months':{},'status':'running'}
 state['status']='running';write(STATUS,state)
 for month in range(3,12):
  key=f'2024-{month:02}';last=calendar.monthrange(2024,month)[1];start=key+'-01';end=f'{key}-{last:02}';old=state['months'].get(key,{})
  if old.get('status')=='verified' and (PUBLIC/'nasa-season'/f'{key}.json').exists() and sha(PUBLIC/'nasa-season'/f'{key}.json')==old.get('sha256') and old.get('processorSha256')==sha(Path('backend/atlas/nasa_season_process.py')):continue
  if shutil.disk_usage(CACHE).free<2*1024**3:raise RuntimeError('Less than 2 GiB free; stop before acquiring month')
  state['activeMonth']=key;state['months'][key]={'status':'acquiring','startedAt':datetime.now(timezone.utc).isoformat()};write(STATUS,state)
  print(json.dumps({'month':key,'stage':'acquiring'}),flush=True)
  log=CACHE/(key+'-campaign.log')
  with log.open('a') as stream:
   result=subprocess.run([sys.executable,'backend/atlas/nasa_season_acquire.py','--start',start,'--end',end,'--workers','2'],stdout=stream,stderr=stream)
  if result.returncode:raise RuntimeError('Acquisition setup failed; inspect sanitized monthly log')
  # Process and replay in isolated folders; no incomplete index publication.
  from nasa_season_process import build
  staging=CACHE/'processed-staging';replay=CACHE/'processed-replay'
  build(CACHE,staging/'nasa-season',start,end);build(CACHE,replay/'nasa-season',start,end)
  file=staging/'nasa-season'/f'{key}.json';other=replay/'nasa-season'/f'{key}.json'
  if file.read_bytes()!=other.read_bytes():raise RuntimeError('Independent replay mismatch')
  d=json.loads(file.read_text());cov=d['coverage'];failures=d['failures'];complete=all(cov['acquired'][k]==v for k,v in cov['expected'].items()) and not failures
  for r in d['imerg']:
   if r['start']<d['start'] or r['end']>d['end']:raise RuntimeError('Out-of-month rain interval')
  if sum(day['rain'][4]['totalMm'] is not None for day in d['days'])!=last and complete:complete=False
  target=PUBLIC/'nasa-season'/file.name;target.parent.mkdir(exist_ok=True);tmp=target.with_suffix('.tmp');shutil.copyfile(file,tmp);tmp.replace(target)
  item=next(m for m in json.loads((staging/'nasa-season-index.json').read_text())['months'] if m['month']==key)
  ip=PUBLIC/'nasa-season-index.json';index=json.loads(ip.read_text());index['months']=sorted([m for m in index['months'] if m['month']!=key]+[item],key=lambda m:m['month']);write(ip,index)
  report={'status':'verified' if complete else 'partial','sha256':sha(target),'bytes':target.stat().st_size,'coverage':cov,'processorSha256':sha(Path('backend/atlas/nasa_season_process.py')),'excludedSources':len(d.get('excludedSources',[])),'failures':len(failures),'completeRainDays':sum(x['rain'][4]['totalMm'] is not None for x in d['days']),'l3PilotAccepted':sum(r['values'][4] is not None for r in d['smap']),'subsetBytes':sum(s['bytes'] for s in d['sources']),'replay':'byte-identical','completedAt':datetime.now(timezone.utc).isoformat()};state['months'][key]=report;write(STATUS,state);print(json.dumps({'month':key,**report}),flush=True)
  if any(r.get('httpStatus') in [401,403,429] for r in failures):raise RuntimeError('Provider access/rate gate; retain verified/partial months and stop')
 state['status']='complete' if all(v['status']=='verified' for v in state['months'].values()) else 'partial';state.pop('activeMonth',None);write(STATUS,state)
if __name__=='__main__':
 try:run()
 except Exception as e:
  state=json.loads(STATUS.read_text()) if STATUS.exists() else {};state['status']='blocked';state['errorType']=type(e).__name__;state['safeReason']=str(e) if isinstance(e,RuntimeError) else 'Inspect sanitized acquisition/processing logs';write(STATUS,state);print(json.dumps({'status':'blocked','errorType':type(e).__name__,'reason':state['safeReason']}),flush=True);raise SystemExit(1)
