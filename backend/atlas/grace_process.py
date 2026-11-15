"""Network-free native-mascon context; no gain scaling, trend, or groundwater inference."""
import argparse,hashlib,json,math
from datetime import datetime,timedelta,timezone
from pathlib import Path
import h5py,numpy as np
from pyproj import Geod
CACHE=Path('backend/.provider_cache/grace');EPOCH=datetime(2002,1,1,tzinfo=timezone.utc)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def text(x):return x.decode() if isinstance(x,bytes) else str(x)
def months(start,end):return [f'{y:04}-{m:02}' for y in range(int(start[:4]),int(end[:4])+1) for m in range(1,13) if start<=f'{y:04}-{m:02}'<=end]
def iso(v):return (EPOCH+timedelta(days=float(v))).isoformat().replace('+00:00','Z')
def nominal_months(f):
 missing=text(f.attrs['months_missing']).split(';');labels=[m for m in months(text(f.attrs['time_coverage_start'])[:7],text(f.attrs['time_coverage_end'])[:7]) if m not in missing]
 if len(labels)!=len(f['time']):raise ValueError('Nominal-month metadata mismatch')
 for label,t,b in zip(labels,f['time'][:],f['time_bounds'][:]):
  mid=datetime.fromisoformat(label+'-15').replace(tzinfo=timezone.utc)
  if not b[0]<=t<=b[1] or abs((EPOCH+timedelta(days=float(t))-mid).days)>35:raise ValueError('Invalid month/time association')
 return labels

def aggregate(values,sigma,weights):
 if not all(v is not None for v in values):return None,None
 mean=sum(v*w for v,w in zip(values,weights))
 # Triangle bound on standard deviation for any admissible correlation matrix;
 # not a confidence interval, and excludes unrepresented systematic errors.
 bound=sum(s*w for s,w in zip(sigma,weights)) if all(s is not None for s in sigma) else None
 return mean,bound

def process(out=Path('frontend/public/atlas/grace')):
 receipt=json.loads((CACHE/'receipt.json').read_text());source=CACHE/receipt['file']
 if sha(source)!=receipt['sha256']:raise ValueError('Source checksum mismatch')
 with h5py.File(source) as f:
  if text(f.attrs['title'])!='JPL GRACE and GRACE-FO MASCON RL06.3Mv04 CRI' or text(f.attrs['time_mean_removed'])!='2004.000 to 2009.999':raise ValueError('Unverified version/baseline')
  for name in ['lwe_thickness','uncertainty']:
   v=f[name]
   if text(v.attrs['units'])!='cm' or v.shape!=(len(f['time']),360,720) or float(v.attrs['_FillValue'][0])!=-99999 or 'scale_factor' in v.attrs or 'add_offset' in v.attrs:raise ValueError('Unverified encoding')
  lat=f['lat'][:];lon=f['lon'][:];ids=f['mascon_ID'][:];land=f['land_mask'][:];gain=f['scale_factor'][:];lb=f['lat_bounds'][:];ob=f['lon_bounds'][:]
  if not np.allclose(np.diff(lat),.5) or not np.allclose(np.diff(lon),.5):raise ValueError('Unexpected grid')
  lon=lon-360*(lon>180);selected=np.unique(ids[(lat[:,None]>=40)&(lat[:,None]<=44)&(lon[None,:]>=-96)&(lon[None,:]<=-91)])
  geod=Geod(ellps='WGS84');cells=[];mascons=[];positions=[]
  for id in selected:
   rows,cols=np.where(ids==id);positions.append((rows,cols));area=0
   if not np.all(land[rows,cols]==1):raise ValueError('Region includes non-land support')
   for r,c in zip(rows,cols):
    south,north=sorted(lb[r]);west,east=sorted(ob[c]-360*(ob[c]>180));ring=[[float(west),float(south)],[float(east),float(south)],[float(east),float(north)],[float(west),float(north)],[float(west),float(south)]];a=abs(geod.polygon_area_perimeter(*zip(*ring))[0]);area+=a
    cells.append({'row':int(r),'column':int(c),'masconId':int(id),'areaM2':a,'landMask':int(land[r,c]),'gainFactor':float(gain[r,c]) if gain[r,c]!=-99999 else None,'geometry':{'type':'Polygon','coordinates':[ring]}})
   mascons.append({'id':int(id),'areaM2':area,'cellCount':len(rows)})
  total=sum(m['areaM2'] for m in mascons);weights=[m['areaM2']/total for m in mascons]
  for m,w in zip(mascons,weights):m['weight']=w
  labels=nominal_months(f);lookup={m:i for i,m in enumerate(labels)};records=[]
  for month in months('2005-01','2024-12'):
   if month not in lookup:
    records.append({'month':month,'status':'missing','reason':'GRACE/GRACE-FO mission gap' if '2017-07'<=month<='2018-05' else 'Provider reports missing monthly solution','sourceIndex':None,'time':None,'start':None,'end':None,'valuesMm':[None]*len(mascons),'sigmaMm':[None]*len(mascons),'regionalMm':None,'correlationBoundMm':None});continue
   i=lookup[month];values=[];sigmas=[];reasons=[]
   # Read each native latitude band once; preserve replicated values as one mascon estimate.
   raw=f['lwe_thickness'][i];err=f['uncertainty'][i]
   for rows,cols in positions:
    v=raw[rows,cols];s=err[rows,cols]
    if not np.all(np.isfinite(v)&(v!=-99999)):values.append(None);reasons.append('Missing mascon values')
    else:
     if not np.allclose(v,v[0],rtol=0,atol=1e-10):raise ValueError('Within-mascon variability requires reviewed aggregation')
     values.append(float(v[0])*10)
    if not np.all(np.isfinite(s)&(s>=0)&(s!=-99999)):sigmas.append(None);reasons.append('Missing uncertainty')
    else:
     if not np.allclose(s,s[0],rtol=0,atol=1e-10):raise ValueError('Unexpected within-mascon uncertainty')
     sigmas.append(float(s[0])*10)
   mean,bound=aggregate(values,sigmas,weights);b=f['time_bounds'][i]
   records.append({'month':month,'status':'accepted' if mean is not None else 'rejected','reason':'; '.join(reasons),'sourceIndex':i,'time':iso(f['time'][i]),'start':iso(b[0]),'end':iso(b[1]),'valuesMm':values,'sigmaMm':sigmas,'regionalMm':mean,'correlationBoundMm':bound})
  seasonal=[]
  for m in range(1,13):
   vals=[r['regionalMm'] for r in records if int(r['month'][5:])==m and r['regionalMm'] is not None]
   seasonal.append({'calendarMonth':m,'count':len(vals),'meanMm':float(np.mean(vals)) if vals else None,'minMm':min(vals) if vals else None,'maxMm':max(vals) if vals else None})
  metadata={k:text(f.attrs[k]) for k in ['title','source','product_version','date_created','time_mean_removed','months_missing','geospatial_lat_resolution','GIA_removed','postprocess_3','user_note_1','user_note_2']}
 data={'schemaVersion':'grace-regional-v1','policyVersion':'whole-inland-mascons-v1','product':receipt['product'],'version':receipt['version'],'units':'mm equivalent water thickness','referencePeriod':'2004-01 through 2009-12 (provider time mean)','gridSpacingDegrees':.5,'nativeSupport':'3-degree equal-area mascons; grid cells are not independent','gainApplied':False,'region':{'id':'iowa-six-mascons','name':'Iowa and surrounding Midwest — six complete inland mascons','selectionBox':[-96,40,-91,44],'selection':'Union of complete mascon IDs intersecting seed box at native cell centers; fixed regional context, not a basin or field boundary','areaKm2':total/1e6,'pilot':[-93.65,42.025]},'mascons':mascons,'cells':cells,'records':records,'seasonal':seasonal,'source':receipt,'sourceMetadata':metadata,'timePolicy':'Nominal months reconstructed from complete provider month sequence excluding months_missing; exact source centers and inclusive bounds retained. Some intervals overlap or cross calendar boundaries. No calendar-day redistribution.','uncertaintyPolicy':'Native 1-sigma mascon diagnostics. Regional correlationBoundMm=sum(weight*sigma): perfect-positive-correlation upper bound for represented random errors only, not a calibrated confidence interval. Full covariance and systematic/leakage errors unavailable; no independent-pixel or independent-month reduction.','limitations':['Terrestrial storage includes soil water, snow, surface water and groundwater; no groundwater depletion inference.','CRI reduces coastal leakage; inland leakage and regularization effects remain. No gain factors applied to complete mascon support.','No trend estimate or significance claim; temporal dependence and irregular solution windows remain.','Seasonal ranges describe available 2005–2024 solutions, not uncertainty intervals or future projections.','Regional storage and SMAP moisture, IMERG/POWER precipitation and ECOSTRESS ET describe different stocks, fluxes and supports; shared models and processing prevent independent-validation claims.'],'documentation':['https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4','https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/'],'documentationVerified':'2026-11-13','processorSha256':sha(Path(__file__)),'releaseNotesSha256':sha(CACHE/'release-notes.txt')}
 out.mkdir(parents=True,exist_ok=True);p=out/'iowa-region.json';p.write_text(json.dumps(data,allow_nan=False,separators=(',',':'))+'\n');index={'schemaVersion':'grace-index-v1','path':'/atlas/grace/iowa-region.json','sha256':sha(p),'bytes':p.stat().st_size,'start':'2005-01','end':'2024-12','accepted':sum(r['status']=='accepted' for r in records),'missing':sum(r['status']=='missing' for r in records)};(out.parent/'grace-index.json').write_text(json.dumps(index,indent=2)+'\n');print(json.dumps(index));return data
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=Path('frontend/public/atlas/grace'));process(p.parse_args().out)
