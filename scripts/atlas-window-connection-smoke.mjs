// Browser fixtures are local draft entries, never captured scientific observations.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:4173';
const artifacts=path.resolve('artifacts/window-connections');await mkdir(artifacts,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'window-connection-chrome-'));
const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws,id=0;const pending=new Map(),errors=[];
try {
 let target;for(let i=0;i<60;i++){try{const port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(target)break;}catch{}await pause(100);}
 if(!target)throw Error('Chrome unavailable');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out '+expression+' '+await evaluate('document.body.innerText.slice(-5000)'));};
 const click=async text=>evaluate(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Missing button');b.click();})()`);
 const control=async(label,value,tag='input')=>evaluate(`(()=>{const l=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));const e=l?.querySelector(${JSON.stringify(tag)});if(!e)throw Error('Missing '+${JSON.stringify(label)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);

 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1024,height:1366,deviceScaleFactor:1,mobile:false});
 await call('Page.setDownloadBehavior',{behavior:'allow',downloadPath:artifacts});
 await call('Page.navigate',{url:base+'/atlas/'});
 await until(`document.querySelector('.ra-connection')?.textContent.includes('Offline pack ready')`);
 await click('Farm assumptions');
 for(const label of ['Boundary is the intended cropped field','I confirm this baseline and management history','Labor available for these operations','Cover sowing and termination equipment','Small-grain buyer confirmed','Small-grain equipment available','Small grains suit the field and local calendar','Forage buyer or on-farm use confirmed','Forage equipment available','Alfalfa suits drainage, pH and restrictions'])await control(label,'true','select');
 await control('Maximum annual operating cost',4000);await click('Apply to all four rotations');
 await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
 const before=await evaluate(`Array.from(document.querySelectorAll('.ra-strategy')).map(e=>e.innerText)`);
 await click('Review field history and ground conditions');
 await until(`document.querySelectorAll('.ra-history-observation-scroll tbody tr').length>3`);
 // High exploration threshold ensures the actual archive offers a review pair.
 // This is a workflow fixture, never asserted as measured bare soil.
 await control('Low NDVI review threshold',1);await control('Maximum review gap',32);await click('Apply history filters');
 await click('Review this uncertain interval');
 const dates=await evaluate(`Array.from(document.querySelectorAll('#history-window-form input[type=date]')).map(e=>e.value)`);
 await control('Window evidence status','farmer-confirmed','select');await control('Ground condition','bare-soil','select');
 await click('Save historical window');await until(`document.body.innerText.includes('Confirmation needs an observed cover condition')`);
 await control('Local observation / uncertainty note','Browser fixture only: exercising local review; no real field observation asserted.','textarea');
 await click('Save historical window');await until(`document.querySelector('.ra-window-connections')?.textContent.includes('review pair linked')`);
 if(!await evaluate(`document.querySelector('.ra-window-connections').textContent.includes('Additional scheduled cover')`))throw Error('Confirmed seasonal window not connected to a rotation');
 await click('Inspect Keep the soil covered');await until(`document.querySelector('.ra-selected h3')?.textContent==='Winter cover'`);
 const after=await evaluate(`Array.from(document.querySelectorAll('.ra-strategy')).map(e=>e.innerText)`);
 // Inspection labels may change; physical outcomes and scores must not.
 const normalize=rows=>rows.map(t=>t.replaceAll('Inspecting','Inspect rotation'));
 if(JSON.stringify(normalize(before))!==JSON.stringify(normalize(after)))throw Error('History altered existing rotation outcomes or scores');
 if(!await evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith('Farmer’s selection')).querySelector('select').value===''`))throw Error('Inspecting chose a rotation');
 await evaluate(`document.querySelector('.ra-window-connections').scrollIntoView({block:'start'})`);
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,'atlas-window-connection.png'),Buffer.from(shot.data,'base64'));
 await click('Save on this device');
 await rm(path.join(artifacts,'rotation-atlas-decision.json'),{force:true});await click('Export report');await click('JSON');
 let exported;for(let i=0;i<50;i++){try{exported=JSON.parse(await readFile(path.join(artifacts,'rotation-atlas-decision.json'),'utf8'));break;}catch{}await pause(100);}
 const connection=exported?.historyOpportunities?.[0];
 if(connection?.satelliteLink!=='linked-review-pair'||connection.observations.length!==2||connection.calendars.length!==4)throw Error('Export lost observation/local/calendar chain');
 if(!exported.result.strategies.every(s=>s.rationale.windowConnections.length===1))throw Error('Per-strategy rationale lost connection');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Window panel overflows mobile page');
 await evaluate(`document.querySelector('.ra-window-connections').scrollIntoView({block:'start'})`);
 const phone=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,'atlas-window-connection-mobile.png'),Buffer.from(phone.data,'base64'));
 // Disconnect both the page and its service worker before reloading.
 const {targetInfos}=await call('Target.getTargets');
 const offline={offline:true,latency:0,downloadThroughput:0,uploadThroughput:0};
 for(const target of targetInfos.filter(t=>t.type==='service_worker'&&t.url===base+'/atlas-sw.js')){
   const {sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
   await call('Network.enable',{},sessionId);await call('Network.emulateNetworkConditions',offline,sessionId);
 }
 await call('Network.emulateNetworkConditions',offline);await call('Page.reload');
 await until(`document.querySelectorAll('.ra-stat').length===4&&navigator.onLine===false`);
 await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);await click('Compare rotations');
 await until(`document.querySelector('.ra-window-connections')?.textContent.includes('review pair linked')`);
 await click('Review field history and ground conditions');await until(`document.querySelector('.ra-history-exposure')!==null`);
 await click('Correct window');await control('Ground condition','residue-present','select');
 await control('Local observation / uncertainty note','Browser fixture correction: residue present.','textarea');await click('Save historical window');
 await until(`document.querySelector('.ra-window-connections')?.textContent.includes('Other ground cover reported')`);
 if(await evaluate(`document.querySelector('.ra-window-connections table')!==null`))throw Error('Corrected residue still suggests a bare-soil opportunity');
 await click('Save on this device');
 if(!await evaluate(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).request.history.windows[0].cover==='residue-present'`))throw Error('Correction not persisted');
 if(errors.length)throw Error('Browser exceptions '+JSON.stringify(errors));
 const result={dates,chain:'actual QA-accepted Landsat pair -> explicit local fixture -> four seasonal calendars',guard:'confirmation requires local note; inspect does not choose',regression:'existing physical outcomes and scores unchanged',export:'JSON and every strategy rationale retain chain',offline:'saved chain reloads without network; correction removes opportunity and persists',mobile:'390px no page overflow',errors};
 await writeFile(path.join(artifacts,'atlas-window-connection-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(ws?.readyState===1)ws.send(JSON.stringify({id:++id,method:'Browser.close'}));await pause(200);ws?.close();chrome.kill('SIGTERM');await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
