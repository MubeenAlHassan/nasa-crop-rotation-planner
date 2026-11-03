import { ASSUMPTIONS, CROPS, MODEL_VERSION, STRATEGIES } from './catalog';
import type { ComparisonResult, CropId, DailyResult, EvidenceSeries, ScenarioRequest, SensitivityPoint, SensitivityResult, StrategyId, StrategyResult, WeatherDay, YearResult } from './types';
const clamp = (x:number, lo=0, hi=1) => Math.min(hi, Math.max(lo,x));
const mean = (xs:number[]) => xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
export function quantile(xs:number[], q:number):number { const a=[...xs].sort((x,y)=>x-y); const p=(a.length-1)*q; return a[Math.floor(p)]*(1-p%1)+a[Math.ceil(p)]*(p%1); }
const es = (t:number) => 0.6108*Math.exp(17.27*t/(t+237.3));

/** FAO-56 daily Penman-Monteith. Radiation MJ/m²/day; 2 m wind, mean RH approximation. */
export function referenceET(day:WeatherDay, latitude:number, elevation:number, warming=0):number {
  if ([day.tmin,day.tmax,day.rh,day.wind,day.solar].some(v=>v===null||!Number.isFinite(v))) throw new Error('Incomplete weather');
  const min=day.tmin!+warming, max=day.tmax!+warming, temp=(min+max)/2;
  const d=new Date(day.date+'T12:00:00Z'), j=Math.floor((d.getTime()-Date.UTC(d.getUTCFullYear(),0,1))/86400000)+1;
  const phi=latitude*Math.PI/180, dr=1+0.033*Math.cos(2*Math.PI*j/365), dec=0.409*Math.sin(2*Math.PI*j/365-1.39);
  const ws=Math.acos(clamp(-Math.tan(phi)*Math.tan(dec),-1,1));
  const ra=24*60/Math.PI*0.0820*dr*(ws*Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.sin(ws));
  const rso=(0.75+0.00002*elevation)*ra, rs=day.solar!;
  const sat=(es(min)+es(max))/2, ea=sat*day.rh!/100;
  const rnl=4.903e-9*((max+273.16)**4+(min+273.16)**4)/2*(0.34-0.14*Math.sqrt(ea))*(1.35*clamp(rs/Math.max(0.1,rso),0.3,1)-0.35);
  const rn=0.77*rs-rnl, delta=4098*es(temp)/(temp+237.3)**2;
  const pressure=101.3*((293-0.0065*elevation)/293)**5.26, gamma=0.000665*pressure;
  return Math.max(0,(0.408*delta*rn+gamma*900/(temp+273)*day.wind!*(sat-ea))/(delta+gamma*(1+0.34*day.wind!)));
}

export function validateRequest(input:unknown):asserts input is ScenarioRequest {
  if(!input || typeof input!=='object') throw new Error('A scenario object is required.');
  const r=input as ScenarioRequest, f=r.field;
  const bounded=(v:unknown,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
  if(!f || typeof f.name!=='string'||f.name.length>120||f.baseline!=='maize-soybean') throw new Error('This regional pack supports the maize–soybean baseline.');
  if(!bounded(f.latitude,41.825,42.225)||!bounded(f.longitude,-93.85,-93.45)) throw new Error('Field outside the cached Iowa regional package.');
  if(!Array.isArray(f.boundary)||f.boundary.length<4||f.boundary.length>100||f.boundary.some(p=>!Array.isArray(p)||p.length!==2||!bounded(p[0],-93.85,-93.45)||!bounded(p[1],41.825,42.225))) throw new Error('Boundary must contain 4–100 Iowa coordinates.');
  const first=f.boundary[0],last=f.boundary[f.boundary.length-1];
  if(first[0]!==last[0]||first[1]!==last[1]) throw new Error('Field polygon must be closed.');
  const area=Math.abs(f.boundary.slice(1).reduce((sum,p,i)=>sum+f.boundary[i][0]*p[1]-p[0]*f.boundary[i][1],0));
  if(area<1e-9) throw new Error('Field polygon has no area.');
  if(f.soilCapacity!==null&&!bounded(f.soilCapacity,60,260)) throw new Error('Soil capacity must be 60–260 mm/m or unknown.');
  if(!['demo-assumption','farmer-entry'].includes(f.soilSource)) throw new Error('Invalid soil source.');
  for(const key of ['irrigation','forageBuyer','forageEquipment','smallGrainBuyer','smallGrainEquipment','residueRetained'] as const) if(typeof f[key]!=='boolean') throw new Error('Invalid field constraints.');
  if(!bounded(f.irrigationLimit,0,400)||!bounded(f.budget,0,10000)) throw new Error('Invalid water or cost limit.');
  if(!bounded(r.rainfall,40,140)||!bounded(r.warming,0,4)||!bounded(r.price,50,160)||!bounded(r.terminationDay,90,135)||!Number.isInteger(r.terminationDay)) throw new Error('Scenario outside supported sensitivity bounds.');
  if(!r.weights||Object.values(r.weights).length!==3||!['soil','water','economy'].every(k=>bounded(r.weights[k as keyof typeof r.weights],0,10))||Object.values(r.weights).reduce((a,b)=>a+b,0)<=0) throw new Error('Select at least one priority.');
}

function evidenceProblem(data:EvidenceSeries):string|null {
  if(data.schemaVersion!=='atlas-evidence-1'||data.start!=='2013-01-01'||data.end!=='2024-12-31'||!Array.isArray(data.weather)||data.weather.length!==4383) return 'The complete 2013–2024 weather package is required.';
  const start=Date.UTC(2013,0,1);
  for(let i=0;i<data.weather.length;i++) {
    const d=data.weather[i];
    if(d.date!==new Date(start+i*86400000).toISOString().slice(0,10)||[d.rain,d.tmin,d.tmax,d.rh,d.wind,d.solar].some(v=>v===null||!Number.isFinite(v))) return 'Missing or invalid daily weather; no confident ranking is available.';
    if(d.rain!<0||d.solar!<0||d.wind!<0||d.rh!<0||d.rh!>100||d.tmin!>d.tmax!) return 'Invalid weather values.';
  }
  return null;
}

/** Phenological calendar is illustrative. Autumn crops persist into next year's spring. */
export function cropAt(id:StrategyId, yearIndex:number, day:number, termination:number):{crop:CropId|null; progress:number; cash:boolean} {
  const strategy=STRATEGIES.find(s=>s.id===id)!;
  const main=strategy.cycle[yearIndex%strategy.cycle.length];
  const prev=yearIndex>0?strategy.cycle[(yearIndex-1)%strategy.cycle.length]:null;
  const inWindow=(crop:CropId,start:number,end:number,cash:boolean)=>({crop, progress:clamp((day-start)/(end-start)),cash});
  if(id==='cover') {
    if(main==='soybean'&&day<termination) return inWindow('rye',60,termination,false);
    if(main==='maize'&&day>=295) return inWindow('rye',295,365,false);
  }
  if(id==='diverse') {
    if(main==='soybean'&&day>=280) return inWindow('wheat',280,365,false);
    if(main==='wheat') return day<=200?inWindow('wheat',60,200,true):inWindow('clover',200,365,false);
    if(prev==='wheat'&&day<=105) return inWindow('clover',60,105,false);
  }
  if(id==='forage') {
    if(main==='oats'&&day>210) return inWindow('alfalfa',210,365,false);
    if(main==='alfalfa') return inWindow('alfalfa',60,310,true);
    if(prev==='alfalfa'&&day<=105) return inWindow('alfalfa',60,105,false);
  }
  const windows:Partial<Record<CropId,[number,number]>>={maize:[120,288],soybean:[136,277],oats:[100,210]};
  const window=windows[main];
  return window&&day>=window[0]&&day<=window[1]?inWindow(main,...window,true):{crop:null,progress:0,cash:false};
}
function coefficient(crop:CropId, progress:number):number {
  const [a,b,c]=CROPS[crop].kc;
  if(progress<0.2) return a;
  if(progress<0.4) return a+(b-a)*(progress-0.2)/0.2;
  if(progress<0.8) return b;
  return b+(c-b)*(progress-0.8)/0.2;
}

export function simulate(data:EvidenceSeries, request:ScenarioRequest, id:StrategyId, preparedET?:number[]):StrategyResult {
  const strategy=STRATEGIES.find(s=>s.id===id)!, field=request.field;
  const capacity=field.soilCapacity!*1.5;
  let storage=capacity/2, snow=0;
  const years:YearResult[]=[], daily:DailyResult[]=[];
  let cashDemand=0,cashActual=0;
  const newYear=(year:number):YearResult=>({year,crop:strategy.cycle[(year-2013)%strategy.cycle.length],demand:0,deficit:0,irrigation:0,coverDays:0,sensitiveStressDays:0,heatDays:0,margin:0,revenue:0,cost:0,fertilizer:0,fixation:0,removal:0,credit:0,creditLow:0,creditHigh:0,yieldT:0});
  function finish(y:YearResult) {
    const crop=CROPS[y.crop];
    const waterFactor=clamp(1-crop.ky*(1-cashActual/Math.max(1,cashDemand)));
    y.yieldT=crop.yieldT*waterFactor;
    const prev=years.length>1?years[years.length-2].crop:null;
    if(prev==='wheat'&&id==='diverse') { y.creditLow=45; y.creditHigh=90; }
    if(prev==='alfalfa'&&id==='forage') { y.creditLow=90; y.creditHigh=150; }
    y.credit=Math.min(crop.fertilizerN,(y.creditLow+y.creditHigh)/2);
    y.fertilizer=Math.max(0,crop.fertilizerN-y.credit);
    y.removal=y.yieldT*crop.removalN;
    y.fixation=crop.fixation*y.removal*1.25;
    if(id==='diverse'&&y.crop==='wheat') y.fixation+=100;
    if(id==='forage'&&y.crop==='oats') y.fixation+=40;
    // No buyer means no credited revenue; missing machinery also excludes recommendation.
    const market=(y.crop==='alfalfa'?field.forageBuyer:['wheat','oats'].includes(y.crop)?field.smallGrainBuyer:true);
    y.revenue=market?y.yieldT*crop.price*request.price/100:0;
    y.cost=crop.cost-y.credit*1.17+y.irrigation*1.5;
    if(id==='cover'&&y.crop==='maize') y.cost+=CROPS.rye.cost;
    if(id==='diverse'&&y.crop==='wheat') y.cost+=CROPS.clover.cost;
    y.margin=y.revenue-y.cost;
  }
  for(let i=0;i<data.weather.length;i++) {
    const day=data.weather[i], year=Number(day.date.slice(0,4));
    if(!years.length||years[years.length-1].year!==year) {
      if(years.length) finish(years[years.length-1]);
      cashDemand=cashActual=0; years.push(newYear(year));
    }
    const y=years[years.length-1], index=year-2013;
    const doy=Math.round((Date.parse(day.date)-Date.UTC(year,0,1))/86400000)+1;
    const stage=cropAt(id,index,doy,request.terminationDay), crop=stage.crop?CROPS[stage.crop]:null;
    const temp=(day.tmin!+day.tmax!)/2+request.warming;
    const et0=preparedET?.[i]??referenceET(day,data.latitude,data.elevationM,request.warming);
    const rain=day.rain!*request.rainfall/100;
    const before=storage+snow;
    let liquid=rain;
    if(temp<0) { snow+=rain; liquid=0; }
    else { const melt=Math.min(snow,3*temp); snow-=melt; liquid+=melt; }
    const runoff=liquid*0.1;
    storage+=liquid-runoff;
    let drainage=Math.max(0,storage-capacity); storage=Math.min(capacity,storage);
    const kc=crop?coefficient(crop.id,stage.progress)*(temp<3?0.2:1):0.25;
    const demand=et0*kc;
    const root=crop?Math.min(crop.root,0.25+stage.progress*crop.root*2):0.2;
    const access=clamp(root/1.5), available=storage*access;
    const irrigation=field.irrigation&&crop?Math.min(Math.max(0,demand-available),Math.max(0,field.irrigationLimit-y.irrigation),capacity-storage):0;
    storage+=irrigation;
    const stress=clamp((storage*access)/Math.max(1,capacity*access*0.5));
    const actual=Math.min(storage*access,demand*stress), deficit=Math.max(0,demand-actual);
    storage-=actual;
    drainage+=Math.max(0,storage-capacity); storage=Math.min(capacity,storage);
    const residual=before+rain+irrigation-runoff-drainage-actual-storage-snow;
    y.irrigation+=irrigation;
    if(crop) { y.demand+=demand; y.deficit+=deficit; y.coverDays++; }
    if(stage.cash) {
      cashDemand+=demand; cashActual+=actual;
      if(stage.progress>=0.4&&stage.progress<=0.8&&deficit>0.2*demand&&demand>0.5) y.sensitiveStressDays++;
      if(day.tmax!+request.warming>=35) y.heatDays++;
    }
    daily.push({date:day.date,crop:stage.crop,living:!!crop,rain,et0,demand,actual,deficit,irrigation,runoff,drainage,storage,snow,residual});
  }
  finish(years[years.length-1]);
  const issues:string[]=[];
  if(id==='forage'&&!field.forageBuyer) issues.push('Confirm a forage buyer; hay revenue is currently zero.');
  if(id==='forage'&&!field.forageEquipment) issues.push('Confirm access to forage harvesting equipment.');
  if(['diverse','forage'].includes(id)&&!field.smallGrainBuyer) issues.push('Confirm a small-grain buyer; grain revenue is currently zero.');
  if(['diverse','forage'].includes(id)&&!field.smallGrainEquipment) issues.push('Confirm small-grain planting and harvest equipment.');
  if(Math.max(...years.map(y=>y.cost))>field.budget) issues.push('At least one year exceeds your operating-cost limit.');
  const margins=years.map(y=>y.margin), margin=mean(margins), low=quantile(margins,0.1);
  return {id,name:strategy.name,sequence:strategy.sequence,years,daily,demand:mean(years.map(y=>y.demand)),deficit:mean(years.map(y=>y.deficit)),irrigation:mean(years.map(y=>y.irrigation)),coverDays:mean(years.map(y=>y.coverDays)),sensitiveStressDays:mean(years.map(y=>y.sensitiveStressDays)),heatDays:mean(years.map(y=>y.heatDays)),margin,economicResilience:0.5*margin+0.5*low,marginRange:[low,quantile(margins,0.9)],nitrogenBalance:mean(years.map(y=>y.fertilizer+y.fixation-y.removal)),nitrogenCredit:[mean(years.map(y=>y.creditLow)),mean(years.map(y=>y.creditHigh))],fertilizer:mean(years.map(y=>y.fertilizer)),fixation:mean(years.map(y=>y.fixation)),removal:mean(years.map(y=>y.removal)),transition:years.slice(0,3).reduce((a,y)=>a+y.margin,0),eligible:issues.length===0,issues,dominated:false,match:0,delta:{margin:0,deficit:0,coverDays:0}};
}

export function compare(data:EvidenceSeries, request:ScenarioRequest, includeDaily=true, trustedEvidence=false):ComparisonResult {
  validateRequest(request);
  const problem=(!trustedEvidence?evidenceProblem(data):null)||(request.field.soilCapacity===null?'Enter a soil-water capacity assumption or measurement to calculate comparisons.':null);
  if(problem) return {version:MODEL_VERSION,status:'insufficient-information',reason:problem,evidenceId:data.id,assumptions:ASSUMPTIONS,strategies:[],preferred:null};
  const et=data.weather.map(d=>referenceET(d,data.latitude,data.elevationM,request.warming));
  const strategies=STRATEGIES.map(s=>simulate(data,request,s.id,et));
  const eligible=strategies.filter(s=>s.eligible);
  const metrics=(s:StrategyResult)=>[
    ...(request.weights.soil>0?[s.coverDays,mean(s.nitrogenCredit)]:[]),
    ...(request.weights.water>0?[-s.deficit]:[]),
    ...(request.weights.economy>0?[s.economicResilience]:[]),
  ];
  const rank=(s:StrategyResult,fn:(x:StrategyResult)=>number)=>eligible.length<2?1:eligible.filter(other=>other.id!==s.id).reduce((sum,other)=>sum+(Math.abs(fn(s)-fn(other))<1e-7?0.5:fn(s)>fn(other)?1:0),0)/(eligible.length-1);
  const w=request.weights, total=w.soil+w.water+w.economy;
  for(const s of strategies) {
    s.dominated=s.eligible&&eligible.some(other=>other.id!==s.id&&metrics(other).every((v,i)=>v>=metrics(s)[i]-1e-7)&&metrics(other).some((v,i)=>v>metrics(s)[i]+1e-7));
    if(s.eligible) s.match=100*(w.soil*(rank(s,x=>x.coverDays)+rank(s,x=>mean(x.nitrogenCredit)))/2+w.water*rank(s,x=>-x.deficit)+w.economy*rank(s,x=>x.economicResilience))/total;
    s.delta={margin:s.margin-strategies[0].margin,deficit:s.deficit-strategies[0].deficit,coverDays:s.coverDays-strategies[0].coverDays};
    if(!includeDaily) s.daily=[];
  }
  const preferred=[...strategies].filter(s=>s.eligible&&!s.dominated).sort((a,b)=>b.match-a.match||b.economicResilience-a.economicResilience)[0]?.id??null;
  return {version:MODEL_VERSION,status:'ready',evidenceId:data.id,assumptions:ASSUMPTIONS,strategies,preferred};
}

export function sensitivity(data:EvidenceSeries, request:ScenarioRequest):SensitivityResult {
  const base=compare(data,request,false), favored:Record<StrategyId,number>={baseline:0,cover:0,diverse:0,forage:0};
  const ranges:Record<StrategyId,[number,number]>={baseline:[Infinity,-Infinity],cover:[Infinity,-Infinity],diverse:[Infinity,-Infinity],forage:[Infinity,-Infinity]};
  const out:SensitivityResult={reference:base.preferred,tested:0,favored,ranges,sweeps:{rainfall:[],price:[],soil:[]},changes:[],nextObservation:'Enter missing information before exploring sensitivity.'};
  if(base.status!=='ready') { for(const id of Object.keys(ranges) as StrategyId[]) ranges[id]=[0,0]; return out; }
  const sweep=(variable:'rainfall'|'price'|'soil',values:number[])=>{
    for(const value of values) {
      const changed:ScenarioRequest=variable==='soil'?{...request,field:{...request.field,soilCapacity:value}}:{...request,[variable]:value};
      const result=compare(data,changed,false,true);
      out.tested++; if(result.preferred) favored[result.preferred]++;
      for(const s of result.strategies) { ranges[s.id][0]=Math.min(ranges[s.id][0],s.margin); ranges[s.id][1]=Math.max(ranges[s.id][1],s.margin); }
      const point:SensitivityPoint={value,preferred:result.preferred,margin:result.strategies.find(s=>s.id===base.preferred)?.margin??null};
      out.sweeps[variable].push(point);
    }
    const current=variable==='soil'?request.field.soilCapacity!:request[variable];
    const nearest=out.sweeps[variable].filter(p=>p.preferred!==base.preferred).sort((a,b)=>Math.abs(a.value-current)-Math.abs(b.value-current))[0];
    if(nearest) out.changes.push({variable,value:nearest.value,preferred:nearest.preferred});
  };
  sweep('rainfall',[40,50,60,70,80,90,100,110,120,130,140]);
  sweep('price',[50,60,70,80,90,100,110,120,130,140,150,160]);
  sweep('soil',[60,80,100,120,140,160,180,200,220,240,260]);
  const constrained=!request.field.forageBuyer||!request.field.forageEquipment;
  const confirmed=constrained?compare(data,{...request,field:{...request.field,forageBuyer:true,forageEquipment:true}},false,true):null;
  if(confirmed?.preferred&&confirmed.preferred!==base.preferred) out.nextObservation='Confirm a forage buyer and equipment access: enabling both changes the preferred rotation in this scenario.';
  else if(out.changes.some(c=>c.variable==='soil')) out.nextObservation='Measure available water capacity: the preferred rotation changes within the tested soil-capacity range.';
  else if(out.changes.some(c=>c.variable==='price')) out.nextObservation='Get local crop-price quotes: the preferred rotation changes within the tested price range.';
  else if(out.changes.some(c=>c.variable==='rainfall')) out.nextObservation='Review local rainfall and water access: the ranking changes in the tested rainfall scenarios.';
  else out.nextObservation='The preferred rotation stays the same across these one-variable tests. Review the crop calendar and enterprise budget with a local adviser.';
  return out;
}
