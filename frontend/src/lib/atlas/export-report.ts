import type {GraceEvidence} from './grace';
import {ecoMatches,type EcoEvidence} from './ecostress';
import {seasonalWindow,type NasaSeason} from './nasa-season';
import type {ComparisonResult,EvidenceSeries,ScenarioRequest,StrategyResult} from './types';
import {matchesEvidenceField,type FieldEvidence} from './field-evidence';
import {historyMatchesField,historyReport} from './history';
import {attachStrategyRationales} from './strategy-rationale';
import {historyOpportunities,WINDOW_CONNECTION_LIMIT,WINDOW_CONNECTION_METHOD} from './history-opportunities';

export type ExportFormat='json'|'excel'|'word'|'pdf';
export const EXPORT_FORMATS: {id:ExportFormat;label:string;extension:string;hint:string}[]=[
  {id:'json',label:'JSON',extension:'json',hint:'Full machine-readable decision package'},
  {id:'excel',label:'Excel',extension:'xls',hint:'Spreadsheet summary that opens in Excel'},
  {id:'word',label:'Word',extension:'doc',hint:'Readable report that opens in Word'},
  {id:'pdf',label:'PDF',extension:'pdf',hint:'Printable summary document'},
];

export interface ReportPayload {
  title:string;
  createdAt:string;
  notice:string;
  decisionStatus:string;
  reviewQuestions:string[];
  comparisonBasis:Record<string,string>;
  request:ScenarioRequest;
  result:unknown;
  history:ReturnType<typeof historyReport>;
  historyOpportunities:ReturnType<typeof historyOpportunities>;
  evidence:unknown;
  fieldEvidence:FieldEvidence|null;
  fieldEvidenceApplicability:string;
  regionalSeasonalPackages:NasaSeason[];
  regionalSeasonalEvidence:NasaSeason|null;
  crossMonthWindows:unknown;
  ecostressEvidence:EcoEvidence|null;
  ecostressEvidenceApplicability:string;
  graceEvidence:GraceEvidence|null;
  historicalWeather:unknown;
}

function money(n:number){return `${n<0?'-':''}$${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`;}
function num(n:number,d=1){return n.toLocaleString('en-US',{maximumFractionDigits:d});}
function xmlEscape(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function csvEscape(value:string){return /[",\n]/.test(value)?`"${value.replace(/"/g,'""')}"`:value;}

export function buildReportPayload(
  request:ScenarioRequest,
  result:unknown,
  evidence:EvidenceSeries|null,
  fieldEvidence:FieldEvidence|null=null,
  historicalWeather:EvidenceSeries|null=evidence,
  regionalSeasonalEvidence:NasaSeason|null=null,
  ecostressEvidence:EcoEvidence|null=null,
  graceEvidence:GraceEvidence|null=null,
  regionalSeasonalPackages:NasaSeason[]=[],
):ReportPayload {
  const crossMonthWindows=historyMatchesField(request.history,request.field)?request.history.windows.map(w=>({id:w.id,status:w.status,summary:seasonalWindow(regionalSeasonalPackages,w.start+'T00:00:00Z',new Date(Date.parse(w.end+'T00:00:00Z')+86400000).toISOString())})):null;
  const packages=regionalSeasonalPackages.length?regionalSeasonalPackages:regionalSeasonalEvidence?[regionalSeasonalEvidence]:[];
  const enriched=result&&typeof result==='object'&&Array.isArray((result as ComparisonResult).strategies)
    ?attachStrategyRationales(result as ComparisonResult,request,{weather:evidence??historicalWeather,fieldEvidence,seasonalPackages:packages,ecostress:ecostressEvidence,grace:graceEvidence})
    :result;
  const strategyReviewQuestions=(enriched&&typeof enriched==='object'&&Array.isArray((enriched as ComparisonResult).strategies))
    ?(enriched as ComparisonResult).strategies.flatMap(s=>s.rationale?.localReviewQuestions??[])
    :[];
  return {
    title:'Rotation Atlas decision report',
    createdAt:new Date().toISOString(),
    comparisonBasis:{rotations:'Fixed templates; not satellite-generated',forcing:'POWER 2013–2024 paired four-year blocks',satelliteRole:'Reviewed windows inform seasonal calendar comparisons; do not modify scoring',rationaleMethod:'strategy-rationale-v1',windowConnectionMethod:WINDOW_CONNECTION_METHOD},
    ecostressEvidenceApplicability:ecostressEvidence?(ecoMatches(ecostressEvidence,request)?'matching-boundary':'different-boundary-not-field-evidence'):'unavailable',
    regionalSeasonalPackages,
    crossMonthWindows,
    graceEvidence,
    ecostressEvidence,
    regionalSeasonalEvidence,
    historicalWeather:historicalWeather?{...historicalWeather,weather:undefined,satellites:undefined}:null,
    request,
    result:enriched,
    history:historyReport(request.history,request.field,historicalWeather,fieldEvidence),
    historyOpportunities:historyOpportunities(request,fieldEvidence),
    evidence:evidence?{...evidence,weather:undefined,satellites:undefined}:null,
    fieldEvidence,
    fieldEvidenceApplicability:fieldEvidence?(matchesEvidenceField(request.field,fieldEvidence)?'matching-boundary':'different-boundary-not-field-evidence'):'unavailable',
    decisionStatus:request.decision.selection===null?'draft-unselected':request.decision.reviewed?'farmer-reviewed-not-validated':'draft-needs-review',
    reviewQuestions:[...new Set(['Are these planting windows suitable for the cultivar and farm?','Is available water capacity measured or assumed?','Are buyers and machinery confirmed?','Do local costs and nitrogen credits match these assumptions?',...strategyReviewQuestions])],
    notice:'Illustrative decision support, not a forecast or fertilizer prescription. AI-assisted software. POWER source responses and real Landsat/soil provenance are retained. Crop, yield, nutrient and economic outcomes are simplified scenarios; no probabilities of benefit are available. Per-strategy rationale separates observed context, agronomic mechanisms and unvalidated projections.',
  };
}

function strategies(payload:ReportPayload):StrategyResult[] {
  const result=payload.result as ComparisonResult|null;
  return result&&typeof result==='object'&&Array.isArray(result.strategies)?result.strategies:[];
}

/** Farmer-readable summary lines shared by Excel/Word/PDF. */
export function reportSummaryLines(payload:ReportPayload):string[] {
  const f=payload.request.field;
  const lines=[
    payload.title,
    `Created: ${payload.createdAt}`,
    `Field: ${f.name}`,
    `Location: ${f.latitude.toFixed(5)}° N, ${Math.abs(f.longitude).toFixed(5)}° W`,
    `Baseline: ${f.baseline} · confirmed=${String(f.baselineConfirmed)} · boundary confirmed=${String(f.boundaryConfirmed)}`,
    `Decision status: ${payload.decisionStatus}`,
    `Selection: ${payload.request.decision.selection??'not selected'}`,
    `Enterprise source: ${payload.request.enterprise.source} · reviewed=${String(payload.request.enterprise.reviewed)}`,
    '',
    'Comparison basis',
    ...Object.entries(payload.comparisonBasis).map(([k,v])=>`${k}: ${v}`),
    '',
    'Notice',
    payload.notice,
    '',
  ];
  const list=strategies(payload);
  lines.push(...windowSummaryLines(payload));
  if(list.length){
    lines.push('Strategy comparison (annualized means)');
    lines.push('Strategy | Feasibility | Margin USD/ha/yr | Water shortfall mm/yr | Living cover days/yr | Preference');
    for(const s of list){
      lines.push(`${s.name} | ${s.feasibility} | ${money(s.margin)} | ${num(s.deficit)} | ${num(s.coverDays)} | ${s.match===null?'withheld':num(s.match,0)}`);
    }
    lines.push('');
    for(const s of list){
      if(!s.rationale)continue;
      lines.push(`Rationale · ${s.name}`);
      lines.push(`Question: ${s.rationale.question}`);
      lines.push(`Template: ${s.rationale.templateBasis}`);
      for(const m of s.rationale.mechanisms)lines.push(`- Mechanism: ${m.title}. ${m.description} Limit: ${m.claimLimit}`);
      for(const c of s.rationale.observedContext)lines.push(`- Context (${c.source}): ${c.summary} Limit: ${c.claimLimit}`);
      for(const miss of s.rationale.contraryOrMissing.slice(0,8))lines.push(`- Missing/contrary: ${miss}`);
      for(const q of s.rationale.localReviewQuestions.slice(0,6))lines.push(`- Review: ${q}`);
      lines.push('');
    }
  }else{
    lines.push('No modeled comparison in this export.');
    lines.push('');
  }
  lines.push('Local review questions');
  for(const q of payload.reviewQuestions)lines.push(`- ${q}`);
  if(payload.request.decision.notes.trim()){
    lines.push('');
    lines.push('Farmer notes');
    lines.push(payload.request.decision.notes.trim());
  }
  lines.push('');
  lines.push(`Field evidence applicability: ${payload.fieldEvidenceApplicability}`);
  lines.push(`ECOSTRESS applicability: ${payload.ecostressEvidenceApplicability}`);
  lines.push(`History windows exported: ${payload.history.windows.length}`);
  return lines;
}

/** Shared across every export so local corrections and abstentions survive offline reporting. */
function windowSummaryLines(payload:ReportPayload):string[] {
  const lines=['Reviewed windows and rotation calendars',WINDOW_CONNECTION_LIMIT];
  if(!payload.historyOpportunities.length)lines.push('No historical windows recorded.');
  for(const w of payload.historyOpportunities){
    lines.push(`Window ${w.windowId}: ${w.start} to ${w.end} | ${w.status} | ${w.cover}`);
    lines.push(`Local record: ${w.note||'No note'} | updated ${w.updatedAt}`);
    lines.push(w.reason,`Satellite connection: ${w.satelliteLink}`,...w.warnings);
    for(const o of w.observations)lines.push(`Landsat ${o.date}: NDVI ${o.ndvi}; valid area ${num(o.validFraction*100)}%; QA ${o.qaPolicy}; ID ${o.id}`);
    for(const c of w.calendars){
      for(const y of c.years)lines.push(`${c.strategyId} ${y.start} to ${y.end}: ${y.scheduledDays}/${y.days} scheduled days; baseline ${y.baselineDays}; added ${y.addedDays}; lost ${y.lostDays}; crops ${y.crops.join(', ')||'none'}`);
      if(c.omittedYears.length)lines.push(`${c.strategyId}: omitted start years ${c.omittedYears.join(', ')} (leap date or horizon limit).`);
      const strategy=strategies(payload).find(s=>s.id===c.strategyId);
      if(strategy)lines.push(`${c.strategyId}: feasibility ${strategy.feasibility}; whole four-year water shortfall delta ${num(strategy.pairedDifferences.deficit.mean)} mm; gross margin delta ${num(strategy.pairedDifferences.margin.mean)} USD/ha. Unvalidated scenarios, not benefits attributed to this window.`);
    }
  }
  return [...lines,''];
}

export function reportToExcel(payload:ReportPayload):Blob {
  const rows:string[][]=[
    ['Section','Field','Value'],
    ['Report','Title',payload.title],
    ['Report','Created',payload.createdAt],
    ['Report','Decision status',payload.decisionStatus],
    ['Report','Notice',payload.notice],
    ['Field','Name',payload.request.field.name],
    ['Field','Latitude',String(payload.request.field.latitude)],
    ['Field','Longitude',String(payload.request.field.longitude)],
    ['Field','Baseline',payload.request.field.baseline],
    ['Field','Boundary confirmed',String(payload.request.field.boundaryConfirmed)],
    ['Decision','Selection',String(payload.request.decision.selection??'')],
    ['Decision','Reviewed',String(payload.request.decision.reviewed)],
    ['Decision','Notes',payload.request.decision.notes],
    ['Enterprise','Source',payload.request.enterprise.source],
    ['Enterprise','Reviewed',String(payload.request.enterprise.reviewed)],
  ];
  for(const s of strategies(payload)){
    rows.push(['Strategy',s.id,s.name]);
    rows.push(['Strategy',`${s.id}.feasibility`,s.feasibility]);
    rows.push(['Strategy',`${s.id}.margin_usd_ha_yr`,String(s.margin)]);
    rows.push(['Strategy',`${s.id}.deficit_mm_yr`,String(s.deficit)]);
    rows.push(['Strategy',`${s.id}.cover_days_yr`,String(s.coverDays)]);
    rows.push(['Strategy',`${s.id}.preference`,s.match===null?'withheld':String(s.match)]);
    rows.push(['Strategy',`${s.id}.sequence`,s.sequence]);
  }
  for(const [i,q] of payload.reviewQuestions.entries())rows.push(['Review question',String(i+1),q]);
  for(const [i,line] of windowSummaryLines(payload).entries())rows.push(['Reviewed window connection',String(i+1),line]);
  // SpreadsheetML opens cleanly in Excel without extra libraries.
  const cells=rows.map(row=>`<Row>${row.map(cell=>`<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join('')}</Row>`).join('');
  const xml=`<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Decision report"><Table>${cells}</Table></Worksheet></Workbook>`;
  return new Blob([xml],{type:'application/vnd.ms-excel'});
}

export function reportToWord(payload:ReportPayload):Blob {
  const blocks=reportSummaryLines(payload).map(line=>line?`<p>${xmlEscape(line)}</p>`:'<p>&nbsp;</p>').join('');
  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${xmlEscape(payload.title)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#203d31}p{margin:0 0 8pt}</style></head><body>${blocks}<p><em>${xmlEscape(payload.notice)}</em></p></body></html>`;
  return new Blob(['\ufeff',html],{type:'application/msword'});
}

// The standard PDF fonts do not accept UTF-8 string bytes. Keep WinAnsi glyphs
// (accents, degree signs, scientific units and punctuation), and make unsupported
// code points explicit. JSON/Word/Excel retain the complete original Unicode.
const WIN_ANSI_EXTRA=new Map(Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ').map((char,i)=>
  [char,[128,130,131,132,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,151,152,153,154,155,156,158,159][i]] as const));
function pdfVisibleText(value:string):string {
  return Array.from(value).map(char=>{
    const code=char.codePointAt(0)!;
    if((code>=32&&code<=126)||(code>=160&&code<=255)||WIN_ANSI_EXTRA.has(char))return char;
    if(/\s/u.test(char)||code<32||code===127)return ' ';
    return `[U+${code.toString(16).toUpperCase()}]`;
  }).join('');
}
function pdfLiteral(value:string):string {
  return Array.from(value).map(char=>{
    const byte=WIN_ANSI_EXTRA.get(char)??char.charCodeAt(0);
    if(byte>=128)return '\\'+byte.toString(8).padStart(3,'0');
    return /[\\()]/.test(char)?'\\'+char:char;
  }).join('');
}

export function reportToPdf(payload:ReportPayload):Blob {
  const lines=[...reportSummaryLines(payload),'PDF text: unsupported glyphs appear as [U+...]. JSON retains original Unicode.'].map(pdfVisibleText).flatMap(line=>{
    const width=92;
    if(line.length<=width)return [line];
    const out:string[]=[];
    let rest=line;
    while(rest.length>width){
      const space=rest.lastIndexOf(' ',width),cut=space>=width/2?space:width;
      out.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();
    }
    if(rest)out.push(rest);
    return out;
  });
  const pageHeight=792,pageWidth=612,margin=48,lineHeight=12;
  const usable=Math.floor((pageHeight-margin*2)/lineHeight);
  const pages:string[][]=[];
  for(let i=0;i<lines.length;i+=usable)pages.push(lines.slice(i,i+usable));
  if(!pages.length)pages.push(['(empty report)']);
  const objects:string[]=[''];
  const kids:number[]=[];
  const add=(body:string)=>{objects.push(body);return objects.length-1;};
  // Courier's fixed 5.4 pt advance at 9 pt guarantees even long unbroken farmer
  // notes fit: 92 characters occupy 496.8 pt within the 516 pt printable width.
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  for(const pageLines of pages){
    const content=pageLines.map((line,i)=>{
      const y=pageHeight-margin-(i+1)*lineHeight;
      return `BT /F1 9 Tf ${margin} ${y} Td (${pdfLiteral(line)}) Tj ET`;
    }).join('\n');
    const contentId=add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId=add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`);
    kids.push(pageId);
  }
  const pagesId=add(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] >>`);
  // Patch page parent references now that pages object id is known.
  for(const id of kids)objects[id]=objects[id].replace('/Parent 0 0 R',`/Parent ${pagesId} 0 R`);
  const catalog=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf=`%PDF-1.4\n`;
  const offsets=[0];
  for(let i=1;i<objects.length;i++){
    offsets[i]=pdf.length;
    pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length}\n`;
  pdf+='0000000000 65535 f \n';
  for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf],{type:'application/pdf'});
}

export function triggerDownload(blob:Blob,filename:string):void {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function downloadFormattedReport(payload:ReportPayload,format:ExportFormat):void {
  const stamp=payload.createdAt.slice(0,10);
  if(format==='json'){
    triggerDownload(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'rotation-atlas-decision.json');
    return;
  }
  if(format==='excel'){
    triggerDownload(reportToExcel(payload),`rotation-atlas-decision-${stamp}.xls`);
    return;
  }
  if(format==='word'){
    triggerDownload(reportToWord(payload),`rotation-atlas-decision-${stamp}.doc`);
    return;
  }
  triggerDownload(reportToPdf(payload),`rotation-atlas-decision-${stamp}.pdf`);
}

/** Kept for tests that inspect CSV-style escaping without downloading. */
export function reportToCsvPreview(payload:ReportPayload):string {
  return reportSummaryLines(payload).map(line=>csvEscape(line)).join('\n');
}
