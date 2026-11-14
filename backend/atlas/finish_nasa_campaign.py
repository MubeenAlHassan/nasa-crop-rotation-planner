"""Wait for the authorized campaign, then run delivery checks and record actual results.
No acquisition, deployment, or credential handling; safe to resume after interruption.
"""
import json,subprocess,sys,time,socket,urllib.request
from pathlib import Path
ROOT=Path.cwd();CACHE=ROOT/'backend/.provider_cache/nasa-season';ART=ROOT/'artifacts';ART.mkdir(exist_ok=True)
REPORT=ART/'nasa-season-delivery.json'
def record(d):REPORT.write_text(json.dumps(d,indent=2)+'\n')
def main():
 state={'status':'waiting-for-acquisition','checks':[]};record(state)
 while True:
  checkpoint=json.loads((CACHE/'campaign-2024.json').read_text())
  if checkpoint.get('status')=='blocked':raise RuntimeError('Acquisition checkpoint blocked; inspect safeReason and monthly log')
  if checkpoint.get('status') in ['complete','partial']:break
  time.sleep(30)
 if checkpoint['status']!='complete' or len(checkpoint['months'])!=9:raise RuntimeError('Full seasonal coverage not acquired; retain completed packages')
 def check(name,cmd,cwd=ROOT):
  state['status']='verifying';state['activeCheck']=name;record(state)
  with (ART/('season-delivery-'+name+'.log')).open('w') as log:r=subprocess.run(cmd,cwd=cwd,stdout=log,stderr=log)
  state['checks'].append({'name':name,'exitCode':r.returncode});record(state)
  if r.returncode:raise RuntimeError('Verification failed: '+name)
 check('replay',[sys.executable,'backend/atlas/verify_nasa_campaign.py'])
 check('python',[sys.executable,'-m','unittest','discover','-s','backend/atlas','-p','test_*.py'])
 check('lint',['npm','run','lint'],ROOT/'frontend');check('build',['npm','run','build'],ROOT/'frontend')
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 with (ART/'season-delivery-server.log').open('w') as log:
  server=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',str(port)],cwd=ROOT/'frontend',stdout=log,stderr=log)
  try:
   base=f'http://127.0.0.1:{port}'
   for attempt in range(30):
    try:
     with urllib.request.urlopen(base+'/atlas/',timeout=2) as r:
      if r.status==200:break
    except Exception:time.sleep(1)
   else:raise RuntimeError('Local verification server did not start')
   for name in ['cross-month','season','ecostress','grace','history','browser']:
    check('browser-'+name,['node',f'scripts/atlas-{name}-smoke.mjs',base]+(['--server'] if name=='browser' else []))
   check('full-season-'+('static' if 'http.server' in server.args else 'production'),['node','scripts/atlas-cross-month-smoke.mjs',base,'--full-season']+(['--static'] if 'http.server' in server.args else []))
  finally:server.terminate();server.wait(timeout=15)
 # Also verify the actual standalone distribution; no API exists on this host.
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 with (ART/'season-delivery-static-server.log').open('w') as log:
  server=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(ROOT/'dist-atlas')],stdout=log,stderr=log)
  try:
   base=f'http://127.0.0.1:{port}'
   for attempt in range(30):
    try:
     with urllib.request.urlopen(base+'/atlas/',timeout=2) as r:
      if r.status==200:break
    except Exception:time.sleep(1)
   else:raise RuntimeError('Local static verification server did not start')
   for name in ['cross-month','browser']:
    check('static-'+name,['node',f'scripts/atlas-{name}-smoke.mjs',base,'--static'])
   check('full-season-'+('static' if 'http.server' in server.args else 'production'),['node','scripts/atlas-cross-month-smoke.mjs',base,'--full-season']+(['--static'] if 'http.server' in server.args else []))
  finally:server.terminate();server.wait(timeout=15)
 index=json.loads((ROOT/'frontend/public/atlas/nasa-season-index.json').read_text());state.update(status='verified',months=index['months']);state.pop('activeCheck',None);record(state)
 lines=['## Automated full-season delivery verification','', 'All nine March–November 2024 monthly packages passed acquisition checks and final', 'offline replay, Python tests, lint, production build/types/frontend tests and local', 'production cross-month/seasonal/ECOSTRESS/GRACE/history/rotation and standalone', 'static cross-month/rotation browser workflows. See', '`artifacts/nasa-season-delivery.json` and per-check logs for actual results.', '', '| Month | IMERG acquired / expected | L4 means | L3 accepted cell-times | Package bytes |','|---|---|---|---|---|']
 for m in index['months']:
  c=m['coverage'];lines.append(f"| {m['month']} | {c['acquired']['imerg']} / {c['expected']['imerg']} | {c['acquired']['rootZone']} | {c['smapAccepted']} | {m['bytes']} |")
 lines+=['','QA rejection is preserved; acquired counts do not imply field observations.', 'No forcing/scoring changes, interpolation, automatic cover/stress diagnosis, or', 'calibrated agronomic benefit is claimed. Earlier progress entries are historical.', '']
 plan=ROOT/'docs/IMPLEMENTATION_PLAN.md';text=plan.read_text();start='<!-- NASA-SEASON-AUTOVERIFY-START -->';end='<!-- NASA-SEASON-AUTOVERIFY-END -->';block=start+'\n'+'\n'.join(lines)+end+'\n'
 if start in text:
  a=text.index(start);b=text.index(end,a)+len(end);text=text[:a]+block+text[b:]
 else:text=text.replace('\n','\n\n'+block,1)
 plan.write_text(text);print(json.dumps({'status':'verified','months':9,'report':str(REPORT)}),flush=True)
if __name__=='__main__':
 try:main()
 except Exception as e:
  d=json.loads(REPORT.read_text()) if REPORT.exists() else {};d.update(status='blocked',errorType=type(e).__name__,safeReason=str(e) if isinstance(e,RuntimeError) else 'Inspect verification log');record(d);print(json.dumps(d),flush=True);raise SystemExit(1)
