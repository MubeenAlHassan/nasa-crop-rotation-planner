import type {NasaSeason} from '@/lib/atlas/nasa-season';

export function RootZoneChart({data}:{data:NasaSeason}) {
  const first=data.start.slice(0,10),last=new Date(Date.parse(data.end)-86400000).toISOString().slice(0,10);
  const span=Math.max(86400000,Date.parse(last)-Date.parse(first));
  const x=(date:string)=>50+(Date.parse(date)-Date.parse(first))/span*680;
  const y=(value:number)=>135-value*105/.9;
  return <svg viewBox="0 0 760 170" role="img" aria-label="Daily L4 modeled root-zone moisture trajectory; gaps are missing, not interpolated" style={{width:'100%'}}>
    <text x="4" y="16">L4 daily root-zone moisture (m³/m³); descriptive trajectory</text>
    <path d="M50 30V135H730" fill="none" stroke="#777"/>
    {[0,.3,.6,.9].map(value=><g key={value}><text x="42" y={y(value)+4} textAnchor="end" fontSize="11">{value}</text><line x1="47" x2="730" y1={y(value)} y2={y(value)} stroke="#dde2d8"/></g>)}
    {data.days.map(day=>day.root[4].mean===null?null:<circle key={day.date} data-date={day.date} cx={x(day.date)} cy={y(day.root[4].mean!)} r="4" fill="#245a43"><title>{`${day.date}: ${day.root[4].mean} m³/m³`}</title></circle>)}
    <text x="50" y="163">{first}</text><text x="730" y="163" textAnchor="end">{last}</text>
  </svg>;
}
