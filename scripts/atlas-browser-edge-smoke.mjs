// Fresh-profile UI checks for accessibility, input failures and damaged storage.
// Drafts and test strings never leave this browser profile.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
const base=process.argv[2]||'http://127.0.0.1:4173';
const out=path.resolve(process.argv[3]||'artifacts/live-audit/edges');await mkdir(out,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'atlas-edges-'));
const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map(),errors=[],networkFailures=[],checks=[],failures=[],accessibility=[];
try {
  let target;
  for(let i=0;i<60;i++){
    try{const port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(target)break;}catch{}
    await pause(100);
  }
  assert(target,'Chrome unavailable');ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    else if(m.method==='Network.loadingFailed')networkFailures.push(m.params);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async(expression,timeout=60_000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out '+expression+'; body='+await evaluate('document.body.innerText.slice(0,1500)'));};
  const check=async(name,run)=>{try{checks.push({name,...await run(),status:'passed'});}catch(error){failures.push({name,error:error.message});console.error(name+': '+error.message);}};
  const viewport=width=>call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  const click=async text=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Missing button '+${JSON.stringify(text)});b.click();})()`);
  const control=async(label,value)=>evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const e=l?.querySelector('input');if(!e)throw Error('Missing control');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const shot=async name=>{await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(r.data,'base64'));};
  const scan=async name=>{
    // Freeze transitions while measuring contrast; reveal animations can
    // otherwise produce transient blended colors while axe scrolls the page.
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate(axe);
    const result=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length,incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))}))`);
    accessibility.push({name,...result});
    assert.equal(result.violations.length,0,name+': '+result.violations.map(v=>v.id+' ('+v.nodes.length+')').join(', '));
  };
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Page.bringToFront');await viewport(1440);
  const start=performance.now();await call('Page.navigate',{url:base+'/'});
  // Server HTML can exist before its stylesheet. Its default opacity is also
  // 1, so waiting only on opacity can capture the beginning of the real fade.
  await until(`document.readyState==='complete'&&!!document.querySelector('.ra-landing-hero h1')`);
  await evaluate('document.fonts.ready.then(()=>true)');
  await until(`document.querySelector('.ra-landing-hero h1')&&getComputedStyle(document.querySelector('.ra-landing-hero h1')).opacity==='1'`);
  await check('landing visible after animation',async()=>{
    await until(`[...document.querySelectorAll('.ra-anim')].every(e=>getComputedStyle(e).opacity==='1')`);
    await shot('landing-desktop.png');return {loadMs:Math.round(performance.now()-start)};
  });
  await check('landing accessibility',()=>scan('Landing'));
  await check('landing widths 320–1920',async()=>{
    for(const width of [320,360,390,768,1024,1440,1920]){
      await viewport(width);await pause(100);
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Landing overflow '+width);
      if(width===320)await shot('landing-320.png');
    }
  });
  await check('reduced motion keeps content visible',async()=>{
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await call('Page.reload');await until(`document.querySelector('.ra-landing-hero h1')&&getComputedStyle(document.querySelector('.ra-landing-hero h1')).opacity==='1'`);
    assert(await evaluate(`[...document.querySelectorAll('.ra-anim,.ra-reveal')].every(e=>getComputedStyle(e).opacity==='1'&&getComputedStyle(e).animationName==='none')`));
    await call('Emulation.setEmulatedMedia',{features:[]});
  });
  await viewport(1440);const workspaceStart=performance.now();await call('Page.navigate',{url:base+'/atlas/'});
  await until(`document.querySelectorAll('.ra-stat').length===4`);
  checks.push({name:'fresh workspace load',status:'passed',loadMs:Math.round(performance.now()-workspaceStart)});
  await until(`document.body.textContent.includes('Offline pack ready')`);
  for(const [label,selector] of [['Field overview','.ra-stat'],['Compare rotations','.ra-strategy'],['Field history & windows','.ra-history-timeline'],['Evidence & method','.ra-adviser-assumptions']]){
    await click(label);await until(`!!document.querySelector(${JSON.stringify(selector)})`);
    await check(label+' accessibility',()=>scan(label));
    await check(label+' widths 320–1920',async()=>{
      for(const width of [320,360,390,768,1024,1440,1920]){
        await viewport(width);await pause(100);
        if(width===320)await shot(label.split(' ')[0].toLowerCase()+'-320.png');
        const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1?[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.right>innerWidth+1&&r.width>0&&s.position!=='fixed'&&!e.closest('.ra-table-scroll')}).slice(0,15).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,80)})):[]`);
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),label+' overflow '+width+' '+JSON.stringify(overflow));
      }
    });
    await viewport(320);await check(label+' narrow-screen accessibility',()=>scan(label+' at 320px'));
    await viewport(1440);
  }
  await check('farm dialog accessibility at desktop and phone widths',async()=>{
    await click('Farm assumptions');await until(`!!document.querySelector('.ra-modal')`);
    await scan('Farm assumptions');await viewport(320);await scan('Farm assumptions at 320px');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Farm dialog overflow');
  });
  await evaluate(`document.querySelector('[aria-label="Close assumptions"]')?.click()`);await viewport(1440);
  await check('farm dialog keyboard focus',async()=>{
    await evaluate(`document.querySelector('.ra-sidebar-settings').focus();document.querySelector('.ra-sidebar-settings').click()`);
    await until(`!!document.querySelector('.ra-modal')`);
    assert(await evaluate(`document.activeElement===document.querySelector('[aria-label="Close assumptions"]')`),'Dialog did not focus close control');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
    assert(await evaluate(`document.activeElement===document.querySelector('.ra-modal > .ra-full')`),'Reverse Tab escaped dialog');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert(await evaluate(`document.activeElement===document.querySelector('[aria-label="Close assumptions"]')`),'Forward Tab escaped dialog');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until(`!document.querySelector('.ra-modal')`);
    assert(await evaluate(`document.activeElement===document.querySelector('.ra-sidebar-settings')`),'Focus not restored to assumptions opener');
  });
  // A failed dialog check must not leave it open for the next independent check.
  await evaluate(`document.querySelector('[aria-label="Close assumptions"]')?.click()`);
  await check('invalid and missing inputs withhold results, then recover',async()=>{
    await click('Farm assumptions');
    for(const [label,value,reason] of [['Available soil water capacity',-1,'Soil capacity must be'],['Available soil water capacity','','Enter soil-water capacity'],['Available soil water capacity',261,'Soil capacity must be']]){
      await control(label,value);await until(`document.querySelector('.ra-modal .ra-issues')?.textContent.includes(${JSON.stringify(reason)})`);
      assert(await evaluate(`!document.querySelectorAll('.ra-strategy').length`),'Stale model cards retained');
    }
    await control('Available soil water capacity',160);await until(`!document.querySelector('.ra-modal .ra-issues')`);
    await control('Initial available-water fraction',1.1);await until(`!!document.querySelector('.ra-modal .ra-issues')`);
    await control('Initial available-water fraction',.5);await until(`!document.querySelector('.ra-modal .ra-issues')`);
    await control('Field name','<img src=x onerror="window.__auditXss=1">');
    await click('Apply to all four rotations');assert.equal(await evaluate('window.__auditXss'),undefined);
    assert(await evaluate(`document.querySelector('.ra-field-pill').textContent.includes('<img src=x')`),'Field name did not remain plain text');
    await click('Save on this device');await call('Page.reload');await until(`document.querySelectorAll('.ra-stat').length===4`);
    assert.equal(await evaluate('window.__auditXss'),undefined);
    assert(await evaluate(`document.querySelector('.ra-field-pill').textContent.includes('<img src=x')`),'Saved name not restored');
  });
  await check('corrupt and unsupported device drafts fall back safely',async()=>{
    for(const text of ['{','{"schema":999}','{"schema":1,"request":{"horizon":{"startYear":2027,"years":4},"field":{"name":"damaged"}}}']){
      await evaluate(`localStorage.setItem('rotation-atlas-decision-v1',${JSON.stringify(text)})`);
      await call('Page.reload');await until(`document.querySelectorAll('.ra-stat').length===4`);
      assert(await evaluate(`document.querySelector('.ra-field-pill').textContent.includes('Prairie Creek')`),'Invalid draft restored');
    }
  });
  await check('blocked device storage reports failure and keeps workspace usable',async()=>{
    await evaluate(`Storage.prototype.setItem=function(){throw new DOMException('Audit fixture: quota exceeded','QuotaExceededError')}`);
    await click('Save on this device');await until(`document.querySelector('.ra-notice')?.textContent.includes('quota exceeded')`);
    await click('Compare rotations');await until(`document.querySelectorAll('.ra-strategy').length===4`);
  });
  if(errors.length)failures.push({name:'browser exceptions',errors});
  const result={base,checkedAt:new Date().toISOString(),checks,accessibility,networkFailures,errors,failures};
  await writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({checks:checks.length,accessibility:accessibility.map(a=>({name:a.name,violations:a.violations.map(v=>v.id)})),failures},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  if(ws?.readyState===1)ws.send(JSON.stringify({id:++id,method:'Browser.close'}));
  await pause(200);ws?.close();chrome.kill('SIGTERM');await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
