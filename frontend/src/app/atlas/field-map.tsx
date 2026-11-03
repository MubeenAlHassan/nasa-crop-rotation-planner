'use client';
import { useState } from 'react';
import { Layers, PenLine, RotateCcw, Check } from 'lucide-react';
import type { FieldContext } from '@/lib/atlas/types';
export function FieldMap({field,onBoundary}:{field:FieldContext;onBoundary:(boundary:[number,number][])=>void}) {
  const [scale,setScale]=useState('field');const [drawing,setDrawing]=useState(false);const [points,setPoints]=useState<[number,number][]>([]);
  const extent=scale==='SMAP'?12000:scale==='IMERG'?15000:1600;
  const toXY=([lon,lat]:[number,number])=>[400+(lon+93.65)*111320*Math.cos(42.025*Math.PI/180)/extent*800,230-(lat-42.025)*111320/extent*800];
  const polygon=(drawing?points:field.boundary).map(p=>toXY(p).join(',')).join(' ');
  const cell=scale==='HLS'?30:scale==='ECOSTRESS'?70:scale==='SMAP'?9000:scale==='IMERG'?11100:0;
  const cellPx=cell/extent*800;
  return <section className="ra-map" aria-label="Illustrative field boundary map">
    <div className="ra-map-tools"><span><span className="ra-dot"/> Iowa demonstration boundary</span><button onClick={()=>{setDrawing(!drawing);setScale('field');setPoints([]);}} aria-pressed={drawing}><PenLine size={14}/>{drawing?'Cancel drawing':'Draw field'}</button></div>
    <svg viewBox="0 0 800 460" role="img" aria-label="Schematic field outline and satellite pixel scale guide; no satellite imagery" onClick={event=>{if(!drawing)return;const rect=event.currentTarget.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*800,y=(event.clientY-rect.top)/rect.height*460;setPoints([...points,[-93.65+(x-400)/800*extent/(111320*Math.cos(42.025*Math.PI/180)),42.025-(y-230)/800*extent/111320]]);}} className={drawing?'ra-drawing':''}>
      <defs><pattern id="ra-lines" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><path d="M0 0V12" stroke="#93a482" strokeWidth="1" opacity=".4"/></pattern><pattern id="ra-grid" width={Math.max(1,cellPx)} height={Math.max(1,cellPx)} patternUnits="userSpaceOnUse" x="400" y="230"><rect width={Math.max(1,cellPx)} height={Math.max(1,cellPx)} fill="none" stroke="#e9b858" strokeWidth="1.5"/></pattern></defs>
      <rect width="800" height="460" fill="#d8dfc9"/>
      {scale==='field'||scale==='HLS'||scale==='ECOSTRESS'?<g><path d="M0 0H268L245 192H0Z" fill="#b4c49b"/><path d="M280 0H620L608 190H257Z" fill="#c4c5a0"/><path d="M0 208H240L226 460H0Z" fill="#c4cdb4"/><path d="M255 208H608L583 460H240Z" fill="#adc09b"/><path d="M635 0H800V460H603Z" fill="#c7d1b8"/><rect width="800" height="460" fill="url(#ra-lines)"/><path d="M0 200H617M270 0L233 460" stroke="#f1eedb" strokeWidth="8"/><path d="M690 -20C620 110 775 167 706 280S682 380 737 480" fill="none" stroke="#8eada5" strokeWidth="15"/><path d="M690 -20C620 110 775 167 706 280S682 380 737 480" fill="none" stroke="#b6cfbf" strokeWidth="8"/></g>:<g stroke="#bdc9ac" fill="none"><path d="M0 160H800M0 320H800M200 0V460M600 0V460"/><text x="30" y="90" fill="#52654d" fontSize="16">Regional scale · field shown at center</text></g>}
      {cell>0&&<rect width="800" height="460" fill="url(#ra-grid)"/>}
      <polygon points={polygon} fill="#5e8852" fillOpacity=".2" stroke="#294d35" strokeWidth="3" strokeLinejoin="round" strokeDasharray={drawing?'6 4':undefined}/>
      {(drawing?points:field.boundary.slice(0,-1)).map((p,i)=>{const [x,y]=toXY(p);return <circle key={i} cx={x} cy={y} r="4" fill="#f8f8ed" stroke="#294d35" strokeWidth="2"/>;})}
      {!drawing&&<g><rect x="302" y="210" width="196" height="42" rx="8" fill="#fffdf4"/><text x="400" y="236" textAnchor="middle" fill="#2c4535" fontSize="14" fontWeight="600">Your illustrative field</text></g>}
      <path d="M752 45V20L746 30M752 20L758 30" fill="none" stroke="#415141" strokeWidth="2"/><text x="752" y="62" textAnchor="middle" fontSize="11" fill="#415141">N</text>
      <path d="M28 412V420H128V412" fill="none" stroke="#415141" strokeWidth="2"/><text x="28" y="440" fontSize="11" fill="#415141">{Math.round(extent/8)} m · schematic</text>
    </svg>
    {drawing&&<div className="ra-draw-actions"><span>Click at least 3 corners. {points.length} placed.</span><button onClick={()=>setPoints([])}><RotateCcw size={14}/>Clear</button><button disabled={points.length<3} onClick={()=>{onBoundary([...points,points[0]]);setDrawing(false);}}><Check size={14}/>Use boundary</button></div>}
    <div className="ra-map-caption"><div><Layers size={15}/><strong>What can the satellite see?</strong></div><select aria-label="Satellite pixel scale" value={scale} onChange={e=>{setScale(e.target.value);setDrawing(false);}}><option value="field">Field outline</option><option value="HLS">HLS · 30 m</option><option value="ECOSTRESS">ECOSTRESS · 70 m</option><option value="SMAP">SMAP · 9 km grid</option><option value="IMERG">IMERG · 0.1° grid</option></select></div>
    <p className="ra-map-note">{scale==='field'?'Illustrative parcels, not satellite imagery. Drawn boundaries share the cached regional weather.':'Nominal pixel-size guide; grid placement is illustrative. No observations from this layer are loaded.'}</p>
  </section>;
}
