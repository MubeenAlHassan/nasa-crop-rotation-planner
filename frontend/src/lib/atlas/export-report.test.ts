// @vitest-environment jsdom
import {describe,expect,it,vi} from 'vitest';
import {DEFAULT_REQUEST} from './catalog';
import {compare} from './engine';
import {buildReportPayload,downloadFormattedReport,reportSummaryLines,reportToExcel,reportToPdf,reportToWord} from './export-report';
import type {EvidenceSeries} from './types';

// Load Node's fixture reader directly; jsdom's Vite transform stubs node:fs.
const {readFileSync}=await vi.importActual<typeof import('node:fs')>('node:fs');
const data=JSON.parse(readFileSync('public/atlas/iowa.json','utf8')) as EvidenceSeries;

function confirmed(){
  const r=structuredClone(DEFAULT_REQUEST);
  Object.assign(r.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});
  return r;
}

describe('Multi-format decision export',()=>{
  it('keeps Unicode and markup-like farmer notes as text in Word and Excel',async()=>{
    const request=confirmed();
    request.decision.notes='Café 水 🌾 <script>alert("x")</script> & =SUM(1,2)';
    const payload=buildReportPayload(request,null,null);
    const read=async(blob:Blob)=>new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(blob);});
    const excel=new DOMParser().parseFromString(await read(reportToExcel(payload)),'application/xml');
    expect(excel.querySelector('parsererror')).toBeNull();
    expect(Array.from(excel.getElementsByTagName('Data')).some(cell=>cell.textContent===request.decision.notes)).toBe(true);
    expect(excel.querySelector('[Formula]')).toBeNull();
    const word=new DOMParser().parseFromString(await read(reportToWord(payload)),'text/html');
    expect(word.querySelector('script')).toBeNull();
    expect(word.body.textContent).toContain(request.decision.notes);
  });
  it('writes exact PDF byte offsets and stream lengths for accented, scientific and local Unicode text',async()=>{
    const request=confirmed();
    request.field.name='Café (north) \\ 42° – 水 🌾';
    request.enterprise.note='W'.repeat(400);
    const payload=buildReportPayload(request,compare(data,request),data);
    // Exercise unbroken text and line breaks in farmer-entered notes as well.
    payload.notice+='\n'+request.enterprise.note+'\r\nEnd of note.';
    const blob=reportToPdf(payload);
    const buffer=await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob);});
    const bytes=new Uint8Array(buffer),pdf=new TextDecoder().decode(bytes);
    const xref=Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(new TextDecoder().decode(bytes.slice(xref,xref+4))).toBe('xref');
    const entries=pdf.slice(xref).split('\n');
    const count=Number(entries[1].split(' ')[1]);
    for(let id=1;id<count;id++){
      const offset=Number(entries[id+2].slice(0,10));
      expect(new TextDecoder().decode(bytes.slice(offset,offset+`${id} 0 obj`.length))).toBe(`${id} 0 obj`);
    }
    for(const stream of pdf.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)){
      expect(new TextEncoder().encode(stream[2]).length).toBe(Number(stream[1]));
    }
    // Standard PDF fonts require a declared single-byte encoding. Unsupported
    // characters stay explicit rather than disappearing or becoming mojibake.
    expect(pdf).toContain('/Encoding /WinAnsiEncoding');
    expect(pdf).toContain('[U+6C34]');expect(pdf).toContain('[U+1F33E]');
    expect(pdf).toContain('Caf\\351 \\(north\\) \\\\ 42\\260 \\226');
    expect(pdf).not.toMatch(/[^\x00-\x7F]/);
  });
  it('retains reviewed-window provenance, calendar overlap, trade-offs and corrections in every format',async()=>{
    const request=confirmed();
    request.history.boundary=structuredClone(request.field.boundary);
    request.history.windows=[{id:'local-fixture',start:'2024-03-01',end:'2024-03-09',status:'farmer-confirmed',cover:'bare-soil',note:'Synthetic local scouting record',updatedAt:'2026-11-15T00:00:00Z',observationIds:['missing-fixture']}];
    const payload=buildReportPayload(request,compare(data,request),data);
    expect(payload.historyOpportunities[0].satelliteLink).toBe('local-record-only');
    expect(payload.historyOpportunities[0].calendars.find(c=>c.strategyId==='cover')!.years[1].addedDays).toBe(9);
    expect(JSON.stringify(payload.result)).toContain('windowConnections');
    expect(reportSummaryLines(payload).join('\n')).toContain('whole four-year water shortfall delta');
    const read=async(blob:Blob)=>new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(blob);});
    for(const blob of [reportToExcel(payload),reportToWord(payload),reportToPdf(payload)]){
      const text=await read(blob);
      expect(text).toContain('Synthetic local scouting record');expect(text).toContain('local-record-only');
      expect(text).toContain('baseline 0; added 9');expect(text).toContain('calendar analogy');
    }
    request.history.windows[0].cover='residue-present';
    const corrected=buildReportPayload(request,null,null);
    expect(corrected.historyOpportunities[0].calendars).toEqual([]);
    expect(reportSummaryLines(corrected).join()).toContain('other-cover');
    expect(reportSummaryLines(corrected).join()).not.toContain('added 9');
    request.field.boundary[1][0]-=.001;
    expect(buildReportPayload(request,null,null).historyOpportunities[0].status).toBe('withheld');
  });
  it('builds JSON, Excel, Word and PDF downloads with distinct content types',async()=>{
    const request=confirmed();
    const result=compare(data,request);
    const payload=buildReportPayload(request,{...result,strategies:result.strategies.map(s=>({...s,daily:undefined}))},data);
    expect(payload.title).toMatch(/decision report/i);
    expect(payload.result).toBeTruthy();

    const excel=reportToExcel(payload);
    const word=reportToWord(payload);
    const pdf=reportToPdf(payload);
    expect(excel.type).toBe('application/vnd.ms-excel');
    expect(word.type).toBe('application/msword');
    expect(pdf.type).toBe('application/pdf');
    const read=async(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob);});
    const excelText=await read(excel);
    expect(excelText).toContain('mso-application progid="Excel.Sheet"');
    expect(excelText).toContain('margin_usd_ha_yr');
    expect(excelText).toContain(request.field.name);
    const wordText=await read(word);
    expect(wordText).toContain('Rotation Atlas decision report');
    expect(wordText).toContain('urn:schemas-microsoft-com:office:word');
    const pdfText=await read(pdf);
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('%%EOF');

    const names:string[]=[];
    vi.stubGlobal('URL',{createObjectURL:()=>'blob:test',revokeObjectURL:vi.fn()});
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){names.push(this.download);});
    downloadFormattedReport(payload,'json');
    downloadFormattedReport(payload,'excel');
    downloadFormattedReport(payload,'word');
    downloadFormattedReport(payload,'pdf');
    expect(names).toEqual([
      'rotation-atlas-decision.json',
      expect.stringMatching(/rotation-atlas-decision-\d{4}-\d{2}-\d{2}\.xls/),
      expect.stringMatching(/rotation-atlas-decision-\d{4}-\d{2}-\d{2}\.doc/),
      expect.stringMatching(/rotation-atlas-decision-\d{4}-\d{2}-\d{2}\.pdf/),
    ]);
  });
});
