"""Acquire and QA public Iowa evidence without modifying the POWER archive.

Requires rasterio, shapely, pyproj, requests, numpy. Reproduce the checked-in
capture with --offline after acquisition, or refresh public sources with --refresh.
Raw native-grid windows are retained; no satellite pixel is fabricated or upsampled.
Signed download URLs are used only in memory, never written to provenance.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

BBOX = [-93.654, 42.022, -93.646, 42.028]
GEOMETRY = {'type':'Polygon','coordinates':[[[-93.654,42.022],[-93.646,42.022],[-93.646,42.028],[-93.654,42.028],[-93.654,42.022]]]}
WKT = 'POLYGON((-93.654 42.022,-93.646 42.022,-93.646 42.028,-93.654 42.028,-93.654 42.022))'
STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1'
SDA = 'https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest'
QA_VERSION = 'landsat-c2-land-aerosol-tiered-v1'
SOURCES = [
 'https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands',
 'https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-reflectance',
 'https://planetarycomputer.microsoft.com/docs/concepts/sas/',
 'https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx',
 'https://sdmdataaccess.nrcs.usda.gov/documents/AdvancedQueries.html',
 'https://www.nrcs.usda.gov/sites/default/files/2022-08/SSURGO-Metadata-Table-Column-Descriptions-Report.pdf',
]
BANDS = ('blue','red','nir08','swir16','qa_pixel','qa_radsat','qa_aerosol')

def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def landsat_valid(qa_pixel:int, qa_radsat:int, qa_aerosol:int)->bool:
    """Conservative valid land rule. QA masks are not resampled or scaled."""
    if not all(isinstance(v,int) and v>=0 for v in (qa_pixel,qa_radsat,qa_aerosol)):
        return False
    # Fill/dilated cloud/cirrus/cloud/shadow/snow/water plus medium cloud confidence.
    pixel_bad = bool(qa_pixel & 0b10111111) or ((qa_pixel >> 8) & 3) >= 2
    # Reject any band saturation/terrain occlusion conservatively.
    # Low/medium aerosol may be directly retrieved OR spatially interpolated by LaSRC.
    # Interpolation is a documented QA category, not by itself an invalid SR pixel.
    # Preserve its area fraction separately; reject climatology/high/fill/water.
    aerosol_good = bool(qa_aerosol & 34) and not (qa_aerosol & 5) and ((qa_aerosol >> 6) & 3) in (1,2)
    return not pixel_bad and qa_radsat == 0 and aerosol_good

def indices(blue_dn,red_dn,nir_dn,swir_dn):
    """Mask fill before scaling, no index thresholds imply bare soil/crop class."""
    if any(not math.isfinite(float(v)) or v <= 0 or v > 65455 for v in (blue_dn,red_dn,nir_dn,swir_dn)):
        return None
    b,r,n,s = [v*.0000275-.2 for v in (blue_dn,red_dn,nir_dn,swir_dn)]
    # Conservative plausible reflectance filter, distinct from encoded valid DN range.
    if any(v<0 or v>1 for v in (b,r,n,s)):
        return None
    if n+r <= 1e-8 or s+r+n+b <= 1e-8:
        return None
    return {'ndvi':(n-r)/(n+r), 'bsi':((s+r)-(n+b))/(s+r+n+b)}

def table_rows(data):
    table=data.get('Table',[])
    if not table: raise ValueError('Soil response has no Table; inspect raw response.')
    return [dict(zip(table[0],row)) for row in table[1:]]

def rootzone_awc(horizons, depth_cm=100):
    """Return 0-depth AWC only with complete, nonoverlapping observed horizon support.

    SSURGO awc_r is cm water/cm soil; cm depth * awc * 10 yields mm.
    No missing horizon/property is imputed and mapunit components are not collapsed.
    """
    intervals=[]
    for h in horizons:
        if any(h.get(k) is None for k in ('hzdept_r','hzdepb_r','awc_r')): continue
        top,bottom,awc=map(float,(h['hzdept_r'],h['hzdepb_r'],h['awc_r']))
        lo,hi=max(0,top),min(depth_cm,bottom)
        if hi>lo:
            if not 0<=awc<=1: raise ValueError('Implausible SSURGO AWC units/value')
            intervals.append((lo,hi,awc))
    intervals.sort(); cursor=0.;total=0.
    for lo,hi,awc in intervals:
        if abs(lo-cursor)>1e-6: return None
        total+=(hi-lo)*awc*10;cursor=hi
    return total if abs(cursor-depth_cm)<1e-6 else None

class Capture:
    def __init__(self, out:Path, offline:bool, refresh:bool):
        self.out=out;self.raw=out/'evidence-raw';self.raw.mkdir(parents=True,exist_ok=True)
        self.offline=offline;self.refresh=refresh
        import requests
        self.session=requests.Session()
        self.tokens={}
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        self.session.mount("https://", HTTPAdapter(max_retries=Retry(total=3,backoff_factor=2,status_forcelist=[429,500,502,503,504],allowed_methods=["GET","POST"])))
        self.session.headers['User-Agent']='FieldShiftPrototype/1.0 (public scientific data capture)'
    def json(self,name,url,*,params=None,payload=None):
        path=self.raw/name
        if path.exists() and not self.refresh:return json.loads(path.read_text())
        if self.offline:raise RuntimeError(f'Missing archived input {name}')
        response=(self.session.post(url,json=payload,timeout=90) if payload is not None else self.session.get(url,params=params,timeout=90))
        response.raise_for_status(); data=response.json();dump(path,data)
        dump(path.with_suffix('.provenance.json'),{'url':url,'params':params,'query':payload,'retrievedAt':datetime.now(timezone.utc).isoformat(),'sha256':digest(path)})
        return data
    def sign(self,href):
        if self.offline:raise RuntimeError('Cannot fetch raster in offline mode')
        from urllib.parse import urlsplit,parse_qs
        u=urlsplit(href);key=(u.netloc,u.path.split('/')[1])
        if key in self.tokens:return href+'?'+self.tokens[key]
        r=self.session.get('https://planetarycomputer.microsoft.com/api/sas/v1/sign',params={'href':href},timeout=45)
        r.raise_for_status();signed=r.json()['href'];query=urlsplit(signed).query
        if parse_qs(query).get('sr')==['c']:self.tokens[key]=query
        return signed
    def windows(self,item):
        import rasterio
        from rasterio.features import geometry_window
        from rasterio.warp import transform_geom
        scene_dir=self.raw/item['id'];scene_dir.mkdir(exist_ok=True)
        dump(scene_dir/'item.json',item)
        arrays={};reference=None;assets=[]
        for band in BANDS:
            asset=item['assets'][band];path=scene_dir/f'{band}.tif'
            if band in ('blue','red','nir08','swir16'):
                meta=asset['raster:bands'][0]
                if meta.get('scale')!=.0000275 or meta.get('offset')!=-.2 or meta.get('nodata')!=0:
                    raise ValueError('Unexpected Landsat reflectance schema')
            if not path.exists() or self.refresh:
                with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.TIF,.tif',GDAL_HTTP_TIMEOUT='60'):
                    with rasterio.open(self.sign(asset['href'])) as src:
                        geom=transform_geom('EPSG:4326',src.crs,GEOMETRY)
                        win=geometry_window(src,[geom]);data=src.read(1,window=win)
                        profile=src.profile.copy();profile.update(driver='GTiff',height=data.shape[0],width=data.shape[1],transform=src.window_transform(win),compress='deflate',tiled=False)
                        profile.pop('blockxsize',None);profile.pop('blockysize',None)
                        with rasterio.open(path,'w',**profile) as target:target.write(data,1)
                        dump(path.with_suffix('.provenance.json'),{'sourceUrl':asset['href'],'sourceAsset':band,'sourceDtype':src.dtypes[0],'sourceNoData':src.nodata,'nativeCrs':str(src.crs),'nativeResolution':src.res,'sourceWindow':win.todict(),'retrievedAt':datetime.now(timezone.utc).isoformat(),'processing':'Unresampled native-grid window, encoded values retained','sha256':digest(path)})
            with rasterio.open(path) as src:
                grid=(src.crs,src.transform,src.shape)
                if reference is not None and reference!=grid:raise ValueError('Landsat band grids do not match')
                reference=grid;arrays[band]=src.read(1)
                if src.res!=(30.,30.) or str(src.crs)!='EPSG:32615':raise ValueError('Unexpected native grid')
            assets.append({'path':'/atlas/'+str(path.relative_to(self.out)),'sha256':digest(path),'variable':band,'sourceUrl':asset['href']})
        assets.append({'path':'/atlas/'+str((scene_dir/'item.json').relative_to(self.out)),'sha256':digest(scene_dir/'item.json'),'variable':'source-stac-item'})
        return arrays,reference,assets

    def discover_landsat(self, start, end):
        """Record every catalog date. Follow pagination; never select on scene cloud."""
        # Reuse the original complete discovery response without changing raw history.
        prefix='landsat-search' if (start,end)==('2024-03-01','2024-09-30') else f'landsat-search-{start}-{end}'
        page=self.json(prefix+'.json',STAC+'/search',params={'collections':'landsat-c2-l2','bbox':','.join(map(str,BBOX)),'datetime':f'{start}T00:00:00Z/{end}T23:59:59Z','limit':100})
        items={};page_number=1;seen=set()
        while True:
            for item in page['features']:
                if item['properties'].get('platform') in ('landsat-8','landsat-9'):items[item['id']]=item
            following=next((x for x in page.get('links',[]) if x['rel']=='next'),None)
            if following is None:break
            href=following['href']
            if urlsplit(href).netloc!='planetarycomputer.microsoft.com' or href in seen:raise ValueError('Invalid catalog pagination')
            seen.add(href);page_number+=1
            page=self.json(f'{prefix}-page-{page_number}.json',href,payload=following.get('body') if following.get('method','GET')=='POST' else None)
        return sorted(items.values(),key=lambda x:(x['properties']['datetime'],x['id']))

    def landsat(self, start='2024-03-01', end='2024-11-30'):
        from shapely.geometry import shape,Polygon,mapping
        from rasterio.warp import transform_geom
        selected=self.discover_landsat(start,end)
        observations=[];map_features=[];all_assets=[]
        for item in selected:
            base={'id':item['id'],'datasetId':'landsat','observedAt':item['properties']['datetime'],'evidenceKind':'derived-from-satellite-retrieval','units':'dimensionless','ndvi':None,'bsi':None,'validFraction':None,'directAerosolRetrievalFieldFraction':None,'interpolatedAerosolFieldFraction':None,'qaPolicy':QA_VERSION,'classification':'withheld: no locally validated bare-soil/residue classifier','assets':[],'nativeSupportM':30,'platform':item['properties']['platform'],'sceneCloudPercent':item['properties'].get('eo:cloud_cover')}
            if item['properties'].get('landsat:collection_category')!='T1':
                observations.append({**base,'status':'excluded-tier','reason':'Tier 2 geometry excluded by field-evidence policy; no field QA or index inferred.'});continue
            print('Processing',item['id'],flush=True)
            failure_path=self.raw/item['id']/'acquisition-failure.json'
            if self.offline and failure_path.exists() and not all((self.raw/item['id']/f'{b}.tif').exists() for b in BANDS):
                failure=json.loads(failure_path.read_text())
                observations.append({**base,**failure});continue
            try:arrays,grid,assets=self.windows(item)
            except Exception as error:
                if self.offline:raise
                # Provider exception strings can contain temporary signed URLs: never persist them.
                print('Capture unavailable:',item['id'],type(error).__name__,flush=True)
                failure={'status':'acquisition-failed','reason':'Native asset acquisition or schema verification failed; retry capture. No QA coverage inferred.','failureType':type(error).__name__}
                dump(failure_path,failure)
                observations.append({**base,**failure});continue
            crs,affine,size=grid
            polygon=shape(transform_geom('EPSG:4326',crs,GEOMETRY));valid_area=0.;sums={'ndvi':0.,'bsi':0.};features=[];valid_pixels=0;direct_aerosol_area=0.;interpolated_aerosol_area=0.
            for row in range(size[0]):
                for col in range(size[1]):
                    cell=Polygon([affine*(col,row),affine*(col+1,row),affine*(col+1,row+1),affine*(col,row+1)])
                    intersect=cell.intersection(polygon);area=intersect.area
                    if not area:continue
                    flags=[int(arrays[x][row,col]) for x in ('qa_pixel','qa_radsat','qa_aerosol')]
                    v=indices(*(int(arrays[x][row,col]) for x in ('blue','red','nir08','swir16'))) if landsat_valid(*flags) else None
                    if v:
                        valid_area+=area;valid_pixels+=1
                        if flags[2]&32:interpolated_aerosol_area+=area
                        elif flags[2]&2:direct_aerosol_area+=area
                        for key in sums:sums[key]+=v[key]*area
                    features.append({'type':'Feature','geometry':transform_geom(crs,'EPSG:4326',mapping(intersect),precision=7),'properties':{'layer':'landsat','observedAt':item['properties']['datetime'],'valid':v is not None,'aerosolQuality':('interpolated-low-medium' if flags[2]&32 else 'direct-low-medium') if v else 'rejected','ndvi':round(v['ndvi'],4) if v else None,'bsi':round(v['bsi'],4) if v else None,'nativeCellAreaM2':cell.area,'intersectionAreaM2':round(area,2)}})
            fraction=valid_area/polygon.area
            map_path=self.out/'history-maps'/f"{item['id']}.geojson"
            dump(map_path,{'type':'FeatureCollection','features':features})
            map_asset={'path':'/atlas/'+str(map_path.relative_to(self.out)),'sha256':digest(map_path),'variable':'native-pixel-map'}
            observations.append({**base,'ndvi':round(sums['ndvi']/valid_area,4) if fraction>=.8 else None,'bsi':round(sums['bsi']/valid_area,4) if fraction>=.8 else None,'validFraction':round(fraction,5),'validPixels':valid_pixels,'directAerosolRetrievalFieldFraction':round(direct_aerosol_area/polygon.area,5),'interpolatedAerosolFieldFraction':round(interpolated_aerosol_area/polygon.area,5),'status':'available' if fraction>=.8 else 'insufficient-coverage','partialNdvi':round(sums['ndvi']/valid_area,4) if valid_area else None,'assets':assets,'mapAsset':map_asset})
            map_features=features  # Show the latest acquired date, with invalid pixels explicitly null.
            all_assets.extend([*assets,map_asset])
        prefix='landsat-search' if (start,end)==('2024-03-01','2024-09-30') else f'landsat-search-{start}-{end}'
        catalog_files=[self.raw/(prefix+'.json'),*sorted(self.raw.glob(prefix+'-page-*.json'))]
        all_assets.extend({'path':'/atlas/'+str(p.relative_to(self.out)),'sha256':digest(p),'variable':'source-discovery-catalog'} for p in catalog_files)
        return observations,map_features,all_assets

    def soils(self):
        from shapely import wkt
        from shapely.geometry import shape,mapping
        from shapely import transform
        from pyproj import Transformer
        query=f"SELECT p.mupolygonkey,p.mukey,m.musym,m.muname,p.mupolygongeo.STAsText() AS wkt FROM mupolygon p INNER JOIN mapunit m ON p.mukey=m.mukey WHERE p.mupolygonkey IN (SELECT mupolygonkey FROM SDA_Get_Mupolygonkey_from_intersection_with_WktWgs84('{WKT}'))"
        query2=f"SELECT l.areasymbol,s.saverest,m.mukey,c.cokey,c.compname,c.comppct_r,c.drainagecl,c.hydgrp,h.chkey,h.hzdept_r,h.hzdepb_r,h.awc_r,h.om_r,h.ksat_r FROM mapunit m INNER JOIN legend l ON m.lkey=l.lkey INNER JOIN sacatalog s ON l.areasymbol=s.areasymbol INNER JOIN component c ON m.mukey=c.mukey LEFT JOIN chorizon h ON c.cokey=h.cokey WHERE m.mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('{WKT}')) ORDER BY m.mukey,c.cokey,h.hzdept_r"
        polygons=table_rows(self.json('soil-polygons.json',SDA,payload={'query':query,'format':'JSON+COLUMNNAME'}))
        horizons=table_rows(self.json('soil-horizons.json',SDA,payload={'query':query2,'format':'JSON+COLUMNNAME'}))
        project=Transformer.from_crs('EPSG:4326','EPSG:32615',always_xy=True).transform
        field=shape(GEOMETRY);area=transform(field,project,interleaved=False).area
        components={}
        for row in horizons:components.setdefault(row['cokey'],[]).append(row)
        component_rows=[]
        for key,rows in components.items():
            row=rows[0];component_rows.append({'cokey':key,'mukey':row['mukey'],'name':row['compname'],'componentPercent':float(row['comppct_r']) if row['comppct_r'] is not None else None,'drainage':row['drainagecl'],'hydrologicGroup':row['hydgrp'],'awc0To100cmMm':rootzone_awc(rows),'surveyArea':row['areasymbol'],'surveyVersionDate':row['saverest']})
        features=[];mapunits={}
        for p in polygons:
            geom=wkt.loads(p['wkt']).intersection(field)
            if geom.is_empty:continue
            covered=transform(geom,project,interleaved=False).area
            props={'layer':'soils','mukey':p['mukey'],'name':p['muname'],'symbol':p['musym'],'areaHa':round(covered/10000,5),'fieldFraction':round(covered/area,6)}
            features.append({'type':'Feature','geometry':mapping(geom),'properties':props})
            rec=mapunits.setdefault(p['mukey'],{'mukey':p['mukey'],'name':p['muname'],'areaHa':0.,'fieldFraction':0.,'components':[c for c in component_rows if c['mukey']==p['mukey']]})
            rec['areaHa']+=covered/10000;rec['fieldFraction']+=covered/area
        for unit in mapunits.values():
            cs=unit['components'];valid=[c for c in cs if c['awc0To100cmMm'] is not None and c['componentPercent'] is not None]
            supported=sum(c['componentPercent'] for c in valid)
            unit['componentCoveragePercent']=supported
            unit['awc0To100cmMm']=round(sum(c['awc0To100cmMm']*c['componentPercent'] for c in valid)/supported,2) if supported>=80 else None
            unit['areaHa']=round(unit['areaHa'],5);unit['fieldFraction']=round(unit['fieldFraction'],6)
        units=list(mapunits.values());valid_units=[u for u in units if u['awc0To100cmMm'] is not None]
        support=sum(u['fieldFraction']*u['componentCoveragePercent']/100 for u in valid_units)
        summary={'mapUnits':units,'mappedFraction':round(sum(u['fieldFraction'] for u in units),6),'awcSupportedFieldFraction':round(support,6),'awc0To100cmMm':round(sum(u['awc0To100cmMm']*u['fieldFraction']*u['componentCoveragePercent']/100 for u in valid_units)/support,2) if support>=.8 else None,'waterMapUnitFraction':round(sum(u['fieldFraction'] for u in units if u['name'].lower()=='water'),6),'depthCm':[0,100]}
        return summary,features,area/10000


    def elevation(self):
        import rasterio
        import numpy as np
        from rasterio.features import geometry_window
        from shapely.geometry import shape,Polygon
        from shapely import transform
        from pyproj import Transformer
        search=self.json('nasadem-search.json',STAC+'/search',params={'collections':'nasadem','bbox':','.join(map(str,BBOX)),'limit':2})
        if len(search.get('features',[]))!=1:raise ValueError('Expected one NASADEM tile; multi-tile stitching not implemented')
        item=search['features'][0];href=item['assets']['elevation']['href'];path=self.raw/'nasadem-elevation.tif'
        if not path.exists() or self.refresh:
            with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.TIF,.tif',GDAL_HTTP_TIMEOUT='60'):
                with rasterio.open(self.sign(href)) as src:
                    if str(src.crs)!='EPSG:4326' or any(abs(r-1/3600)>1e-10 for r in src.res):raise ValueError('Unexpected NASADEM native grid')
                    if src.scales!=(1.,) or src.offsets!=(0.,):raise ValueError('Unexpected NASADEM packing')
                    win=geometry_window(src,[GEOMETRY]);data=src.read(1,window=win)
                    profile=src.profile.copy();profile.update(driver='GTiff',height=data.shape[0],width=data.shape[1],transform=src.window_transform(win),compress='deflate',tiled=False)
                    profile.pop('blockxsize',None);profile.pop('blockysize',None)
                    with rasterio.open(path,'w',**profile) as target:target.write(data,1)
                    dump(path.with_suffix('.provenance.json'),{'sourceUrl':href,'granuleId':item['id'],'sourceDtype':src.dtypes[0],'sourceNoData':src.nodata,'nativeCrs':str(src.crs),'nativeResolution':src.res,'sourceWindow':win.todict(),'retrievedAt':datetime.now(timezone.utc).isoformat(),'processing':'Unresampled native-grid window; integer metre heights retained','sha256':digest(path)})
        project=Transformer.from_crs('EPSG:4326','EPSG:32615',always_xy=True).transform
        field=shape(GEOMETRY);area=transform(field,project,interleaved=False).area;valid_area=weighted=0.;values=[]
        with rasterio.open(path) as src:
            data=src.read(1,masked=True);mask=np.ma.getmaskarray(data);a=src.transform
            for row in range(data.shape[0]):
                for col in range(data.shape[1]):
                    cell=Polygon([a*(col,row),a*(col+1,row),a*(col+1,row+1),a*(col,row+1)]).intersection(field)
                    if cell.is_empty or bool(mask[row,col]):continue
                    value=float(data[row,col]);part=transform(cell,project,interleaved=False).area
                    if not math.isfinite(value) or not -32767<=value<=32767:continue
                    values.append(value);weighted+=value*part;valid_area+=part
        return {'id':'elevation','status':'available','evidenceKind':'derived-terrain-context','product':'NASADEM_HGT.001','version':'001; Microsoft public COG mirror','sourceUrl':'https://lpdaac.usgs.gov/documents/592/NASADEM_User_Guide_V1.pdf','spatialSupport':'1 arc-second native postings (~31 m north–south, ~23 m east–west here), not validated field microtopography','dates':[item['properties']['datetime']],'units':'m relative to EGM96 geoid','qa':{'validFraction':round(valid_area/area,6),'method':'Actual native file CRS, spacing, packing and nodata checked; area intersections in EPSG:32615','sourceClassMask':'NUM and SWB layers not provided by this mirror; source composition uncertainty unresolved'},'summary':{'meanElevationM':round(weighted/valid_area,2) if valid_area else None,'minElevationM':min(values) if values else None,'maxElevationM':max(values) if values else None},'limitations':['Primarily February 2000 SRTM with ancillary void filling; surface heights can include vegetation/buildings.','No calibrated slope erosion, drainage routing, or frost-pocket inference.','Native source-class and water masks unavailable in this public mirror.'],'assets':[{'path':'/atlas/evidence-raw/nasadem-elevation.tif','sha256':digest(path),'sourceUrl':href}]}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=Path('frontend/public/atlas'));p.add_argument('--offline',action='store_true');p.add_argument('--refresh',action='store_true');p.add_argument('--include-elevation',action='store_true');p.add_argument('--start',default='2024-03-01');p.add_argument('--end',default='2024-11-30');a=p.parse_args()
    if a.offline and a.refresh:p.error('--offline and --refresh are mutually exclusive')
    try:
        start=datetime.strptime(a.start,'%Y-%m-%d');end=datetime.strptime(a.end,'%Y-%m-%d')
        if not 0<=(end-start).days<=366:raise ValueError('Choose an ordered season of at most 367 days')
    except ValueError as error:p.error(str(error))
    c=Capture(a.out,a.offline,a.refresh)
    observations,ls_features,ls_assets=c.landsat(a.start,a.end);soil,soil_features,area=c.soils()
    verified='2026-11-09'
    datasets=[
      {'id':'landsat','status':'available','evidenceKind':'satellite-retrieval','product':'USGS Landsat 8/9 Collection 2 Level-2 surface reflectance','version':'Collection 2 Tier 1; scene processing revisions in asset names','sourceUrl':SOURCES[1],'spatialSupport':'30 m native pixels; field-edge mixing and geolocation uncertainty remain','dates':[o['observedAt'] for o in observations],'units':'dimensionless reflectance and indices','qa':{'policy':QA_VERSION,'minimumValidFieldFraction':.8,'method':'Native pixel/field intersection areas; reject fill/cloud/shadow/snow/water/saturation/high or climatology aerosol; allow low/medium interpolated aerosol with its fraction exposed','validFractions':[o['validFraction'] for o in observations]},'summary':{'scenesDiscovered':len(observations),'scenesAcquired':sum(o['validFraction'] is not None for o in observations),'usableFieldSummaries':sum(o['status']=='available' for o in observations)},'limitations':['Most accepted pixels use spatially interpolated low/medium aerosol estimates; observation records expose that fraction.','Seasonal observations have QA gaps; neither isolated low indices nor repeated low indices establish bare soil, residue protection or continuous exposure.','NDVI/BSI cannot reliably distinguish residue from bare soil without local labels.','Scene cloud percentage is discovery metadata; field QA is applied independently.'],'assets':ls_assets},
      {'id':'ssurgo','status':'available','evidenceKind':'soil-survey-estimate','product':'USDA NRCS SSURGO via Soil Data Access','version':'Live SDA snapshot; component surveyVersionDate retained','sourceUrl':SOURCES[3],'spatialSupport':'Mapped soil units containing component mixtures, not measured subfield soil','dates':sorted({c['surveyVersionDate'] for u in soil['mapUnits'] for c in u['components']}),'units':'awc_r: cm/cm; integrated AWC: mm per 0–100 cm','qa':{'method':'Clip actual survey polygons; depth-integrate complete nonoverlapping horizons; component and area weighting; missing values not imputed','minimumComponentCoveragePercent':80,'minimumFieldCoverageFraction':.8},'summary':soil,'limitations':['Soil map components are not spatially located within a map unit.','AWC is survey-estimated potential storage, not current soil moisture or a field-calibrated rooting depth.','Demo rectangle includes mapped water and heterogeneous terrain; farmer must confirm a real field boundary.'],'assets':[{'path':'/atlas/evidence-raw/'+n,'sha256':digest(c.raw/n)} for n in ['soil-polygons.json','soil-horizons.json']]},
    ]
    pending=[
      ('smap','SPL3SMP_E.006 / SPL4SMGP.008','9 km postings with much coarser radiometer support; L4 is assimilation at 0–5 and 0–100 cm depths','Earthdata credentials unavailable; no representative granule QA performed.','https://nsidc.org/data/spl4smgp/versions/8'),
      ('imerg','GPM_3IMERGHH.07','0.1° / half hourly regional precipitation estimates','Direct Earthdata route lacks credentials. Public Microsoft catalog inspected 2026-11-07 exposes Version 06 ending 2021-05-31; it is not substituted for the proposed V07 product.','https://gpm.nasa.gov/data/imerg'),
      ('ecostress','ECO_L2T_LSTE.003 / ECO_L3T_JET.003 / ECO_L4T_ESI.003','70 m tiled thermal/ET outputs; irregular local acquisition times','Earthdata credentials unavailable; C3 representative file schema not checked.','https://www.earthdata.nasa.gov/data/instruments/ecostress'),
      ('grace','TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4','Regional monthly terrestrial water storage; 0.5° grid does not resolve fields','CMR version RL06.3Mv04 (not RL06.3_V4) verified 2026-11-08. Earthdata credentials absent; representative NetCDF and monthly uncertainty QA pending. Use only basin context, never direct groundwater or field moisture.','https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4'),
      ('modis','MOD09A1.061 / MOD13Q1.061','500 m / 8-day reflectance; 250 m / 16-day VI composites','Public Microsoft catalog confirms MOD09A1.061 and MOD13Q1.061 access; acquisition deferred because pixels mix land covers across this small rectangle. Use only regional phenology. No representative files captured.','https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061'),
      ('elevation','NASADEM_HGT.001','1 arc-second postings, surface elevation from 2000-era and ancillary sources','Public NASADEM catalog confirms Iowa coverage; representative file pending. Useful terrain context, but does not establish field frost pockets.','https://lpdaac.usgs.gov/products/nasadem_hgtv001/'),
      ('gedi','GEDI02_A.003 / GEDI04_A V3','Sparse approximately 25 m footprints','Excluded from annual crop scoring: woody biomass models are not validated for crop biomass; optional shelterbelt research.','https://daac.ornl.gov/GEDI/'),
    ]
    if a.include_elevation or (c.raw/'nasadem-elevation.tif').exists():
        datasets.append(c.elevation());pending=[p for p in pending if p[0]!='elevation']
    modis_path=a.out/'modis-context.json'
    if modis_path.exists():
        modis=json.loads(modis_path.read_text())
        if modis.get('product')=='MOD13Q1.061 Terra MODIS Vegetation Indices':
            datasets.append(modis);pending=[row for row in pending if row[0]!='modis']
    access_path=a.out/'access-status.json'
    access=json.loads(access_path.read_text()) if access_path.exists() else None
    for key,product,support,reason,url in pending:
        datasets.append({'id':key,'status':'excluded' if key=='gedi' else 'pending','evidenceKind':'regional-context' if key in ('smap','imerg','grace','modis') else 'optional-enrichment','product':product,'version':'Proposed identifier; not enabled until representative-file verification','sourceUrl':url,'spatialSupport':support,'dates':[],'units':None,'qa':{'status':'representative-file-not-checked','catalogPreflight':[r for r in access['products'] if r['id'].split('-')[0]==key] if access else None},'summary':None,'limitations':[reason],'assets':[]})
    package={'schemaVersion':'field-evidence-v1','verifiedAt':verified,'field':{'id':'iowa-demo','bbox':BBOX,'geometry':GEOMETRY,'areaHa':round(area,4),'boundaryStatus':'illustrative-needs-farmer-confirmation'},'datasets':datasets,'observations':observations,'map':{'type':'FeatureCollection','features':soil_features+ls_features},'season':{'start':a.start,'end':a.end,'discovery':'All catalog Landsat 8/9 acquisitions intersecting the boundary; paginated, no scene-cloud selection','minimumValidFraction':.8,'interpolation':'none','catalogComplete':True},'provenance':{'pipeline':'backend/atlas/field_evidence_capture.py','pipelineSha256':digest(Path(__file__)),'primaryReferences':SOURCES,'verificationDate':verified,'processing':'Unresampled native Landsat windows plus area intersections; actual SSURGO polygons/horizons. No field calibration or simulated outcomes.','credentialPolicy':'No tokens, signed URLs or farmer secrets retained.'}}
    dump(a.out/'field-evidence.json',package)
    dump(a.out/'field-evidence.geojson',package['map'])
    print(json.dumps({'fieldAreaHa':area,'landsat':[(o['observedAt'],o['validFraction'],o['ndvi']) for o in observations],'soilMapUnits':len(soil['mapUnits']),'soilAwcMm':soil['awc0To100cmMm'],'soilSupport':soil['awcSupportedFieldFraction']},indent=2))

if __name__=='__main__':main()
