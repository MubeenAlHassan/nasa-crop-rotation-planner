// A second browser engine, driven by Firefox's built-in WebDriver BiDi endpoint.
// See https://developer.mozilla.org/en-US/docs/Web/WebDriver/How_to/Create_BiDi_connection
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const base=process.argv[2]||'http://127.0.0.1:4173';
const out=path.resolve(process.argv[3]||'artifacts/live-audit/firefox');await mkdir(out,{recursive:true});
// Snap Firefox has a private /tmp. A profile inside the checkout is visible
// to both Node and Firefox, and is removed when this isolated run finishes.
const profiles=path.join(root,'artifacts/firefox-profiles');await mkdir(profiles,{recursive:true});
const profile=await mkdtemp(path.join(profiles,'audit-'));
const browser=spawn(process.env.FIREFOX_BIN||'/usr/bin/firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port','0','about:blank'],{stdio:['ignore','ignore','pipe']});
let log='',ws,id=0,stop;browser.stderr.on('data',chunk=>{log+=chunk.toString();});
browser.on('error',error=>{log+='\n'+error.message;});
const pause=ms=>new Promise(r=>setTimeout(r,ms));const pending=new Map(),errors=[],pages=[],accessibility=[];
try {
  let endpoint;
  for(let i=0;i<200;i++){
    endpoint=log.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/)?.[1];
    if(endpoint)break;
    if(browser.exitCode!==null)throw Error('Firefox exited: '+log.slice(-1500));
    await pause(100);
  }
  assert(endpoint,'Firefox remote endpoint unavailable: '+log.slice(-1500));
  ws=new WebSocket(endpoint.replace(/\/$/,'')+'/session');
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.type==='error'?p?.reject(Error(m.error+': '+m.message)):p?.resolve(m.result);}
    else if(m.method==='log.entryAdded'&&m.params.level==='error'&&m.params.type==='javascript')errors.push(m.params);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  stop=()=>call('browser.close');
  const session=await call('session.new',{capabilities:{}});
  await call('session.subscribe',{events:['log.entryAdded']});
  const {context}=await call('browsingContext.create',{type:'tab'});
  const evaluate=async expression=>{
    const r=await call('script.evaluate',{expression:`(async()=>JSON.stringify(await (${expression})))()`,target:{context},awaitPromise:true});
    if(r.type==='exception')throw Error(r.exceptionDetails.text);
    return r.result.type==='undefined'?undefined:JSON.parse(r.result.value);
  };
  const until=async expression=>{const deadline=Date.now()+60_000;while(Date.now()<deadline){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out '+expression+' '+await evaluate('document.body.innerText.slice(-1500)'));};
  const viewport=width=>call('browsingContext.setViewport',{context,viewport:{width,height:1100},devicePixelRatio:1});
  const click=async text=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Missing button '+${JSON.stringify(text)});b.click();})()`);
  const control=async(label,value,tag='select')=>evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const e=l?.querySelector(${JSON.stringify(tag)});if(!e)throw Error('Missing input '+${JSON.stringify(label)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const screenshot=async name=>{const r=await call('browsingContext.captureScreenshot',{context,origin:'viewport',format:{type:'image/png'}});await writeFile(path.join(out,name),Buffer.from(r.data,'base64'));};
  const axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
  const scan=async name=>{
    // Only remove animation during accessibility measurements in this profile.
    await call('script.evaluate',{expression:`(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}.ra-anim,.ra-reveal{opacity:1!important;transform:none!important}';document.head.append(s)})()`,target:{context},awaitPromise:false});
    await call('script.evaluate',{expression:axe,target:{context},awaitPromise:false});
    const result=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),passes:r.passes.length}))`);
    accessibility.push({name,...result});assert.equal(result.violations.length,0,JSON.stringify({name,...result}));
  };
  await viewport(1440);await call('browsingContext.navigate',{context,url:base+'/',wait:'complete'});
  await until(`document.querySelector('.ra-landing-hero h1')&&getComputedStyle(document.querySelector('.ra-landing-hero h1')).opacity==='1'`);
  await scan('Landing');await screenshot('landing-desktop.png');
  await call('browsingContext.navigate',{context,url:base+'/atlas/',wait:'complete'});
  await until(`document.querySelectorAll('.ra-stat').length===4`);
  for(const label of ['Field overview','Compare rotations','Field history & windows','Evidence & method']){
    await viewport(1440);await click(label);
    if(label==='Field history & windows')await until(`!!document.querySelector('.ra-history-timeline')`);
    if(label==='Evidence & method')await until(`!!document.querySelector('.ra-field-evidence')`);
    await scan(label+' desktop');
    for(const width of [1440,390,320]){
      await viewport(width);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),label+' overflow '+width);
    }
    await scan(label+' 320px');pages.push(label);
    if(label==='Field history & windows'){
      assert.equal(await evaluate(`document.querySelectorAll('.ra-history-timeline circle[data-observation-id]').length`),17);
      assert.equal(await evaluate(`document.querySelectorAll('.ra-history-timeline [data-withheld-id]').length`),49);
    }
  }
  await viewport(1440);await click('Compare rotations');await click('Farm assumptions');
  for(const label of ['Boundary is the intended cropped field','I confirm this baseline and management history','Labor available for these operations','Cover sowing and termination equipment','Small-grain buyer confirmed','Small-grain equipment available','Small grains suit the field and local calendar','Forage buyer or on-farm use confirmed','Forage equipment available','Alfalfa suits drainage, pH and restrictions'])await control(label,'true');
  await control('Maximum annual operating cost',4000,'input');
  await control('Field name','Firefox isolated audit fixture','input');
  await control('Available soil water capacity','','input');await until(`document.querySelector('.ra-modal .ra-issues')?.textContent.includes('Enter soil-water capacity')`);
  await control('Available soil water capacity',160,'input');await click('Apply to all four rotations');
  await until(`document.querySelectorAll('.ra-strategy').length===4`);
  assert(await evaluate(`!document.querySelector('.ra-current-choice').textContent.includes('Preference withheld')`));
  await control('More living-cover days',5,'input');await control('Less unmet crop water demand',0,'input');await control('Higher gross margin',0,'input');
  const cover=await evaluate(`document.querySelector('.ra-current-choice strong').textContent`);
  await control('Less unmet crop water demand',5,'input');await control('More living-cover days',0,'input');
  const water=await evaluate(`document.querySelector('.ra-current-choice strong').textContent`);assert.notEqual(cover,water);
  await click('Save on this device');await call('browsingContext.navigate',{context,url:base+'/atlas/',wait:'complete'});
  await until(`document.querySelector('.ra-field-pill')?.textContent.includes('Firefox isolated audit fixture')`);
  await click('Field history & windows');await until(`Array.from(document.querySelectorAll('.ra-nasa-season select option')).some(o=>o.value==='2024-06')`);
  await control('NASA seasonal month','2024-06');await click('Load seasonal evidence');await until(`document.querySelectorAll('svg[aria-label^="Daily L4"] circle').length===30`);
  assert(await evaluate(`fetch('/atlas/nasa-season/2024-06.json').then(r=>r.json()).then(d=>[...document.querySelectorAll('svg[aria-label^="Daily L4"] circle')].every(p=>Math.abs((135-Number(p.getAttribute('cy')))*.9/105-d.days.find(r=>r.date===p.dataset.date).root[4].mean)<1e-10))`));
  await viewport(390);await scan('Loaded seasonal evidence 390px');await screenshot('seasonal-mobile.png');
  assert.equal(errors.length,0,JSON.stringify(errors));
  const result={base,browser:session.capabilities.browserName,version:session.capabilities.browserVersion,pages,viewports:[320,390,1440],comparison:'four strategies, unknown-input withholding, confirmed constraints and priority reversal',history:'17 accepted and 49 withheld Landsat dates; all 30 L4 points match source',persistence:'isolated device draft restored',accessibility,errors};
  await writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,accessibility:accessibility.map(r=>({name:r.name,violations:r.violations.length}))},null,2));
}finally{
  // Let Firefox shut itself down. Signals sent through a Snap launcher can
  // fail even when the browser and the test session are healthy.
  if(stop&&ws?.readyState===1)await stop();
  else if(browser.exitCode===null)browser.kill('SIGTERM');
  ws?.close();await pause(500);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
