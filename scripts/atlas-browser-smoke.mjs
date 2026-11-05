// Dependency-free Chrome DevTools smoke test. Uses a fresh temporary browser profile.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:4173';
const serverMode=process.argv.includes('--server');
const previewStatus=(await fetch(base+'/atlas/')).status;
if(previewStatus!==200)throw Error('Atlas preview returned '+previewStatus);
console.log('Preview response',previewStatus);
if(serverMode){
 for(const route of ['/planner','/planner?demo=1','/weather']){
  const response=await fetch(base+route);
  if(response.status!==404)throw Error('Retired route still served: '+route+' ('+response.status+')');
 }
}
const artifacts=path.resolve('artifacts');await mkdir(artifacts,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'atlas-chrome-'));
const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];let counter=0;const waiting=new Map();
try{
 let target;for(let i=0;i<60;i++){try{const port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(target)break;}catch{}await pause(100);}
 if(!target)throw new Error('Chrome did not start');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p?.reject(new Error(JSON.stringify(m.error))):p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+JSON.stringify(m.params.exceptionDetails.exception));});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Timed out: '+expression+' BODY: '+await evaluate('document.body.innerText')+' ERRORS: '+JSON.stringify(errors)+' PAGE: '+await evaluate('document.documentElement.outerHTML.slice(0,1500)'));};
 const click=async text=>evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Button missing');b.click();return true;})()`);
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 console.log('Navigation',await call('Page.navigate',{url:base+'/atlas/'}));await until(`document.querySelectorAll('.ra-stat').length===4`);await until(`document.body.innerText.includes('Offline pack ready')`);
 let shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-desktop.png'),Buffer.from(shot.data,'base64'));
 await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
 await click('Find the turning points');await until(`document.querySelectorAll('.ra-sweep-track > div').length===11`);
 await click('Save decision');await until(`localStorage.getItem('rotation-atlas-decision-v1')!==null`);
 if(serverMode){await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);const saved=await evaluate(`fetch('/api/atlas/decisions',{headers:{'X-Atlas-Device':localStorage.getItem('rotation-atlas-device')}}).then(r=>r.json())`);if(saved.request.field.baseline!=='maize-soybean')throw Error('Server did not persist decision');}
 await call('Page.setDownloadBehavior',{behavior:'allow',downloadPath:artifacts});await click('Export report');await until(`document.querySelector('.ra-export-menu')!==null`);await click('JSON');
 await pause(300);const report=JSON.parse(await readFile(path.join(artifacts,'rotation-atlas-decision.json'),'utf8'));if(report.result.strategies.length!==4||report.result.sensitivity.tested!==34)throw Error('Incomplete report export');
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-comparison.png'),Buffer.from(shot.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(200);
 if(await evaluate('document.documentElement.scrollWidth>window.innerWidth'))throw Error('Mobile horizontal overflow');
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-mobile.png'),Buffer.from(shot.data,'base64'));
 await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await call('Page.reload');await until(`document.querySelectorAll('.ra-stat').length===4`);await until(`navigator.onLine===false`);
 await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
 await click('Find the turning points');await until(`document.querySelectorAll('.ra-sweep-track > div').length===11`);
 if(serverMode){await click('Save decision');await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===true`);await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:base+'/'});await until(`document.querySelector('.ra-landing-hero')!==null`);
 if(await evaluate(`document.body.innerText.includes('Field Shift')||Array.from(document.querySelectorAll('a[href]')).some(a=>/^\\/(planner|weather)(?:[/?#]|$)/.test(new URL(a.href).pathname))`))throw Error('Legacy branding or navigation on landing page');
 const home=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-landing.png'),Buffer.from(home.data,'base64'));}
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 console.log(JSON.stringify({desktop:'passed',comparison:'4 strategies',sensitivity:'34 cases',export:'passed',mobile:'no overflow',offline:'reload and recalculation passed',serverSync:serverMode?'saved, restored and synced after reconnect':'not applicable to static hosting',retiredRoutes:serverMode?'404; landing navigation clean':'not applicable to static hosting',browserExceptions:errors,artifacts},null,2));
}finally{if(ws?.readyState===1)ws.send(JSON.stringify({id:++counter,method:'Browser.close'}));await pause(200);ws?.close();chrome.kill('SIGTERM');}
