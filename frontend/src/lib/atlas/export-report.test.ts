// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {DEFAULT_REQUEST} from './catalog';
import {compare} from './engine';
import {buildReportPayload,downloadFormattedReport,reportToExcel,reportToPdf,reportToWord} from './export-report';
import type {EvidenceSeries} from './types';

const data=JSON.parse(readFileSync('public/atlas/iowa.json','utf8')) as EvidenceSeries;

function confirmed(){
  const r=structuredClone(DEFAULT_REQUEST);
  Object.assign(r.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});
  return r;
}

describe('Multi-format decision export',()=>{
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
