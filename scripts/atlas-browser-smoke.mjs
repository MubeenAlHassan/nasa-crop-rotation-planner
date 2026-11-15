// Dependency-free Chrome DevTools smoke test. Uses a fresh temporary browser profile.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,readFile,rm} from 'node:fs/promises';
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

 const control=async(label,value,tag='select')=>evaluate(`(()=>{const l=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));const e=l?.querySelector(${JSON.stringify(tag)});if(!e)throw Error('Control missing: '+${JSON.stringify(label)});const prototype=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-strategy .ra-badge')).every(e=>e.textContent==='UNKNOWN')`))throw Error('Initial unknown constraints were silently resolved');
 await click('Farm assumptions');
 for(const label of ['Boundary is the intended cropped field','I confirm this baseline and management history','Labor available for these operations','Cover sowing and termination equipment','Small-grain buyer confirmed','Small-grain equipment available','Small grains suit the field and local calendar','Forage buyer or on-farm use confirmed','Forage equipment available','Alfalfa suits drainage, pH and restrictions'])await control(label,'true');
 await control('Maximum annual operating cost',4000,'input');
 await control('Available soil water capacity','','input');
 await until(`document.body.innerText.includes('Enter soil-water capacity')`);
 await control('Available soil water capacity',160,'input');
 await control('Forage buyer or on-farm use confirmed','false');
 await until(`document.querySelectorAll('.ra-strategy')[3].textContent.includes('FAIL')`);
 await control('Forage buyer or on-farm use confirmed','unknown');
 await until(`document.querySelectorAll('.ra-strategy')[3].textContent.includes('UNKNOWN')&&document.querySelector('.ra-current-choice').textContent.includes('Preference withheld')`);
 await control('Forage buyer or on-farm use confirmed','true');
 await click('Apply to all four rotations');
 // One end-to-end demonstration fixture; never asserted as actual scouting.
 await click('Field history & windows');await until(`!!document.querySelector('.ra-history')`);
 await control('Window start','2024-06-11','input');await control('Window end','2024-06-23','input');
 await control('Local observation / uncertainty note','Audit demonstration fixture: uncertain cover; no real scouting claimed.','textarea');await click('Save historical window');
 await until(`document.querySelector('.ra-history-exposure')!==null`);
 await click('Correct window');await control('Window evidence status','farmer-confirmed','select');await control('Ground condition','bare-soil','select');
 await control('Local observation / uncertainty note','Audit demonstration fixture only: exercising farmer review, not a measured bare-soil observation.','textarea');await click('Save historical window');
 await until(`document.querySelector('.ra-history-record .ra-badge')?.textContent==='farmer-confirmed'`);
 await click('Compare rotations');
 await control('More living-cover days',5,'input');await control('Less unmet crop water demand',0,'input');await control('Higher gross margin',0,'input');
 const coverPreference=await evaluate(`document.querySelector('.ra-current-choice strong').textContent`);
 await control('Less unmet crop water demand',5,'input');await control('More living-cover days',0,'input');
 const waterPreference=await evaluate(`document.querySelector('.ra-current-choice strong').textContent`);
 if(coverPreference===waterPreference||waterPreference==='Preference withheld')throw Error('Priority change did not change preference');
 if(await evaluate(`document.querySelectorAll('.ra-active-detail .ra-season').length`)!==4)throw Error('Four-year timeline incomplete');
 await control('Farmer’s selection','cover');await control('Farmer corrections','Browser verification draft: confirm residue and drainage locally.','textarea');
 await evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith('I reviewed the uncertainty')).querySelector('input').click()`);
 await call('Emulation.setDeviceMetricsOverride',{width:1024,height:1366,deviceScaleFactor:1,mobile:false});await pause(200);
 if(await evaluate('document.documentElement.scrollWidth>window.innerWidth'))throw Error('Tablet horizontal overflow');
 if(await evaluate(`document.querySelector('.ra-heading').getBoundingClientRect().left<document.querySelector('.ra-sidebar').getBoundingClientRect().right`))throw Error('Tablet content hidden behind sidebar');
 let tablet=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-tablet.png'),Buffer.from(tablet.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await click('Evidence & method');await until(`document.body.innerText.includes('Landsat · dated observations')`);
 if(!await evaluate(`document.body.innerText.includes('insufficient-coverage')&&document.body.innerText.includes('186.4')&&document.body.innerText.includes('NASADEM')`))throw Error('Evidence QA and soil data not visible');
 let evidenceShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-evidence.png'),Buffer.from(evidenceShot.data,'base64'));
 await click('Field overview');await evaluate(`(()=>{const select=document.querySelector('[aria-label="Map evidence layer"]');select.value='landsat';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until(`document.querySelectorAll('.ra-map svg path').length>400`);
 let mapShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-landsat-map.png'),Buffer.from(mapShot.data,'base64'));
 await evaluate(`(()=>{const select=document.querySelector('[aria-label="Map evidence layer"]');select.value='soils';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await until(`document.querySelector('.ra-map-note').textContent.includes('Survey polygons')`);
 // Edited boundaries must not inherit old field observations.
 await control('Closed longitude/latitude coordinate ring',JSON.stringify([[-93.653,42.023],[-93.647,42.023],[-93.647,42.027],[-93.653,42.027],[-93.653,42.023]]),'textarea');
 await click('Apply coordinates');await until(`document.body.innerText.includes('Boundary differs from the captured package')`);
 if(!await evaluate(`document.querySelector('option[value="landsat"]').disabled`))throw Error('Old field evidence enabled on a new boundary');
 await click('Restore captured demo boundary');await click('Farm assumptions');await control('Boundary is the intended cropped field','true');await control('I confirm this baseline and management history','true');await click('Apply to all four rotations');
 await click('Compare rotations');
 await evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith('I reviewed the uncertainty')).querySelector('input').click()`);
 await evaluate(`document.querySelector('.ra-four-year').scrollIntoView()`);
 let matrixShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-four-year-matrix.png'),Buffer.from(matrixShot.data,'base64'));
 await click('Find the turning points');await until(`document.querySelectorAll('.ra-sweep-track > div').length===11`);
 // Exercise non-color chart meaning and actual keyboard focus in forced colors.
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-sweep-track > div')).every(e=>['Current rotation','Winter cover','Grain + legume','Forage phase','Preference withheld'].some(label=>e.textContent.includes(label)))`))throw Error('Sensitivity cells lack visible rotation labels');
 await call('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
 await call('Page.bringToFront');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await evaluate(`document.querySelector('.ra-selected').focus()`);
 for(const modifiers of [0,8]){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers});}
 const focus=await evaluate(`(()=>{const e=document.querySelector('.ra-selected'),s=getComputedStyle(e);return {visible:e.matches(':focus-visible'),style:s.outlineStyle,width:s.outlineWidth,selected:e.querySelector('.ra-selection-label').textContent.includes('Inspecting')};})()`);
 if(!focus.visible||focus.style!=='dashed'||focus.width!=='2px'||!focus.selected)throw Error('Forced-colors focus/selection failed: '+JSON.stringify(focus));
 const forced=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-forced-colors.png'),Buffer.from(forced.data,'base64'));
 await call('Emulation.setEmulatedMedia',{features:[]});
 await click('Save on this device');await until(`localStorage.getItem('rotation-atlas-decision-v1')!==null`);
 await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);
 await call('Page.setDownloadBehavior',{behavior:'allow',downloadPath:artifacts});await rm(path.join(artifacts,'rotation-atlas-decision.json'),{force:true});await click('Export report');await click('JSON');
 const download=async name=>{for(let i=0;i<100;i++){try{return await readFile(path.join(artifacts,name));}catch{await pause(100);}}throw Error('Download did not finish: '+name);};
 const report=JSON.parse((await download('rotation-atlas-decision.json')).toString('utf8'));if(report.result.strategies.length!==4||report.result.sensitivity.tested!==34||report.request.decision.selection!=='cover'||report.fieldEvidence.observations.length<=3||report.result.strategies[0].members.length!==3)throw Error('Incomplete report export');
 if(report.request.history.windows.length!==1||report.request.history.windows[0].status!=='farmer-confirmed'||!report.comparisonBasis.rotations.includes('not satellite-generated'))throw Error('Reviewed demonstration window or comparison limitations lost in export');
 for(const [label,extension,marker] of [['Excel','xls','<Workbook'],['Word','doc','<html'],['PDF','pdf','%PDF-1.4']]){
  const filename=`rotation-atlas-decision-${report.createdAt.slice(0,10)}.${extension}`;
  await rm(path.join(artifacts,filename),{force:true});await click('Export report');await click(label);
  const bytes=await download(filename),text=bytes.toString('utf8');
  if(!text.includes(marker)||!text.includes('Rotation Atlas decision report'))throw Error('Invalid '+label+' download');
  if(extension==='pdf'){
   const offset=Number(/startxref\n(\d+)/.exec(text)?.[1]);
   if(bytes.subarray(offset,offset+4).toString()!=='xref')throw Error('PDF cross-reference byte offset is wrong');
  }
 }
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-comparison.png'),Buffer.from(shot.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(200);
 if(await evaluate('document.documentElement.scrollWidth>window.innerWidth'))throw Error('Mobile horizontal overflow');
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-mobile.png'),Buffer.from(shot.data,'base64'));
 await setOffline(true);await call('Page.reload');await until(`document.querySelectorAll('.ra-stat').length===4`);await until(`navigator.onLine===false`);if(!await evaluate(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).request.history.windows[0].note.includes('Audit demonstration fixture')`))throw Error('Reviewed window lost offline');await until(`Array.from(document.querySelectorAll('option')).some(e=>e.value==='landsat'&&!e.disabled)`);
 await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
 await click('Find the turning points');await until(`document.querySelectorAll('.ra-sweep-track > div').length===11`);
 if(serverMode){await click('Save on this device');await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);await setOffline(false);await until(`JSON.parse(localStorage.getItem('rotation-atlas-decision-v1')).pending===false`);await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:base+'/'});await until(`document.querySelector('.ra-landing-hero')!==null`);
 if(await evaluate(`document.body.innerText.includes('Field Shift')||Array.from(document.querySelectorAll('a[href]')).some(a=>/^\\/(planner|weather)(?:[/?#]|$)/.test(new URL(a.href).pathname))`))throw Error('Legacy branding or navigation on landing page');
 await evaluate(`document.querySelector('#approach').scrollIntoView()`);await until(`document.querySelector('.ra-revealed')!==null`);
 await evaluate(`window.__atlasNavigationMarker='client-route';document.querySelector('a[href="/atlas"]').click()`);await until(`document.querySelectorAll('.ra-stat').length===4`);
 if(await evaluate(`window.__atlasNavigationMarker`)!=='client-route')throw Error('Landing link caused a document reload');
 await evaluate(`document.querySelector('.ra-brand').click()`);await until(`document.querySelector('.ra-landing-hero')!==null`);
 if(await evaluate(`window.__atlasNavigationMarker`)!=='client-route')throw Error('Workspace link caused a document reload');
 await evaluate(`window.scrollTo(0,0)`);
 const home=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,'atlas-landing.png'),Buffer.from(home.data,'base64'));}
 if([...requests.values()].some(url=>url.includes('/api/atlas/decisions')))throw Error('Device-local demo attempted server decision sync');
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 const verification={desktop:'passed',reviewedWindow:'Labeled demonstration fixture reviewed before comparison, retained in export and offline reopening',chartLabels:'non-color labels and tables',forcedColors:'keyboard focus and selection passed',comparison:'4 strategies, 4 years, paired members, tri-state feasibility, priority reversal, independent farmer selection',sensitivity:'34 cases',export:'JSON, Excel, Word and PDF downloaded; PDF byte offset valid',mobile:'no overflow at 390px; tablet 1024px passed',evidence:'Landsat/soil/elevation visible; QA withheld; edited-boundary gating passed',offline:'reload and recalculation passed',serverSync:'disabled; device-local save survives offline/reconnect',retiredRoutes:serverMode?'404; landing navigation clean':'not applicable to static hosting',browserExceptions:errors,artifacts};await writeFile(path.join(artifacts,'atlas-browser-verification.json'),JSON.stringify(verification,null,2));console.log(JSON.stringify(verification,null,2));
}finally{if(ws?.readyState===1)ws.send(JSON.stringify({id:++counter,method:'Browser.close'}));await pause(200);ws?.close();chrome.kill('SIGTERM');}
