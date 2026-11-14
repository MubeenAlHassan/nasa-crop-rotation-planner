"""Capture pinned Earthdata granules; credentials are handled only by earthaccess.

Optional environment: pip install earthaccess rasterio shapely pyarrow h5py
Example:
 python backend/atlas/earthdata_capture.py --product hls --start 2024-06-01 --end 2024-06-15 --out /tmp/hls
Uses existing Earthdata netrc/environment authentication; never stores tokens here.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
PRODUCTS={'smap':('SPL3SMP_E','006'),'smap-rootzone':('SPL4SMGP','008'),'hls':('HLSL30','2.0'),'ecostress':('ECO_L2T_LSTE','003'),'ecostress-et':('ECO_L3T_JET','003'),'ecostress-esi':('ECO_L4T_ESI','003'),'grace':('TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4','RL06.3Mv04'),'imerg':('GPM_3IMERGHH','07')}
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--product',choices=PRODUCTS,required=True)
    parser.add_argument('--start',required=True);parser.add_argument('--end',required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--bbox',type=float,nargs=4,default=[-93.66,42.015,-93.64,42.035])
    parser.add_argument('--limit',type=int,default=8)
    args=parser.parse_args()
    if not 1<=args.limit<=100: parser.error('Use a limit between 1 and 100.')
    import earthaccess
    auth=earthaccess.login(strategy='environment')
    if not auth.authenticated: auth=earthaccess.login(strategy='netrc')
    if not auth.authenticated: raise SystemExit('Authenticate with NASA Earthdata outside the application; credentials were not captured.')
    name,version=PRODUCTS[args.product]
    found=earthaccess.search_data(short_name=name,version=version,bounding_box=tuple(args.bbox),temporal=(args.start,args.end),count=args.limit)
    if not found: raise SystemExit('No matching granules. Coverage stays unavailable.')
    args.out.mkdir(parents=True,exist_ok=True)
    paths=earthaccess.download(found,local_path=args.out)
    manifest={'product':name,'version':version,'retrieved_at':datetime.now(timezone.utc).isoformat(),'bbox':args.bbox,'start':args.start,'end':args.end,'granules':[dict(g) for g in found],'files':[{'path':Path(p).name,'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()} for p in paths], 'processing':'Raw capture only. Apply product-specific QA before adding observations to evidence.'}
    (args.out/'manifest.json').write_text(json.dumps(manifest,indent=2,default=str))
    print(f'Captured {len(paths)} assets. Not yet quality-screened; see manifest.json.')
if __name__=='__main__':main()
