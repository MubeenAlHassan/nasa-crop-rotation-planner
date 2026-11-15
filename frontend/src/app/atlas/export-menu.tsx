'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Download} from 'lucide-react';
import {EXPORT_FORMATS,type ExportFormat} from '@/lib/atlas/export-report';

export function ExportMenu({disabled,onExport,label='Export report'}:{disabled?:boolean;onExport:(format:ExportFormat)=>void;label?:string}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const menuId=useId();
  useEffect(()=>{
    if(!open)return;
    const onPointer=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('mousedown',onPointer);
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('mousedown',onPointer);document.removeEventListener('keydown',onKey);};
  },[open]);
  return <div className={`ra-export-menu${open?' ra-export-open':''}`} ref={root}>
    <button type="button" className="ra-button ra-button-outline" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} disabled={disabled} onClick={()=>setOpen(v=>!v)}>
      <Download size={15}/><span>{label}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open&&<ul className="ra-export-list" role="menu" id={menuId}>
      {EXPORT_FORMATS.map(format=>(
        <li key={format.id} role="none">
          <button type="button" role="menuitem" onClick={()=>{setOpen(false);onExport(format.id);}}>
            <strong>{format.label}</strong>
            <small>.{format.extension} · {format.hint}</small>
          </button>
        </li>
      ))}
    </ul>}
  </div>;
}
