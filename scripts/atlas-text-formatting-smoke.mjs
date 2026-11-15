// Browser fixtures are local draft entries, never captured scientific observations.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:4173';
const artifacts=path.resolve('artifacts/text-formatting');await mkdir(artifacts,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'text-formatting-chrome-'));
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
 const inspect=async selector=>evaluate(`(()=>{const section=document.querySelector(${JSON.stringify(selector)});if(!section)throw Error('Missing prose section '+${JSON.stringify(selector)});const lists=[...(section.matches('ul,ol')?[section]:[]),...section.querySelectorAll('ul:not(.ra-export-list),ol')];const paragraphs=Array.from(section.querySelectorAll('p')).filter(p=>p.textContent.length>80);return {lists:lists.length,items:section.querySelectorAll('li').length,paragraphs:paragraphs.length,correct:lists.every(list=>{const css=getComputedStyle(list);return css.listStyleType===(list.tagName==='OL'?'decimal':'disc')&&css.listStylePosition==='outside'&&parseFloat(css.paddingInlineStart)>=20&&css.maxInlineSize!=='none'&&Array.from(list.children).every(li=>parseFloat(getComputedStyle(li).marginBlockStart)>0);})&&paragraphs.every(p=>{const css=getComputedStyle(p);return parseFloat(css.fontSize)>=14&&parseFloat(css.lineHeight)/parseFloat(css.fontSize)>=1.6&&parseFloat(css.marginBlockStart)>0&&css.maxInlineSize!=='none';}),width:section.getBoundingClientRect().width};})()`);
 const capture=async(selector,name,topInset=0)=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'});window.scrollBy(0,-${topInset})`);await pause(150);const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,name),Buffer.from(shot.data,'base64'));};
 const checkHeadings=async selector=>{if(!await evaluate(`Array.from(document.querySelector(${JSON.stringify(selector)}).querySelectorAll('h2,h3,h4')).every(h=>{const css=getComputedStyle(h);return parseInt(css.fontWeight)>=600&&parseFloat(css.fontSize)>=(h.tagName==='H2'?20:16);})`))throw Error('Heading hierarchy lost in '+selector);};
 const checkComparisonGap=async()=>{const gap=await evaluate(`(()=>{const cards=document.querySelector('.ra-strategies'),panel=document.querySelector('.ra-strategies + .ra-window-connections');if(!cards||!panel)throw Error('Comparison sections missing');return panel.getBoundingClientRect().top-cards.getBoundingClientRect().bottom;})()`);if(Math.abs(gap-24)>.5)throw Error('Expected 24px between rotation cards and reviewed-window panel, got '+gap);};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:base+'/atlas/'});await until(`document.querySelectorAll('.ra-stat').length===4`);
 await click('Evidence & method');await until(`!!document.querySelector('.ra-adviser-assumptions')&&!!document.querySelector('.ra-field-evidence .ra-dataset-list')`);
 const adviser=await inspect('.ra-adviser-assumptions');if(!adviser.correct||adviser.items!==11)throw Error('Adviser list formatting incorrect '+JSON.stringify(adviser));
 const method=await inspect('.ra-method-steps');if(!method.correct||method.items!==5)throw Error('Method steps must have readable numbered markers '+JSON.stringify(method));
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-evidence .ra-insight strong')).every(e=>getComputedStyle(e).display==='inline')`))throw Error('Inline evidence emphasis breaks the sentence flow');
 const fieldEvidence=await inspect('.ra-field-evidence');if(!fieldEvidence.correct)throw Error('Field evidence text formatting incorrect '+JSON.stringify(fieldEvidence));
 await checkHeadings('.ra-evidence');await checkHeadings('.ra-field-evidence');
 await capture('.ra-method-steps','method-desktop.png');
 await capture('.ra-adviser-assumptions','adviser-desktop.png');
 await click('Compare rotations');await until(`!!document.querySelector('.ra-rationale')`);
 await checkComparisonGap();
 await capture('.ra-window-connections','comparison-section-gap-desktop.png',120);
 const rationale=await inspect('.ra-rationale');if(!rationale.correct)throw Error('Rationale list formatting incorrect');
 await checkHeadings('.ra-active-detail');
 const compare={};for(const selector of ['.ra-feasibility-review','.ra-model-notes','.ra-decision-review','.ra-window-connections','.ra-four-year']){compare[selector]=await inspect(selector);if(!compare[selector].correct)throw Error('Comparison text formatting incorrect '+selector+' '+JSON.stringify(compare[selector]));}
 await click('Download report');
 if(!await evaluate(`(()=>{const list=document.querySelector('.ra-decision-review .ra-export-list');return list&&getComputedStyle(list).listStyleType==='none'&&parseFloat(getComputedStyle(list).paddingInlineStart)===6&&Array.from(list.children).every(li=>parseFloat(getComputedStyle(li).marginBlockStart)===0);})()`))throw Error('Reading styles changed export-menu layout');
 await click('Download report');await capture('.ra-feasibility-review','farm-checks-desktop.png');
 if(!await evaluate(`Array.from(document.querySelectorAll('.ra-rationale li > em')).every(e=>getComputedStyle(e).display==='block')`))throw Error('Rationale limitations not separated');
 await capture('.ra-rationale','rationale-desktop.png');
 await click('Field history & windows');await until(`!!document.querySelector('.ra-nasa-context .ra-nasa-total')`);
 const detection=await inspect('.ra-detection-requirements'),nasa=await inspect('.ra-nasa-context');
 if(!detection.correct||detection.items!==4||!nasa.correct)throw Error('Detection or NASA list formatting incorrect');
 const history=await inspect('.ra-history');if(!history.correct)throw Error('History text formatting incorrect '+JSON.stringify(history));
 await checkHeadings('.ra-history');
 await capture('.ra-history > .ra-card','history-intro-desktop.png');
 await capture('.ra-detection-requirements','detection-desktop.png');await capture('.ra-nasa-context','nasa-desktop.png');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('History prose overflows phone page');
 for(const selector of ['.ra-detection-requirements','.ra-nasa-context'])if(!(await inspect(selector)).correct)throw Error('Mobile prose lost list formatting');
 await capture('.ra-detection-requirements','detection-mobile.png');
 if(!(await inspect('.ra-history')).correct)throw Error('History text formatting lost on mobile');
 await capture('.ra-history > .ra-card','history-intro-mobile.png');
 await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);await click('Compare rotations');
 await checkComparisonGap();
 await capture('.ra-window-connections','comparison-section-gap-mobile.png',120);
 if(!(await inspect('.ra-rationale')).correct)throw Error('Mobile rationale list incorrect');
 for(const selector of Object.keys(compare))if(!(await inspect(selector)).correct)throw Error('Comparison text formatting lost on mobile '+selector);
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Rationale overflows phone page');
 await capture('.ra-rationale','rationale-mobile.png');
 await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);await click('Evidence & method');
 if(!(await inspect('.ra-adviser-assumptions')).correct)throw Error('Mobile adviser list incorrect');
 if(!(await inspect('.ra-method-steps')).correct||!(await inspect('.ra-field-evidence')).correct)throw Error('Evidence text formatting lost on mobile');
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Adviser prose overflows phone page');
 await capture('.ra-adviser-assumptions','adviser-mobile.png');
 await capture('.ra-method-steps','method-mobile.png');
 if(errors.length)throw Error('Browser exceptions '+JSON.stringify(errors));
 const result={adviser,method,fieldEvidence,compare,rationale,detection,nasa,history,desktop:'bullets and numbered steps, hanging indents, readable paragraphs and bounded line lengths across all three pages',mobile:'all inspected sections retain formatting at 390px without page overflow',controls:'export menu remains an unbulleted compact control',limitations:'rationale limits appear on separate lines',errors};
 await writeFile(path.join(artifacts,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(ws?.readyState===1)ws.send(JSON.stringify({id:++id,method:'Browser.close'}));await pause(200);ws?.close();chrome.kill('SIGTERM');await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
