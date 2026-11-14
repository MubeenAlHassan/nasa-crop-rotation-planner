"""Offline ECOSTRESS C2 native-grid extraction. Numerical outputs require verified local files."""
import argparse,json,hashlib,math
from pathlib import Path
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
import numpy as np,rasterio
from rasterio.windows import Window
from shapely.geometry import shape,box,mapping
from shapely.ops import transform as geometry_transform
from pyproj import Transformer
CACHE=Path('backend/.provider_cache/ecostress')
DOC='https://github.com/ECOSTRESS-Collection-2/ECOv002-L3T-L4T-JET/blob/main/documentation/ECOSTRESS_User_Guide_V2.md'
SPECS={'LST':('K','°C','instantaneous surface retrieval'),'LST_err':('K','K','instantaneous pixel retrieval error estimate'),'PTJPLSMinst':('W/m²','W/m²','instantaneous modeled latent heat flux'),'ETdaily':('mm/day','mm/day','modeled sunrise-to-sunset ET, upscaled from overpass; not measured 24-hour flux'),'ETinstUncertainty':('W/m²','W/m²','instantaneous between-model standard deviation; not total uncertainty or daily ET error'),'ESI':('1','1','instantaneous PT-JPL-SM actual ET / potential ET; not standardized anomaly'),'PET':('W/m²','W/m²','instantaneous PT-JPL-SM potential latent heat flux')}
PRODUCTS={'ECO_L2T_LSTE':['LST','LST_err'],'ECO_L3T_JET':['PTJPLSMinst','ETdaily','ETinstUncertainty'],'ECO_L4T_ESI':['ESI','PET']}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def finite(v):return float(v) if np.isfinite(v) else None
def valid_numeric(name,v):return v is not None and (0<=v<=1 if name=='ESI' else v>0 if name=='LST' else v>=0)
def rejection(cloud,water,qc,error):
 reasons=[]
 if cloud!=0:reasons.append('cloud-or-missing-cloud-mask')
 if water!=0:reasons.append('water-or-missing-water-mask')
 if qc is None or int(qc)&15:reasons.append('LST-mandatory-or-data-quality-rejection')
 if error is None or not 0<=error<=2:reasons.append('LST-error-missing-or-over-2K')
 return reasons

def build(cache,out):
 catalog=json.loads((cache/'catalog.json').read_text());field=json.loads(Path('frontend/public/atlas/field-evidence.json').read_text())['field'];geo=field['geometry'];project=Transformer.from_crs(4326,32615,always_xy=True);inverse=Transformer.from_crs(32615,4326,always_xy=True);polygon=geometry_transform(project.transform,shape(geo));cells=None;window=None;affine=None;records=[];receipts={}
 for p in sorted((cache/'receipts').glob('*.json')):
  r=json.loads(p.read_text());receipts[r['id']]=r
 def read(r,band):
  nonlocal cells,window,affine
  a=next((a for a in r['assets'] if a['file'].endswith('_'+band+'.tif')),None)
  if not a:raise ValueError('Required scientific asset unavailable: '+band)
  p=cache/a['file']
  if sha(p)!=a['sha256']:raise ValueError('Source checksum mismatch')
  with rasterio.open(p) as ds:
   if ds.dtypes[0]!=('uint16' if band=='QC' else 'uint8' if band in ['cloud','water'] else 'float32'):raise ValueError('Unverified native dtype')
   if band in SPECS and (ds.nodata is None or np.isfinite(ds.nodata)):raise ValueError('Unverified scientific fill value')
   if ds.crs.to_epsg()!=32615 or ds.res!=(70.,70.) or ds.count!=1 or ds.scales!=(1.,) or ds.offsets!=(0.,):raise ValueError('Unverified native grid or scaling')
   if affine is None:
    affine=ds.transform;left,bottom,right,top=polygon.bounds;r0,c0=ds.index(left,top);r1,c1=ds.index(right,bottom);window=Window(c0,r0,c1-c0+1,r1-r0+1);cells=[]
    for row in range(r0,r1+1):
     for col in range(c0,c1+1):
      x,y=ds.transform*(col,row);native=box(x,y-70,x+70,y);area=polygon.intersection(native).area
      cells.append({'id':f'{row}:{col}','row':row,'column':col,'fieldAreaM2':area,'geometry':mapping(geometry_transform(inverse.transform,native))})
   if ds.transform!=affine:raise ValueError('Misaligned native files')
   values=ds.read(1,window=window).reshape(-1)
   if len(values)!=len(cells):raise ValueError('Truncated native window')
   return [finite(v) if (ds.nodata is None or not np.isfinite(ds.nodata) or v!=ds.nodata) else None for v in values],{'dtype':ds.dtypes[0],'nodata':finite(ds.nodata) if ds.nodata is not None else None,'nodataEncoding':'NaN' if ds.nodata is not None and not np.isfinite(ds.nodata) else 'none-or-numeric','scale':ds.scales[0],'offset':ds.offsets[0],'embeddedUnits':ds.units[0],'shape':list(ds.shape)}
 for id,r in sorted(receipts.items(),key=lambda item:(item[1]['start'],item[1]['product'])):
  if r['failures']:continue
  product=r['product'];metadataAsset=next(a for a in r['assets'] if a['file']==id+'.json');metadataPath=cache/metadataAsset['file']
  if sha(metadataPath)!=metadataAsset['sha256']:raise ValueError('Metadata checksum mismatch')
  meta=json.loads(metadataPath.read_text());m=meta['StandardMetadata'];pm=meta['ProductMetadata']
  if m['ShortName']!=product or m['CollectionLabel']!='ECOv002' or m['BuildID'] not in ['0711','0712']:raise ValueError('Unverified product processing version')
  start=m['RangeBeginningDate']+'T'+m['RangeBeginningTime']+'Z';end=m['RangeEndingDate']+'T'+m['RangeEndingTime']+'Z'
  if abs((datetime.fromisoformat(start.replace('Z','+00:00'))-datetime.fromisoformat(r['start'].replace('Z','+00:00'))).total_seconds())>.001:raise ValueError('Catalog/scientific time mismatch')
  if abs((datetime.fromisoformat(end.replace('Z','+00:00'))-datetime.fromisoformat(r['end'].replace('Z','+00:00'))).total_seconds())>.001:raise ValueError('Catalog/scientific end-time mismatch')
  l2id=id.replace('L3T_JET','L2T_LSTE').replace('L4T_ESI','L2T_LSTE');l2=receipts.get(l2id)
  cloud,cloudSchema=read(r,'cloud');water,waterSchema=read(r,'water')
  if l2 and not l2['failures']:qc,qcSchema=read(l2,'QC');err,errSchema=read(l2,'LST_err')
  else:qc=[None]*len(cloud);err=[None]*len(cloud);qcSchema=errSchema=None
  reasons=[rejection(c,w,q,e) for c,w,q,e in zip(cloud,water,qc,err,strict=True)]
  if m.get('AutomaticQualityFlag')!='PASS' or m.get('FieldOfViewObstruction')!='NO':reasons=[rs+['granule-quality-or-obstruction'] for rs in reasons]
  bands={}
  for band in PRODUCTS[product]:
   raw,schema=read(r,band);unit,display,support=SPECS[band];rr=[rs+([] if valid_numeric(band,v) else ['missing-or-invalid-value']) for rs,v in zip(reasons,raw,strict=True)];values=[(v-273.15 if band=='LST' else v) if not rs else None for v,rs in zip(raw,rr,strict=True)];validArea=sum(c['fieldAreaM2'] for c,v in zip(cells,values,strict=True) if v is not None);coverage=min(1.,validArea/polygon.area)
   mean=sum(c['fieldAreaM2']*v for c,v in zip(cells,values,strict=True) if v is not None)/validArea if coverage>=.8 else None
   bands[band]={'units':display,'nativeUnits':unit,'unitAuthority':DOC,'temporalSupport':support,'rawValues':raw,'values':values,'reasons':rr,'validAreaFraction':coverage,'validPixels':sum(v is not None and c['fieldAreaM2']>0 for c,v in zip(cells,values,strict=True)),'fieldMean':None if band in ['LST_err','ETinstUncertainty'] else mean,'schema':schema}
  records.append({'id':id,'product':product,'version':'002','build':m['BuildID'],'pgeVersion':m['PGEVersion'],'start':start,'end':end,'localTime':datetime.fromisoformat(start.replace('Z','+00:00')).astimezone(ZoneInfo('America/Chicago')).isoformat(),'dayNight':m['DayNightFlag'],'bands':bands,'qa':{'cloud':cloud,'water':water,'QC':qc,'LST_err':err,'schemas':{'cloud':cloudSchema,'water':waterSchema,'QC':qcSchema,'LST_err':errSchema},'l2Source':l2id if l2 else None},'sources':r['assets'],'ancillaryInputs':pm.get('AncillaryNWP',m.get('AncillaryInputPointer','unknown'))})
 inventory=[{'id':e['producer_granule_id'],'product':p,'version':'002','start':e['time_start'],'end':e['time_end'],'status':'acquired' if e['producer_granule_id'] in {r['id'] for r in records} else 'not-acquired','failures':receipts.get(e['producer_granule_id'],{}).get('failures',[])} for p,es in catalog['products'].items() for e in es]
 data={'schemaVersion':'ecostress-pilot-v1','policy':'ecostress-c2-conservative-v1','verifiedAt':'2026-11-13','field':field,'crs':'EPSG:32615','nativeCellSizeM':70,'transform':list(affine)[:6] if affine else None,'cells':cells or [],'records':records,'inventory':inventory,'requestedPeriod':{'start':'2024-06-01','end':'2024-06-30'},'minimumFieldCoverage':.8,'versionSelection':{'selected':'002','availableCollections':['002','003'],'june003Matches':0,'reason':'CMR June 2024 pilot search has no Collection 3 matches; Collection 2 retained explicitly.'},'discovery':{k:v for k,v in catalog.items() if k!='products'},'limitations':['70 m product grid cells retain mixed soil/vegetation signals and geolocation uncertainty; not isolated canopy temperature.','LST does not diagnose water stress. CWSI withheld: canopy temperature and wet/dry baselines are unavailable.','ETdaily is modeled daytime water transfer to the atmosphere, not irrigation demand or avoidable waste; sparse dates are not summed into monthly ET.','ESI is PT-JPL-SM actual/potential instantaneous ET (0–1), not a standardized drought anomaly. Low values prompt local review, not diagnosis.','ET ensemble spread is not total predictive uncertainty; LST pixel errors are not field-mean confidence intervals.','ET/ESI use ECOSTRESS LST, STARS vegetation and GEOS meteorology; comparison with Landsat, POWER or SMAP does not provide independent validation.'],'provenance':{'pipeline':'backend/atlas/ecostress_process.py','pipelineSha256':sha(Path(__file__)),'producerGuideSha256':json.loads(Path(__file__).with_name('ecostress_product_policy.json').read_text())['docs'][0]['sha256'],'resampling':'none; native COG window with exact UTM pixel/field intersections','policyFileSha256':sha(Path(__file__).with_name('ecostress_product_policy.json')),'documentation':[DOC,'https://lpdaac.usgs.gov/documents/1574/ECOL2_User_Guide_V2.pdf','https://lpdaac.usgs.gov/documents/1655/ECO_L1C-4_Grid_Tile_User_Guide_V2.pdf']}}
 out.mkdir(parents=True,exist_ok=True);p=out/'pilot.json';p.write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n');index={'schemaVersion':'ecostress-index-v1','path':'/atlas/ecostress/pilot.json','sha256':sha(p),'bytes':p.stat().st_size,'records':len(records),'dates':sorted({r['start'][:10] for r in records})};(out.parent/'ecostress-index.json').write_text(json.dumps(index,indent=2)+'\n');print(json.dumps(index));return data
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,default=CACHE);p.add_argument('--out',type=Path,default=Path('frontend/public/atlas/ecostress'));a=p.parse_args();build(a.cache,a.out)
