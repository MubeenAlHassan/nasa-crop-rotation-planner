import type { Metadata } from 'next';
import Atlas from './atlas-next-client';
import './atlas.css';
export const metadata:Metadata={title:'Rotation Atlas · Iowa field workspace',description:'Compare four rotations with historical NASA weather, clear assumptions and farmer priorities.'};
export default function AtlasPage(){return <Atlas/>;}
