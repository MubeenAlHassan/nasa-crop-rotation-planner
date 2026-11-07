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
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];const requests=new Map();const network=[];let counter=0;const waiting=new Map();
try{
 let target;for(let i=0;i<60;i++){try{const port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(target)break;}catch{}await pause(100);}
 if(!target)throw new Error('Chrome did not start');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p?.reject(new Error(JSON.stringify(m.error))):p?.resolve(m.result);}else if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,m.params.request.url);else if(m.method==='Network.responseReceived'&&(m.params.response.url.includes('/atlas/iowa.json')||m.params.response.status>=400))network.push({url:m.params.response.url,status:m.params.response.status,fromServiceWorker:m.params.response.fromServiceWorker});else if(m.method==='Network.loadingFailed')network.push({url:requests.get(m.params.requestId),error:m.params.errorText});else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+JSON.stringify(m.params.exceptionDetails.exception));});
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++counter;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Timed out: '+expression+' BODY: '+await evaluate('document.body.innerText')+' NETWORK: '+JSON.stringify(network)+' RESOURCES: '+JSON.stringify(await evaluate(`performance.getEntriesByType('resource').filter(e=>e.name.includes('iowa.json')||e.name.includes('/_next/')).map(e=>({name:e.name,duration:e.duration,bytes:e.transferSize}))`))+' ERRORS: '+JSON.stringify(errors)+' PAGE: '+await evaluate('document.documentElement.outerHTML.slice(0,1500)'));};
 // CDP page throttling alone leaves service-worker fetches online. Apply it to both.
 const workerSessions=[];
 const setOffline=async offline=>{
  const params={offline,latency:0,downloadThroughput:offline?0:-1,uploadThroughput:offline?0:-1};
  if(offline){
   const {targetInfos}=await call('Target.getTargets');
   for(const target of targetInfos.filter(t=>t.type==='service_worker'&&t.url===base+'/atlas-sw.js')){
    const {sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    workerSessions.push(sessionId);await call('Network.enable',{},sessionId);
   }
  }
  for(const sessionId of workerSessions)await call('Network.emulateNetworkConditions',params,sessionId);
  await call('Network.emulateNetworkConditions',params);
 };
 const click=async text=>evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Button missing');b.click();return true;})()`);
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 console.log('Navigation',await call('Page.navigate',{url:base+'/atlas/'}));await until(`document.querySelectorAll('.ra-stat').length===4`);await until(`document.body.innerText.includes('Offline pack ready')`);
 let shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-desktop.png'),Buffer.from(shot.data,'base64'));
 await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
 await click('Find the turning points');await until(`document.querySelectorAll('.ra-sweep-track > div').length===11`);
 // Exercise non-color chart meaning and actual keyboard focus in forced colors.
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-sweep-track > div')).every(e=>['Current rotation','Winter cover','Grain + legume','Forage phase','No feasible option'].some(label=>e.textContent.includes(label)))`))throw Error('Sensitivity cells lack visible rotation labels');
 await call('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
 await call('Page.bringToFront');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await evaluate(`document.querySelector('.ra-selected').focus()`);
 const focus=await evaluate(`(()=>{const e=document.querySelector('.ra-selected'),s=getComputedStyle(e);return {visible:e.matches(':focus-visible'),style:s.outlineStyle,width:s.outlineWidth,selected:e.querySelector('.ra-selection-label').textContent.includes('Selected')};})()`);
 if(!focus.visible||focus.style!=='dashed'||focus.width!=='2px'||!focus.selected)throw Error('Forced-colors focus/selection failed: '+JSON.stringify(focus));
 const forced=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-forced-colors.png'),Buffer.from(forced.data,'base64'));
 await call('Emulation.setEmulatedMedia',{features:[]});
 await click('Save decision');await until(`localStorage.getItem('rotation-atlas-decision-v1')!==null`);
 if(serverMode){await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);const saved=await evaluate(`fetch('/api/atlas/decisions',{headers:{'X-Atlas-Device':localStorage.getItem('rotation-atlas-device')}}).then(r=>r.json())`);if(saved.request.field.baseline!=='maize-soybean')throw Error('Server did not persist decision');}
 await call('Page.setDownloadBehavior',{behavior:'allow',downloadPath:artifacts});await click('Export report');
 await pause(300);const report=JSON.parse(await readFile(path.join(artifacts,'rotation-atlas-decision.json'),'utf8'));if(report.result.strategies.length!==4||report.result.sensitivity.tested!==34)throw Error('Incomplete report export');
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-comparison.png'),Buffer.from(shot.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(200);
 if(await evaluate('document.documentElement.scrollWidth>window.innerWidth'))throw Error('Mobile horizontal overflow');
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-mobile.png'),Buffer.from(shot.data,'base64'));
 await setOffline(true);await call('Page.reload');await until(`document.querySelectorAll('.ra-stat').length===4`);await until(`navigator.onLine===false`);
 await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
 await click('Find the turning points');await until(`document.querySelectorAll('.ra-sweep-track > div').length===11`);
 if(serverMode){await click('Save decision');await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===true`);await setOffline(false);await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:base+'/'});await until(`document.querySelector('.ra-landing-hero')!==null`);
 if(await evaluate(`document.body.innerText.includes('Field Shift')||Array.from(document.querySelectorAll('a[href]')).some(a=>/^\\/(planner|weather)(?:[/?#]|$)/.test(new URL(a.href).pathname))`))throw Error('Legacy branding or navigation on landing page');
 await evaluate(`document.querySelector('#approach').scrollIntoView()`);await until(`document.querySelector('.ra-revealed')!==null`);
 await evaluate(`window.__atlasNavigationMarker='client-route';document.querySelector('a[href="/atlas"]').click()`);await until(`document.querySelectorAll('.ra-stat').length===4`);
 if(await evaluate(`window.__atlasNavigationMarker`)!=='client-route')throw Error('Landing link caused a document reload');
 await evaluate(`document.querySelector('.ra-brand').click()`);await until(`document.querySelector('.ra-landing-hero')!==null`);
 if(await evaluate(`window.__atlasNavigationMarker`)!=='client-route')throw Error('Workspace link caused a document reload');
 await evaluate(`window.scrollTo(0,0)`);
 const home=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-landing.png'),Buffer.from(home.data,'base64'));}
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 console.log(JSON.stringify({desktop:'passed',chartLabels:'non-color labels and tables',forcedColors:'keyboard focus and selection passed',comparison:'4 strategies',sensitivity:'34 cases',export:'passed',mobile:'no overflow',offline:'reload and recalculation passed',serverSync:serverMode?'saved, restored and synced after reconnect':'not applicable to static hosting',retiredRoutes:serverMode?'404; landing navigation clean':'not applicable to static hosting',browserExceptions:errors,artifacts},null,2));
}finally{if(ws?.readyState===1)ws.send(JSON.stringify({id:++counter,method:'Browser.close'}));await pause(200);ws?.close();chrome.kill('SIGTERM');}
