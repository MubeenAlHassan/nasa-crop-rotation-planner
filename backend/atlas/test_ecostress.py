import json,unittest,tempfile
from pathlib import Path
import numpy as np,rasterio
from ecostress_process import build,sha,rejection,CACHE
ROOT=Path(__file__).resolve().parents[2];PACK=ROOT/'frontend/public/atlas/ecostress/pilot.json'
class EcoContracts(unittest.TestCase):
 def test_replay_actual_files_and_qa(self):
  with tempfile.TemporaryDirectory() as td:
   data=build(CACHE,Path(td)/'ecostress');self.assertEqual((Path(td)/'ecostress/pilot.json').read_bytes(),PACK.read_bytes())
   self.assertEqual(len(data['records']),24);self.assertEqual(len(data['cells']),121)
   june=[r for r in data['records'] if r['start'].startswith('2024-06') and r['product']=='ECO_L2T_LSTE'];self.assertEqual(len(june),17);self.assertEqual(sum(r['bands']['LST']['fieldMean'] is not None for r in june),2)
   for r in data['records']:
    for asset in r['sources']:self.assertEqual(sha(CACHE/asset['file']),asset['sha256'])
    for name,b in r['bands'].items():
     asset=next(a for a in r['sources'] if a['file'].endswith('_'+name+'.tif'))
     with rasterio.open(CACHE/asset['file']) as ds:
      expected=[float(ds.read(1,window=rasterio.windows.Window(c['column'],c['row'],1,1))[0,0]) for c in data['cells']]
     np.testing.assert_allclose([np.nan if v is None else v for v in b['rawValues']],expected,equal_nan=True)
     if r['start'].startswith(('2024-06-27','2024-06-28')):self.assertEqual(b['validAreaFraction'],0);self.assertIsNone(b['fieldMean'])
 def test_cloud_not_encoded_in_qc_is_still_rejected(self):
  self.assertIn('cloud-or-missing-cloud-mask',rejection(1,0,0,1));self.assertEqual(rejection(0,0,0,1),[])
  for args in [(0,1,0,1),(0,0,1,1),(0,0,4,1),(0,0,0,None),(0,0,0,2.1),(None,0,0,1)]:self.assertTrue(rejection(*args))
 def test_units_and_esi_ratio_from_real_pixels(self):
  d=json.loads(PACK.read_text());rows=[r for r in d['records'] if r['start'].startswith('2024-05-23')];l2,jet,esi=rows
  self.assertEqual(jet['bands']['ETdaily']['units'],'mm/day');self.assertEqual(jet['bands']['ETinstUncertainty']['units'],'W/m²');self.assertIsNone(jet['bands']['ETinstUncertainty']['fieldMean'])
  np.testing.assert_allclose(l2['bands']['LST']['values'],np.array(l2['bands']['LST']['rawValues'])-273.15)
  np.testing.assert_allclose(esi['bands']['ESI']['values'],np.clip(np.array(jet['bands']['PTJPLSMinst']['values'])/np.array(esi['bands']['PET']['values']),0,1),rtol=1e-5)
if __name__=='__main__':unittest.main()
