// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {DEFAULT_REQUEST,CROPS} from '@/lib/atlas/catalog';
import {compare,sensitivity} from '@/lib/atlas/engine';
import type {EvidenceSeries} from '@/lib/atlas/types';
import type {NasaContext,NasaRow} from '@/lib/atlas/nasa-context';
import type {NasaSeason} from '@/lib/atlas/nasa-season';
import {parseGrace} from '@/lib/atlas/grace';
import {parseEco} from '@/lib/atlas/ecostress';
import {RainChart,Timeline,SensitivityChart,shortNames,strategyColors} from './charts';
import {RootZoneChart} from './root-zone-chart';
import {StorageChart,RegionMap} from './grace-panel';
import {NativeMap} from './nasa-context-panel';
import {EcoMap} from './ecostress-panel';

const {readFileSync}=await vi.importActual<typeof import('node:fs')>('node:fs');
const json=(path:string)=>JSON.parse(readFileSync('public/atlas/'+path,'utf8'));
const weather=json('iowa.json') as EvidenceSeries;
const grace=parseGrace(json('grace/iowa-region.json'));
const eco=parseEco(json('ecostress/pilot.json'));
const seasons=Array.from({length:9},(_,i)=>json(`nasa-season/2024-${String(i+3).padStart(2,'0')}.json`) as NasaSeason);
const context=json('nasa-context.json') as NasaContext;
const render=(element:React.ReactNode)=>{const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(element);expect(host.innerHTML).not.toMatch(/NaN|Infinity/);return host;};
const confirmed=()=>{const r=structuredClone(DEFAULT_REQUEST);Object.assign(r.field,{boundaryConfirmed:true,baselineConfirmed:true,laborAvailable:true,coverEquipment:true,smallGrainBuyer:true,smallGrainEquipment:true,smallGrainSuitable:true,forageSuitable:true,forageBuyer:true,forageEquipment:true,budget:4000});return r;};

describe('Rainfall bars: source totals, scale and missingness',()=>{
  it.each([40,100,140])('matches all 12 monthly totals and paired bars at %s%% rainfall',adjustment=>{
    const expected=Array.from({length:12},(_,i)=>weather.weather.filter(d=>Number(d.date.slice(5,7))===i+1).reduce((sum,d)=>sum+d.rain!,0)/12);
    const host=render(<RainChart data={weather} adjustment={adjustment}/>),scale=Math.max(...expected)*1.4;
    const pairs=host.querySelectorAll('.ra-chart-bar-pair');
    for(let i=0;i<12;i++){
      const bars=pairs[i].querySelectorAll<HTMLElement>('span');
      expect(parseFloat(bars[0].style.height)/100*scale).toBeCloseTo(expected[i],8);
      expect(parseFloat(bars[1].style.height)/100*scale).toBeCloseTo(expected[i]*adjustment/100,8);
      expect(parseFloat(bars[1].style.height)).toBeLessThanOrEqual(100.00000001);
      const cells=host.querySelectorAll('tbody tr')[i].querySelectorAll('td');
      expect(cells[0].textContent).toBe(expected[i].toLocaleString('en-US',{maximumFractionDigits:1}));
    }
  });
  it('withholds missing and duplicate days, and preserves real zero-height rainfall bars',()=>{
    for(const mutate of [(d:EvidenceSeries)=>{d.weather[0].rain=null;},(d:EvidenceSeries)=>{d.weather.push(d.weather[0]);},(d:EvidenceSeries)=>{d.timeStandard='LST';}]){
      const data=structuredClone(weather);mutate(data);const host=render(<RainChart data={data} adjustment={100}/>);
      expect(host.querySelector('.ra-chart-bar-pair')!.textContent).toContain('Withheld');
      expect(host.querySelector('.ra-chart-bar-pair')!.querySelector('span')).toBeNull();
    }
    const zero=structuredClone(weather);zero.weather.forEach(d=>{d.rain=0;});
    const host=render(<RainChart data={zero} adjustment={140}/>);
    expect(Array.from(host.querySelectorAll<HTMLElement>('.ra-chart-bar-pair span')).every(b=>b.style.height==='0%')).toBe(true);
    const css=readFileSync('src/app/atlas/atlas.css','utf8');
    expect(css.match(/\.ra-chart-bar-pair span \{[^}]+\}/)?.[0]).toContain('min-height:0');
  });
});

describe('Modeled crop and sensitivity charts',()=>{
  it('matches every daily crop, complete date span, event and period length for all four strategies',()=>{
    const result=compare(weather,confirmed());
    for(const strategy of result.strategies){
      const host=render(<Timeline result={strategy}/>),tracks=host.querySelectorAll('.ra-season-track');
      expect(tracks).toHaveLength(4);
      for(let i=0;i<4;i++){
        const year=strategy.years[i],days=strategy.daily.filter(d=>d.planningYear===year.year),marks=tracks[i].querySelectorAll('span');
        expect(marks).toHaveLength(year.weatherYear===2016?366:365);
        days.forEach((day,index)=>{
          expect(marks[index].getAttribute('data-date')).toBe(day.date);
          expect(marks[index].getAttribute('data-crop')).toBe(day.crop??'gap');
          expect(marks[index].getAttribute('title')).toContain(day.crop?CROPS[day.crop].name:'Possible cover gap');
        });
        const months=host.querySelectorAll('.ra-season-months')[i].querySelectorAll<HTMLElement>('span');
        expect(months).toHaveLength(12);
        for(let m=0;m<12;m++)expect(Number(months[m].style.flexGrow)).toBe(days.filter(d=>Number(d.date.slice(5,7))===m+1).length);
      }
      const tables=host.querySelectorAll('tbody');
      expect(Array.from(tables[0].querySelectorAll('tr')).reduce((total,tr)=>total+Number(tr.lastElementChild!.textContent),0)).toBe(1461);
      expect(tables[1].querySelectorAll('tr')).toHaveLength(strategy.daily.filter(d=>d.events.length).length);
    }
  });
  it('replays every rainfall sweep point and matches preference labels, colors and displayed margins',()=>{
    const request=confirmed(),sweep=sensitivity(weather,request),host=render(<SensitivityChart result={sweep}/>);
    const marks=host.querySelectorAll<HTMLElement>('.ra-sweep-track > div');
    sweep.sweeps.rainfall.forEach((point,index)=>{
      const replay=compare(weather,{...request,rainfall:point.value});
      expect(point.preferred).toBe(replay.preferred);
      expect(marks[index].textContent).toContain(`${point.value}%`);
      expect(marks[index].textContent).toContain(point.preferred?shortNames[point.preferred]:'Preference withheld');
      expect(marks[index].style.getPropertyValue('--ra-sweep-color')).toBe(point.preferred?strategyColors[point.preferred]:'#e4e1d7');
      const reference=replay.strategies.find(s=>s.id===(sweep.reference??'baseline'))!;
      expect(point.margin).toBeCloseTo(reference.margin,8);
    });
    const withheld=sensitivity(weather,structuredClone(DEFAULT_REQUEST));
    expect(render(<SensitivityChart result={withheld}/>).textContent).toContain('Preference withheld');
  });
});

describe('Daily regional moisture trajectory',()=>{
  it('matches all 275 daily points across nine months to the original three-hour model intervals',()=>{
    let count=0;
    for(const season of seasons){
      const host=render(<RootZoneChart data={season}/>);
      const points=host.querySelectorAll('circle');
      expect(points).toHaveLength(season.days.filter(d=>d.root[4].mean!==null).length);
      for(const point of points){
        const date=point.getAttribute('data-date')!,start=Date.parse(date),end=start+86400000;
        const intervals=season.rootZone.filter(r=>Date.parse(r.start)<end&&Date.parse(r.end)>start);
        expect(intervals).toHaveLength(8);
        const weighted=intervals.reduce((sum,r)=>sum+r.root[4]!*(Math.min(end,Date.parse(r.end))-Math.max(start,Date.parse(r.start))),0)/86400000;
        expect((135-Number(point.getAttribute('cy')))*.9/105).toBeCloseTo(weighted,10);
        const last=Date.parse(season.end)-86400000;
        expect(Number(point.getAttribute('cx'))).toBeCloseTo(50+(start-Date.parse(season.start))/(last-Date.parse(season.start))*680,8);
        expect(point.querySelector('title')!.textContent).toContain(date);count++;
      }
    }
    expect(count).toBe(275);
  });
  it('preserves zero, withholds a missing day and does not compress the calendar or interpolate gaps',()=>{
    const data=structuredClone(seasons[0]);data.days[0].root[4].mean=0;data.days[1].root[4].mean=null;
    const host=render(<RootZoneChart data={data}/>);
    expect(host.querySelector('circle')!.getAttribute('cy')).toBe('135');
    expect(host.querySelector(`circle[data-date="${data.days[1].date}"]`)).toBeNull();
    expect(Number(host.querySelectorAll('circle')[1].getAttribute('cx'))).toBeCloseTo(50+2/30*680,8);
    expect(host.querySelectorAll('polyline')).toHaveLength(0);
    expect(host.querySelectorAll('path')).toHaveLength(1); // axes only
  });
});

describe('GRACE storage time series and map',()=>{
  it('matches every accepted regional point to its native area-weighted estimates and keeps gaps unconnected',()=>{
    const host=render(<StorageChart data={grace}/>),points=host.querySelectorAll('circle');
    expect(points).toHaveLength(210);
    const max=Math.max(...grace.records.map(r=>Math.abs(r.regionalMm??0)),1);
    for(const point of points){
      const index=grace.records.findIndex(r=>r.month===point.getAttribute('data-month')),r=grace.records[index];
      const weighted=r.valuesMm.reduce<number>((sum,v,i)=>sum+v!*grace.mascons[i].weight,0);
      expect((110-Number(point.getAttribute('cy')))/80*max).toBeCloseTo(weighted,8);
      expect(Number(point.getAttribute('cx'))).toBeCloseTo(35+index/239*710,8);
      expect(point.querySelector('title')!.textContent).toContain(r.month);
    }
    const missingTicks=Array.from(host.querySelectorAll('line')).filter(l=>l.getAttribute('y1')==='205');
    expect(missingTicks).toHaveLength(30);
    const connections=Array.from(host.querySelectorAll('line')).filter(l=>l.getAttribute('stroke')==='#276a70');
    expect(connections).toHaveLength(grace.records.filter((r,i)=>i>0&&r.regionalMm!==null&&grace.records[i-1].regionalMm!==null).length);
    for(const year of [2005,2010,2015,2020,2024])expect(Number(host.querySelector(`[data-year="${year}"]`)!.getAttribute('x'))).toBeCloseTo(35+(year-2005)*12/239*710,8);
  });
  it('preserves an actual zero on the baseline and handles completely missing records without invented points',()=>{
    const data=structuredClone(grace);data.records[0].regionalMm=0;
    expect(render(<StorageChart data={data}/>).querySelector('circle')!.getAttribute('cy')).toBe('110');
    data.records.forEach(r=>{r.regionalMm=null;});expect(render(<StorageChart data={data}/>).querySelectorAll('circle')).toHaveLength(0);
  });
  it('maps the correct mascon estimate and field position, excluding the duplicate closing vertex',()=>{
    const month='2024-06',host=render(<RegionMap data={grace} month={month} boundary={DEFAULT_REQUEST.field.boundary}/>),record=grace.records.find(r=>r.month===month)!;
    host.querySelectorAll('polygon').forEach((polygon,index)=>{
      const cell=grace.cells[index],value=record.valuesMm[grace.mascons.findIndex(m=>m.id===cell.masconId)];
      expect(polygon.getAttribute('fill')).toBe(value===null?'#dedede':value>=0?'#4d8192':'#c58e4f');
      expect(polygon.querySelector('title')!.textContent).toContain(String(cell.masconId));
    });
    const pts=grace.cells.flatMap(c=>c.geometry.coordinates[0]),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0]));
    const center=DEFAULT_REQUEST.field.boundary.slice(0,-1).reduce((sum,p)=>sum+p[0]/4,0);
    expect(Number(host.querySelector('circle')!.getAttribute('cx'))).toBeCloseTo(40+(center-minX)/(maxX-minX)*410,8);
    const missing=grace.records.find(r=>r.regionalMm===null)!;
    expect(Array.from(render(<RegionMap data={grace} month={missing.month} boundary={DEFAULT_REQUEST.field.boundary}/>).querySelectorAll('polygon')).every(p=>p.getAttribute('fill')==='#dedede')).toBe(true);
  });
});

describe('Native evidence maps: values, units, quality and geographic orientation',()=>{
  it('maps every cell for every SMAP/IMERG context selection, with readable raw-value tooltips',()=>{
    for(const product of [context.smap,context.imerg,context.rootZone]){
      const groups=new Map<string,NasaRow[]>();
      for(const row of product.rows){const key=product.units==='mm/hr'?row.start!:row.period!;groups.set(key,[...(groups.get(key)??[]),row]);}
      for(const rows of groups.values()){
        const host=render(<NativeMap product={product} rows={rows}/>);
        expect(host.querySelectorAll('polygon')).toHaveLength(9);
        host.querySelectorAll('polygon').forEach((polygon,index)=>{
          const cell=product.cells[index],row=rows.find((r:{cell:string})=>r.cell===cell.id),value=row?.value;
          expect(polygon.getAttribute('fill')==='#d4d8db').toBe(value==null);
          expect(polygon.querySelector('title')!.textContent).toContain(`${value==null?'Withheld':value.toFixed(3)} ${product.units}`);
          const points=polygon.getAttribute('points')!.split(' ').map(p=>p.split(',').map(Number));
          expect(points.every(p=>p[0]>=19.999&&p[0]<=380.001&&p[1]>=39.999&&p[1]<=280.001)).toBe(true);
        });
      }
    }
  });
  it('plots all ECOSTRESS overpasses and bands with exactly the archived QA mask and units',()=>{
    let cells=0;
    for(const record of eco.records)for(const [band,values] of Object.entries(record.bands)){
      const host=render(<EcoMap data={eco} record={record} band={band}/>),polygons=host.querySelectorAll('polygon');
      expect(polygons).toHaveLength(eco.cells.length+1);
      for(let i=0;i<eco.cells.length;i++){
        expect(polygons[i].getAttribute('fill')==='#d9dcdc').toBe(values.values[i]===null);
        expect(polygons[i].querySelector('title')!.textContent).toContain(values.units);
        if(values.values[i]!==null)expect(polygons[i].querySelector('title')!.textContent).toContain(values.values[i]!.toFixed(2));
        cells++;
      }
    }
    expect(cells).toBe(6171);
  });
});
