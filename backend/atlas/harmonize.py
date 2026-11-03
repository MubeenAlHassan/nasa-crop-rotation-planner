"""Product-specific QA and native-support field aggregation.

Pure QA helpers run without optional geospatial dependencies. Raster aggregation
requires rasterio and shapely. Raster files are never upsampled to fabricate detail.
"""
from __future__ import annotations
import json
import math
from pathlib import Path


def hls_valid(fmask:int)->bool:
    # HLS v2 Fmask: cirrus, cloud, adjacent cloud, shadow, snow, water;
    # reject high aerosol level (bits 6–7 == 3) as a conservative policy.
    return isinstance(fmask,int) and 0<=fmask<255 and fmask&63==0 and (fmask>>6)&3!=3


def ecostress_valid(qc:int,cloud:int,water:int)->bool:
    # ECO_L2T_LSTE best-quality LST and uncertainty; clear land only.
    return isinstance(qc,int) and qc>=0 and qc&3==0 and cloud==0 and water==0


def smap_valid(retrieval_flag:int,soil_moisture:float)->bool:
    # Recommended retrieval: retrieval quality bits 0 and 1 are both zero.
    return isinstance(retrieval_flag,int) and retrieval_flag>=0 and retrieval_flag&3==0 and math.isfinite(soil_moisture) and 0<=soil_moisture<=1


def ndvi(red,nir,fmask):
    if not hls_valid(fmask) or red is None or nir is None: return None
    if not all(math.isfinite(x) for x in (red,nir)) or red<0 or nir<0 or red+nir<=0: return None
    return (nir-red)/(nir+red)


def aggregate_raster(value_path:Path,qa_path:Path,field_geojson:dict,qa_kind:str,scale:float=1,offset:float=0):
    """Area-weighted field mean using true pixel/field intersections in a projected CRS.

    The caller supplies the documented scale/offset for the pinned product.
    Fine raster aggregation supports HLS Fmask; other product adapters must supply
    an explicit binary valid mask (1 valid, 0 invalid) after their QA helper.
    """
    import rasterio
    from rasterio.features import geometry_window
    from rasterio.warp import transform_geom
    from shapely.geometry import shape, Polygon
    with rasterio.open(value_path) as src, rasterio.open(qa_path) as qa:
        if src.crs!=qa.crs or src.transform!=qa.transform or src.shape!=qa.shape:
            raise ValueError('Value and QA grids differ; align at native support before aggregation.')
        if not src.crs or not src.crs.is_projected: raise ValueError('Area aggregation requires a projected native grid, not degree-area weighting.')
        if qa_kind not in ('hls','binary'): raise ValueError('Unknown QA convention.')
        geom=transform_geom('EPSG:4326',src.crs,field_geojson)
        polygon=shape(geom)
        if not polygon.is_valid or polygon.area<=0:raise ValueError('Invalid field geometry')
        window=geometry_window(src,[geom])
        values=src.read(1,window=window,masked=True); flags=qa.read(1,window=window,masked=True)
        transform=src.window_transform(window)
        weighted=valid_area=covered_area=0
        for row in range(values.shape[0]):
            for col in range(values.shape[1]):
                corners=[transform*(col,row),transform*(col+1,row),transform*(col+1,row+1),transform*(col,row+1)]
                area=polygon.intersection(Polygon(corners)).area
                if not area:continue
                covered_area+=area
                if values.mask is not False and getattr(values.mask,'ndim',0)>0 and values.mask[row,col]:continue
                if flags.mask is not False and getattr(flags.mask,'ndim',0)>0 and flags.mask[row,col]:continue
                flag=int(flags[row,col]);good=hls_valid(flag) if qa_kind=='hls' else flag==1
                value=float(values[row,col])*scale+offset
                if not good or not math.isfinite(value):continue
                weighted+=value*area;valid_area+=area
        return {'value':weighted/valid_area if valid_area else None,'valid_fraction':valid_area/polygon.area,'covered_fraction':covered_area/polygon.area,'native_crs':str(src.crs),'native_pixel_size':list(src.res),'method':'native pixel/field area intersections','status':'observed' if valid_area else 'unavailable'}


def export_summaries(records:list[dict],output:Path,parquet:bool=False):
    for row in records:
        required={'product','version','granule_id','observed_at','variable','units','spatial_support','value','qa','sha256'}
        if not required.issubset(row):raise ValueError('Every observation requires full provenance and QA')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(records,indent=2,allow_nan=False))
    if parquet:
        import pyarrow as pa
        import pyarrow.parquet as pq
        pq.write_table(pa.Table.from_pylist(records),output.with_suffix('.parquet'))


def export_cog(source:Path,target:Path):
    from rasterio.shutil import copy
    copy(source,target,driver='COG',compress='DEFLATE',overview_resampling='average')
