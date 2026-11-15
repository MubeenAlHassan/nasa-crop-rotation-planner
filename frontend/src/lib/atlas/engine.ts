import { ASSUMPTIONS, CROPS, DEFAULT_ENTERPRISE, MODEL_VERSION, NORMALIZATION, STRATEGIES, WEATHER_BLOCKS } from './catalog';
import { average as mean, scoreStrategies } from './scoring';
import {cropAt, mainCrop} from './calendar';
export {cropAt} from './calendar';
import { validateHistory } from './history';
import { attachStrategyRationales } from './strategy-rationale';
import type { ComparisonResult, ConstraintCheck, CropId, DailyResult, EvidenceSeries, MemberResult, ScenarioRequest, SensitivityPoint, SensitivityResult, StrategyId, StrategyResult, WeatherDay, YearResult } from './types';
/** Resolve catalog defaults with optional farmer enterprise overrides. Null fields keep the catalog value. */
export function resolveCropEconomics(crop:CropId,request:ScenarioRequest):{price:number;cost:number;source:'catalog-default'|'farmer-entry'} {
  const base=CROPS[crop],over=request.enterprise?.crops?.[crop];
  const price=over?.price??base.price,cost=over?.cost??base.cost;
  const touched=over!=null&&(over.price!==null||over.cost!==null);
  return {price,cost,source:touched||request.enterprise?.source==='farmer-entry'?'farmer-entry':'catalog-default'};
}
export { quantile } from './scoring';
const clamp = (x:number, lo=0, hi=1) => Math.min(hi, Math.max(lo,x));
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

/** Local equal-area approximation, adequate for this small Iowa demonstration polygon. */
export function fieldAreaHa(boundary:[number,number][]):number {
  const lat=mean(boundary.map(p=>p[1]))*Math.PI/180;
  const [x0,y0]=boundary[0];
  const points=boundary.map(([x,y])=>[(x-x0)*111320*Math.cos(lat),(y-y0)*111320]);
  return Math.abs(points.slice(1).reduce((sum,p,i)=>sum+points[i][0]*p[1]-p[0]*points[i][1],0))/20000;
}
export function validateRequest(input:unknown):asserts input is ScenarioRequest {
  if(!input || typeof input!=='object') throw new Error('A scenario object is required.');
  const r=input as ScenarioRequest, f=r.field;
  const bounded=(v:unknown,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
  const optional=(v:unknown,lo:number,hi:number)=>v===null||bounded(v,lo,hi);
  if(!f || typeof f.name!=='string'||!f.name.trim()||f.name.length>120||!['maize-soybean','soybean-maize'].includes(f.baseline)) throw new Error('Choose a maize–soybean or soybean–maize baseline.');
  if(!bounded(f.latitude,41.825,42.225)||!bounded(f.longitude,-93.85,-93.45)) throw new Error('Field outside the cached Iowa regional package.');
  if(!Array.isArray(f.boundary)||f.boundary.length<4||f.boundary.length>100||f.boundary.some(p=>!Array.isArray(p)||p.length!==2||!bounded(p[0],-93.85,-93.45)||!bounded(p[1],41.825,42.225))) throw new Error('Boundary must contain 4–100 Iowa coordinates.');
  const first=f.boundary[0],last=f.boundary[f.boundary.length-1];
  if(first[0]!==last[0]||first[1]!==last[1]) throw new Error('Field polygon must be closed.');
  if(fieldAreaHa(f.boundary)<.01) throw new Error('Field polygon has no area.');
  // Reject crossed boundaries: area and field evidence would otherwise be ambiguous.
  const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<f.boundary.length-1;i++) for(let j=i+2;j<f.boundary.length-1;j++) {
    if(i===0&&j===f.boundary.length-2) continue;
    const a=f.boundary[i],b=f.boundary[i+1],c=f.boundary[j],d=f.boundary[j+1];
    if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0) throw new Error('Field boundary crosses itself.');
  }
  if(!optional(f.soilCapacity,60,260)||!['demo-assumption','farmer-entry','soil-survey'].includes(f.soilSource)) throw new Error('Soil capacity must be 60–260 mm/m or unknown, with a source.');
  for(const key of ['boundaryConfirmed','baselineConfirmed','irrigation','forageBuyer','forageEquipment','forageSuitable','smallGrainBuyer','smallGrainEquipment','smallGrainSuitable','coverEquipment','laborAvailable'] as const) if(f[key]!==null&&typeof f[key]!=='boolean') throw new Error('Constraints must be yes, no or unknown.');
  if(typeof f.residueRetained!=='boolean'||!optional(f.irrigationLimit,0,400)||!optional(f.irrigationEfficiency,.1,1)||!optional(f.budget,0,10000)) throw new Error('Invalid water, efficiency or cost limit.');
  if(r.horizon?.startYear!==2027||r.horizon.years!==4) throw new Error('This package compares the shared 2027–2030 four-year horizon.');
  if(!r.initialState||!optional(r.initialState.storageFraction,0,1)||!optional(r.initialState.snowMm,0,500)||!optional(r.initialState.residueCover,0,1)||!['assumption','farmer-entry'].includes(r.initialState.source)) throw new Error('Invalid initial state.');
  if(!r.calendar||!['maize','soybean'].every(k=>{const w=r.calendar[k as 'maize'|'soybean'];return Array.isArray(w)&&w.length===2&&w.every(Number.isInteger)&&bounded(w[0],90,180)&&bounded(w[1],220,320)&&w[1]>w[0];})||!bounded(r.calendar.ryeSow,270,330)||!Number.isInteger(r.calendar.ryeSow)) throw new Error('Invalid planting or harvest calendar.');
  if(!bounded(r.rainfall,40,140)||!bounded(r.warming,0,4)||!bounded(r.price,50,160)||!bounded(r.terminationDay,90,135)||!Number.isInteger(r.terminationDay)) throw new Error('Scenario outside supported sensitivity bounds.');
  if(!r.weights||Object.values(r.weights).length!==3||!['soil','water','economy'].every(k=>bounded(r.weights[k as keyof typeof r.weights],0,10))||Object.values(r.weights).reduce((a,b)=>a+b,0)<=0) throw new Error('Select at least one priority.');
  if(typeof r.showScores!=='boolean'||!r.decision||![null,'defer',...STRATEGIES.map(s=>s.id)].includes(r.decision.selection)||typeof r.decision.notes!=='string'||r.decision.notes.length>3000||typeof r.decision.reviewed!=='boolean') throw new Error('Invalid saved decision.');
  validateHistory(r.history);
  const e=r.enterprise??DEFAULT_ENTERPRISE;
  if(e.schemaVersion!=='enterprise-inputs-v1'||!['catalog-default','farmer-entry'].includes(e.source)||typeof e.reviewed!=='boolean'||typeof e.note!=='string'||e.note.length>400||typeof e.crops!=='object'||e.crops===null||!Array.isArray(e.cloverCreditKgN)||e.cloverCreditKgN.length!==2||!bounded(e.cloverCreditKgN[0],0,200)||!bounded(e.cloverCreditKgN[1],0,200)||e.cloverCreditKgN[1]<e.cloverCreditKgN[0]||!bounded(e.nitrogenCreditUsdPerKg,0,10)) throw new Error('Invalid enterprise budget assumptions.');
  for(const [id,over] of Object.entries(e.crops)){
    if(!(id in CROPS)||!over||typeof over!=='object') throw new Error('Invalid enterprise crop override.');
    if(!optional(over.price,0,2000)||!optional(over.cost,0,5000)) throw new Error(`Enterprise ${id} price/cost is outside the supported review range.`);
  }
  r.enterprise=e;
}
function evidenceProblem(data:EvidenceSeries):string|null {
  if(data.timeStandard!=='UTC'||!Number.isFinite(data.latitude)||!Number.isFinite(data.elevationM))return 'Weather time standard, latitude or elevation is unsupported.';
  if(data.schemaVersion!=='atlas-evidence-1'||data.start!=='2013-01-01'||data.end!=='2024-12-31'||!Array.isArray(data.weather)||data.weather.length!==4383) return 'The complete 2013–2024 weather package is required.';
  const start=Date.UTC(2013,0,1);
  for(let i=0;i<data.weather.length;i++) {
    const d=data.weather[i];
    if(d.date!==new Date(start+i*86400000).toISOString().slice(0,10)||[d.rain,d.tmin,d.tmax,d.rh,d.wind,d.solar].some(v=>v===null||!Number.isFinite(v))) return 'Missing or invalid daily weather; comparisons are withheld.';
    if(d.rain!<0||d.solar!<0||d.wind!<0||d.rh!<0||d.rh!>100||d.tmin!>d.tmax!) return 'Invalid weather values.';
  }
  return null;
}
function coefficient(crop:CropId,progress:number):number {
  const [a,b,c]=CROPS[crop].kc;
  if(progress<.2) return a;
  if(progress<.4) return a+(b-a)*(progress-.2)/.2;
  if(progress<.8) return b;
  return b+(c-b)*(progress-.8)/.2;
}
function constraints(request:ScenarioRequest,id:StrategyId,years:YearResult[]):ConstraintCheck[] {
  const f=request.field;
  const check=(id:string,label:string,value:boolean|null,detail:string):ConstraintCheck=>({id,label,status:value===null?'unknown':value?'pass':'fail',detail});
  const out=[check('boundary','Field boundary confirmed',f.boundaryConfirmed,'The demonstration polygon includes non-crop land; confirm a suitable field or correct it.'),check('history','Starting crop history confirmed',f.baselineConfirmed,'Confirm the crop sequence, calendar and initial condition for this field.'),check('labor','Labor available',f.laborAvailable,'Confirm labor for all selected planting, termination and harvest operations.'),check('budget','Annual operating budget',f.budget===null?null:years.every(y=>y.cost<=f.budget!),'Maximum illustrative annual cost compared with your USD/ha limit; excludes land and overhead.')];
  if(id==='cover') out.push(check('cover-equipment','Cover sowing and termination access',f.coverEquipment,'Confirm equipment or contractor access.'),check('cover-calendar','Cover fits the crop calendar',request.calendar.ryeSow>request.calendar.maize[1]&&request.terminationDay<=request.calendar.soybean[0]-10,'This beginner scenario requires rye sowing after maize harvest and termination at least 10 days before soybean planting.'));
  if(id==='diverse'||id==='forage') out.push(check('grain-market','Small-grain market',f.smallGrainBuyer,'No buyer: no grain revenue credited. Unknown buyer: sales remain hypothetical.'),check('grain-equipment','Small-grain equipment',f.smallGrainEquipment,'Confirm planting and harvesting access.'),check('grain-site','Small-grain site and calendar suitability',f.smallGrainSuitable,'Confirm cultivar, drainage, winter survival and local crop restrictions.'));
  if(id==='diverse') out.push(check('wheat-calendar','Autumn wheat sowing window',request.calendar.soybean[1]<=295,'Assumed latest soybean harvest day 295; validate wheat planting and clover establishment locally.'),check('clover-calendar','Clover termination before maize',request.calendar.maize[0]>105,'This template terminates clover on day 105. Maize must be planted after termination; overlapping calendars are infeasible, and their illustrative outcomes must not be ranked.'));
  if(id==='forage') out.push(check('forage-market','Forage buyer or on-farm use',f.forageBuyer,'No buyer: no hay revenue credited. Unknown buyer: sales remain hypothetical.'),check('forage-equipment','Forage equipment',f.forageEquipment,'Confirm cutting, handling and storage access.'),check('forage-site','Perennial stand suitability',f.forageSuitable,'Confirm drainage, pH, establishment conditions and local restrictions.'));
  return out;
}
export function simulate(data:EvidenceSeries,request:ScenarioRequest,id:StrategyId,preparedET?:number[]):StrategyResult {
  const strategy=STRATEGIES.find(s=>s.id===id)!,f=request.field,capacity=f.soilCapacity!*1.5;
  const members:MemberResult[]=[],daily:DailyResult[]=[];
  for(const start of WEATHER_BLOCKS) {
    let storage=capacity*request.initialState.storageFraction!,snow=request.initialState.snowMm!,residue=request.initialState.residueCover!;
    const initialStorage=storage,initialSnow=snow,initialResidue=residue;
    const years:YearResult[]=[];let cashDemand=0,cashActual=0,maxWaterResidual=0;
    let previous:ReturnType<typeof cropAt>={crop:null,progress:0,cash:false};
    function finish(y:YearResult) {
      const crop=CROPS[y.crop];
      y.yieldT=crop.yieldT*clamp(1-crop.ky*(1-cashActual/Math.max(1,cashDemand)));
      const prior=years.length>1?years[years.length-2].crop:null;
      if(prior==='wheat'&&id==='diverse') {y.creditLow=request.enterprise.cloverCreditKgN[0];y.creditHigh=request.enterprise.cloverCreditKgN[1];}
      y.credit=Math.min(crop.fertilizerN,(y.creditLow+y.creditHigh)/2);y.fertilizer=crop.fertilizerN-y.credit;
      y.removal=y.yieldT*crop.removalN;y.fixation=crop.fixation*y.removal*1.25;
      if(id==='diverse'&&y.crop==='wheat') y.fixation+=100;
      if(id==='forage'&&y.crop==='oats') y.fixation+=40;
      const market=y.crop==='alfalfa'?f.forageBuyer:['wheat','oats'].includes(y.crop)?f.smallGrainBuyer:true;
      const econ=resolveCropEconomics(y.crop,request);
      y.revenue=market===false?0:y.yieldT*econ.price*request.price/100;
      y.cost=econ.cost-y.credit*request.enterprise.nitrogenCreditUsdPerKg+y.withdrawal*1.5;
      if(id==='cover'&&y.crop==='maize') y.cost+=resolveCropEconomics('rye',request).cost;
      if(id==='diverse'&&y.crop==='wheat') y.cost+=resolveCropEconomics('clover',request).cost;
      y.margin=y.revenue-y.cost;
    }
    for(let i=0;i<data.weather.length;i++) {
      const day=data.weather[i],weatherYear=Number(day.date.slice(0,4));
      if(weatherYear<start||weatherYear>=start+4) continue;
      const index=weatherYear-start,year=request.horizon.startYear+index;
      if(!years.length||years[years.length-1].year!==year) {
        if(years.length) finish(years[years.length-1]);
        cashDemand=cashActual=0;
        years.push({year,weatherYear,crop:mainCrop(id,index,request),demand:0,deficit:0,irrigation:0,withdrawal:0,et:0,coverDays:0,sensitiveStressDays:0,heatDays:0,margin:0,revenue:0,cost:0,fertilizer:0,fixation:0,removal:0,credit:0,creditLow:0,creditHigh:0,yieldT:0});
      }
      const y=years[years.length-1],doy=Math.round((Date.parse(day.date)-Date.UTC(weatherYear,0,1))/86400000)+1;
      const stage=cropAt(id,index,doy,request.terminationDay,request),crop=stage.crop?CROPS[stage.crop]:null,events:string[]=[];
      residue*=Math.exp(-Math.LN2/120);
      if(stage.crop!==previous.crop) {
        if(previous.crop) {events.push(`${previous.cash?'Harvest':'Terminate'} ${CROPS[previous.crop].name}`);if(f.residueRetained) residue=1-(1-residue)*.35;}
        if(stage.crop) events.push(`Plant / establish ${CROPS[stage.crop].name}`);
      }
      if(id==='forage'&&y.crop==='oats'&&doy===100) events.push('Undersow alfalfa; establishment cost included');
      if(stage.crop==='alfalfa'&&stage.cash&&[165,215,265].includes(doy)) events.push('Illustrative hay cut; biomass removed, no residue or soil-carbon credit');
      previous=stage;
      const temp=(day.tmin!+day.tmax!)/2+request.warming,et0=preparedET?.[i]??referenceET(day,data.latitude,data.elevationM,request.warming),rain=day.rain!*request.rainfall/100;
      const before=storage+snow;
      let liquid=rain;
      if(temp<0) {snow+=rain;liquid=0;} else {const melt=Math.min(snow,3*temp);snow-=melt;liquid+=melt;}
      const runoff=liquid*.1; storage+=liquid-runoff;
      let drainage=Math.max(0,storage-capacity);storage=Math.min(capacity,storage);
      const kc=crop?coefficient(crop.id,stage.progress)*(temp<3?.2:1):.25*(1-.5*residue),demand=et0*kc;
      const established=stage.crop==='alfalfa'&&index===3;
      const root=crop?(established?crop.root:Math.min(crop.root,.25+stage.progress*crop.root*2)):.2,access=clamp(root/1.5);
      const netNeed=Math.max(0,Math.min(capacity*.5-storage,capacity-storage));
      const withdrawal=f.irrigation===true&&crop&&temp>5&&demand>.5?Math.min(netNeed/f.irrigationEfficiency!,Math.max(0,f.irrigationLimit!-y.withdrawal)):0;
      const irrigation=withdrawal*(f.irrigationEfficiency??1),applicationLoss=withdrawal-irrigation;storage+=irrigation;
      const stress=clamp(storage*access/Math.max(1,capacity*access*.5)),actual=Math.min(storage*access,demand*stress),deficit=Math.max(0,demand-actual);
      storage-=actual;drainage+=Math.max(0,storage-capacity);storage=Math.min(capacity,storage);
      const residual=before+rain+withdrawal-applicationLoss-runoff-drainage-actual-storage-snow;maxWaterResidual=Math.max(maxWaterResidual,Math.abs(residual));
      y.irrigation+=irrigation;y.withdrawal+=withdrawal;y.et+=actual;
      if(crop) {y.demand+=demand;y.deficit+=deficit;y.coverDays++;}
      if(stage.cash) {cashDemand+=demand;cashActual+=actual;if(stage.progress>=.4&&stage.progress<=.8&&deficit>.2*demand&&demand>.5)y.sensitiveStressDays++;if(day.tmax!+request.warming>=35)y.heatDays++;}
      if(start===WEATHER_BLOCKS[0]) daily.push({date:day.date,planningYear:year,crop:stage.crop,living:!!crop,rain,et0,demand,actual,deficit,irrigation,withdrawal,applicationLoss,runoff,drainage,storage,snow,residueCover:residue,events,residual});
    }
    finish(years[years.length-1]);
    const sum=(key:'deficit'|'coverDays'|'margin'|'et'|'irrigation'|'withdrawal')=>years.reduce((s,y)=>s+y[key],0);
    members.push({id:`power-${start}-${start+3}`,weatherStart:start,weatherEnd:start+3,initialStorage,initialSnow,initialResidue,terminal:{storage,snow,residueCover:residue,crop:previous.crop},totals:{deficit:sum('deficit'),coverDays:sum('coverDays'),margin:sum('margin'),et:sum('et'),irrigation:sum('irrigation'),withdrawal:sum('withdrawal')},delta:{deficit:0,coverDays:0,margin:0},years,maxWaterResidual});
  }
  const allYears=members.flatMap(m=>m.years),avg=(k:keyof YearResult)=>mean(allYears.map(y=>y[k] as number));
  const checks=constraints(request,id,allYears),feasibility=checks.some(c=>c.status==='fail')?'fail':checks.some(c=>c.status==='unknown')?'unknown':'pass';
  const reviewFlags=['Unvalidated water/yield/economic scenario; three weather blocks do not define outcome probabilities.'];
  if(f.soilSource==='demo-assumption')reviewFlags.push('Soil capacity is a demonstration assumption, not a soil test.');
  if(id==='forage')reviewFlags.push('Terminal alfalfa stand retained; no post-horizon nitrogen credit or residual asset value.');
  if((id==='forage'&&f.forageBuyer===null)||(['forage','diverse'].includes(id)&&f.smallGrainBuyer===null))reviewFlags.push('Hypothetical sales included while market access is unknown.');
  const margin=avg('margin');
  return {id,name:strategy.name,sequence:members[0].years.map(y=>CROPS[y.crop].name+(id==='cover'&&y.crop==='maize'?' + rye cover':id==='diverse'&&y.crop==='wheat'?' + clover':'')).join(' → '),years:members[0].years,daily,members,objectives:{} as StrategyResult['objectives'],pairedDifferences:{} as StrategyResult['pairedDifferences'],constraints:checks,feasibility,demand:avg('demand'),deficit:avg('deficit'),irrigation:avg('irrigation'),withdrawal:avg('withdrawal'),et:avg('et'),coverDays:avg('coverDays'),sensitiveStressDays:avg('sensitiveStressDays'),heatDays:avg('heatDays'),margin,economicResilience:margin,marginRange:[Math.min(...members.map(m=>m.totals.margin/4)),Math.max(...members.map(m=>m.totals.margin/4))],nitrogenBalance:mean(allYears.map(y=>y.fertilizer+y.fixation-y.removal)),nitrogenCredit:[avg('creditLow'),avg('creditHigh')],fertilizer:avg('fertilizer'),fixation:avg('fixation'),removal:avg('removal'),transition:mean(members.map(m=>m.totals.margin)),eligible:feasibility==='pass',issues:checks.filter(c=>c.status!=='pass').map(c=>`${c.status}: ${c.label}. ${c.detail}`),reviewFlags,dominated:false,pareto:'not-assessed',match:null,scoreRange:null,delta:{margin:0,deficit:0,coverDays:0},unavailable:{soilCarbonChange:null,soilLoss:null,pestReduction:null,probabilityBetter:null}};
}
export function compare(data:EvidenceSeries,request:ScenarioRequest,includeDaily=true,trustedEvidence=false):ComparisonResult {
  validateRequest(request);
  const f=request.field;
  const problem=(!trustedEvidence?evidenceProblem(data):null)||(f.soilCapacity===null?'Enter soil-water capacity to calculate comparisons.':null)||(Object.values(request.initialState).some(v=>v===null)?'Initial water, snow and residue state are required.':null)||(f.irrigation===null?'Confirm rainfed or irrigation access before modeling water.':null)||(f.irrigation&&(f.irrigationLimit===null||f.irrigationEfficiency===null)?'Irrigated scenarios require an allocation and irrigation efficiency.':null);
  const common={version:MODEL_VERSION,evidenceId:data.id,assumptions:ASSUMPTIONS,horizon:request.horizon,normalizationVersion:NORMALIZATION.version,memberIds:WEATHER_BLOCKS.map(y=>`power-${y}-${y+3}`),fieldAreaHa:fieldAreaHa(f.boundary)};
  if(problem)return {...common,status:'insufficient-information',reason:problem,strategies:[],preferred:null};
  const et=data.weather.map(d=>referenceET(d,data.latitude,data.elevationM,request.warming));
  const strategies=STRATEGIES.map(s=>simulate(data,request,s.id,et));scoreStrategies(strategies,request.weights,request.showScores);
  for(const s of strategies) {s.delta={margin:s.margin-strategies[0].margin,deficit:s.deficit-strategies[0].deficit,coverDays:s.coverDays-strategies[0].coverDays};if(!includeDaily)s.daily=[];}
  const unknown=strategies.some(s=>s.feasibility==='unknown');
  const preferred=unknown||!request.showScores?null:[...strategies].filter(s=>s.eligible&&!s.dominated).sort((a,b)=>b.match!-a.match!||a.id.localeCompare(b.id))[0]?.id??null;
  // Rationale cites forcing/history only here; satellite enrichment happens in UI/export and never alters scores.
  return attachStrategyRationales({...common,status:'ready',strategies,preferred,reviewFlags:unknown?['No overall preference: resolve unknown feasibility, or explicitly mark unsuitable options as failed.']:['Preference scores express your priorities; the farmer chooses.']},request,{weather:data});
}
export function sensitivity(data:EvidenceSeries,request:ScenarioRequest):SensitivityResult {
  const base=compare(data,request,false),favored:Record<StrategyId,number>={baseline:0,cover:0,diverse:0,forage:0};
  const ranges:Record<StrategyId,[number,number]>={baseline:[Infinity,-Infinity],cover:[Infinity,-Infinity],diverse:[Infinity,-Infinity],forage:[Infinity,-Infinity]};
  const out:SensitivityResult={reference:base.preferred,tested:0,favored,ranges,sweeps:{rainfall:[],price:[],soil:[]},changes:[],nextObservation:'Enter missing information before exploring sensitivity.'};
  if(base.status!=='ready'){for(const id of Object.keys(ranges) as StrategyId[])ranges[id]=[0,0];return out;}
  const sweep=(variable:'rainfall'|'price'|'soil',values:number[])=>{
    for(const value of values){const changed:ScenarioRequest=variable==='soil'?{...request,field:{...request.field,soilCapacity:value}}:{...request,[variable]:value};const result=compare(data,changed,false,true);out.tested++;if(result.preferred)favored[result.preferred]++;for(const s of result.strategies){ranges[s.id][0]=Math.min(ranges[s.id][0],s.margin);ranges[s.id][1]=Math.max(ranges[s.id][1],s.margin);}const point:SensitivityPoint={value,preferred:result.preferred,margin:result.strategies.find(s=>s.id===(base.preferred??'baseline'))?.margin??null};out.sweeps[variable].push(point);}
    const current=variable==='soil'?request.field.soilCapacity!:request[variable],nearest=out.sweeps[variable].filter(p=>p.preferred!==base.preferred).sort((a,b)=>Math.abs(a.value-current)-Math.abs(b.value-current))[0];if(nearest)out.changes.push({variable,value:nearest.value,preferred:nearest.preferred});
  };
  sweep('rainfall',[40,50,60,70,80,90,100,110,120,130,140]);sweep('price',[50,60,70,80,90,100,110,120,130,140,150,160]);sweep('soil',[60,80,100,120,140,160,180,200,220,240,260]);
  out.nextObservation=base.preferred===null?'Resolve unknown constraints before interpreting preference stability. Ranges still show sensitivity of modeled margins.':out.changes.some(c=>c.variable==='soil')?'Measure root-zone available water capacity: preference changes across tested assumptions.':out.changes.some(c=>c.variable==='price')?'Obtain local crop-price and budget quotes: preference changes across tested prices.':out.changes.some(c=>c.variable==='rainfall')?'Review local rainfall and water access: preference changes across tested rainfall.':'Review crop calendars and local budgets; these one-variable tests do not capture interacting uncertainty.';
  return out;
}
