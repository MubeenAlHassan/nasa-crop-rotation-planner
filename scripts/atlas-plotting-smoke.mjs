// Browser fixtures are local draft entries, never captured scientific observations.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:4173';
const artifacts=path.resolve('artifacts/plotting');await mkdir(artifacts,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'plotting-chrome-'));
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
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 const snapshot=async(selector,name)=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await pause(150);const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,name),Buffer.from(shot.data,'base64'));};
 await call('Page.navigate',{url:base+'/atlas/'});
 await until(`document.querySelectorAll('.ra-chart-bar-pair').length===12&&document.body.innerText.includes('Offline pack ready')`);
 const rain=await evaluate(`(()=>{const pairs=Array.from(document.querySelectorAll('.ra-chart-bar-pair'));return pairs.every(p=>{const bars=p.querySelectorAll('span');return bars.length===2&&Math.abs(bars[0].getBoundingClientRect().height-bars[1].getBoundingClientRect().height)<.1;});})()`);
 if(!rain)throw Error('100% rainfall paired bars differ');
 // A temporary display fixture verifies that CSS never inflates a real zero.
 await evaluate(`(()=>{const b=document.querySelector('[data-rain-series="historical"]');b.style.height='0%';b.dataset.value='0';})()`);
 for(const forced of [false,true]){
  await call('Emulation.setEmulatedMedia',{features:forced?[{name:'forced-colors',value:'active'}]:[]});
  if(await evaluate(`document.querySelector('[data-rain-series="historical"]').getBoundingClientRect().height`)!==0)throw Error('Zero rainfall bar inflated'+(forced?' in forced colors':''));
 }
 await call('Emulation.setEmulatedMedia',{features:[]});
 await click('Compare rotations');await until(`document.querySelectorAll('.ra-season-months').length>=4`);
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-season')).every(row=>{const month=row.querySelectorAll('.ra-season-months span'),days=row.querySelectorAll('.ra-season-track span');const start=days[0].getBoundingClientRect().left,end=days[days.length-1].getBoundingClientRect().right;let count=0;return Array.from(month).every(m=>{const box=m.getBoundingClientRect();const expected=(end-start)*Number(m.style.flexGrow)/days.length;count+=Number(m.style.flexGrow);return Math.abs(box.width-expected)<1;})&&count===days.length;})`))throw Error('Calendar month widths differ from day tracks');
 await snapshot('.ra-timeline','crop-calendar.png');
 await click('Field history & windows');await until(`document.querySelector('.ra-history-timeline')!==null`);
 if(!await evaluate(`document.querySelectorAll('.ra-history-timeline circle[data-observation-id]').length===17&&document.querySelectorAll('.ra-history-timeline [data-withheld-id]').length===49`))throw Error('Historical QA marks differ from archive');
 await until(`Array.from(document.querySelectorAll('.ra-nasa-season select option')).some(o=>o.value==='2024-06')`);
 await control('NASA seasonal month','2024-06','select');await click('Load seasonal evidence');
 await until(`document.querySelectorAll('svg[aria-label^="Daily L4"] circle').length===30`);
 const root=await evaluate(`fetch('/atlas/nasa-season/2024-06.json').then(r=>r.json()).then(d=>Array.from(document.querySelectorAll('svg[aria-label^="Daily L4"] circle')).every(p=>{const raw=d.days.find(r=>r.date===p.dataset.date).root[4].mean;return Math.abs((135-Number(p.getAttribute('cy')))*.9/105-raw)<1e-10;}))`);
 if(!root)throw Error('Daily moisture points differ from source');
 await snapshot('svg[aria-label^="Daily L4"]','root-zone-series.png');
 await click('Load GRACE evidence');await until(`document.querySelectorAll('.ra-grace svg circle[data-month]').length===210`);
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-grace [data-year]')).every(t=>Math.abs(Number(t.getAttribute('x'))-(35+(Number(t.dataset.year)-2005)*12/239*710))<1e-8)`))throw Error('GRACE year ticks displaced');
 await click('Load ECOSTRESS evidence');await until(`document.querySelectorAll('.ra-ecostress svg polygon').length>100`);
 if(!await evaluate(`Array.from(document.querySelectorAll('svg')).every(svg=>Array.from(svg.querySelectorAll('*')).every(node=>Array.from(node.attributes).every(a=>!(/NaN|Infinity/.test(a.value)))))`))throw Error('Nonfinite rendered chart coordinates');
 await evaluate(`document.querySelector('.ra-grace svg[aria-label^="2005"]').scrollIntoView({block:'center'})`);
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,'grace-series.png'),Buffer.from(shot.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Graph page overflows mobile viewport');
 if(errors.length)throw Error('Browser exceptions '+JSON.stringify(errors));
 const result={rainfall:'paired heights agree at 100%; zero remains zero in normal and forced colors',calendar:'all four month axes match actual day-track widths, including leap year',history:'17 accepted values and 49 withheld dates on separate rows',moisture:'all 30 June points match source values',grace:'210 points and correctly placed year ticks',ecostress:'native cell map rendered with finite coordinates',mobile:'390px no page overflow',errors};
 await writeFile(path.join(artifacts,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(ws?.readyState===1)ws.send(JSON.stringify({id:++id,method:'Browser.close'}));await pause(200);ws?.close();chrome.kill('SIGTERM');await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
