"""Real-file checks plus deliberate corruptions; no fabricated observations are published."""
import json,unittest,tempfile,shutil
from pathlib import Path
import h5py,numpy as np
from nasa_season_process import decode,array,build
ROOT=Path(__file__).resolve().parents[2];CACHE=ROOT/'backend/.provider_cache/nasa-season';FULL=ROOT/'backend/.provider_cache/earthdata'
class SeasonalContracts(unittest.TestCase):
 def representative(self,key):
  p=next(p for p in sorted((CACHE/key).glob('*20240601*.nc4')) if (FULL/json.loads(p.with_suffix('.json').read_text())['file']).exists());return p,json.loads(p.with_suffix('.json').read_text())
 def test_representative_subsets_match_original_native_arrays(self):
  for key in ['smap','rootZone','diagnostics','imerg']:
   p,r=self.representative(key)
   with h5py.File(p) as s,h5py.File(FULL/r['file']) as f:
    def compare(name,d):
     if not isinstance(d,h5py.Dataset) or name not in f or name in ['x','y']:return
     original=f[name]
     if key=='imerg':
      if name.split('/')[-1] in ['precipitation','randomError','precipitationQualityIndex']:v=original[0:1,862:865,1319:1322]
      elif name.endswith('lat') or name.endswith('lat_bnds'):v=original[1319:1322]
      elif name.endswith('lon') or name.endswith('lon_bnds'):v=original[862:865]
      else:v=original[:]
     elif original.shape==(1624,3856):v=original[266:269,923:926]
     else:v=original[()]
     actual=d[()]
     if actual.dtype.kind=='S' and actual.ndim==3:actual=np.array([b''.join(c).rstrip(b'\0') for c in actual.reshape(9,-1)]).reshape(3,3)
     np.testing.assert_array_equal(actual,v,err_msg=key+name)
    s.visititems(compare)
 def test_analysis_is_snapshot_spread_not_gph_uncertainty(self):
  p,r=self.representative('diagnostics');a=decode(p,r)[0]
  self.assertEqual(a['snapshot'],'2024-06-01T00:00:00Z');self.assertGreater(a['rootSpread'][4],0)
  p,r=self.representative('rootZone');g=decode(p,r)[0];self.assertNotIn('rootSpread',g);self.assertEqual(g['end'],'2024-06-01T03:00:00Z')
 def test_fill_spread_is_missing_not_zero_and_units_rejected(self):
  p,r=self.representative('diagnostics')
  with tempfile.TemporaryDirectory() as td:
   copy=Path(td)/'x.nc4';shutil.copy(p,copy)
   with h5py.File(copy,'r+') as f:f['Analysis_Data/sm_rootzone_analysis_ensstd'][1,1]=-9999
   self.assertIsNone(decode(copy,r)[0]['rootSpread'][4])
   with h5py.File(copy,'r+') as f:f['Analysis_Data/sm_rootzone_analysis'].attrs['units']='percent'
   with self.assertRaisesRegex(ValueError,'units'):decode(copy,r)
 def test_rejected_retrieval_retains_reason_and_raw_value(self):
  p,r=self.representative('smap');rows=decode(p,r)
  self.assertIsNone(rows[0]['values'][4]);self.assertIn('surface-condition-flags',rows[0]['reasons'][4]);self.assertIsNotNone(rows[0]['rawValues'][4])
 def test_missing_overpass_does_not_fail_entire_month(self):
  p=next((CACHE/'smap').glob('*20240602*.nc4'));r=json.loads(p.with_suffix('.json').read_text());a=decode(p,r)
  self.assertIsNone(a[0]['values'][4]);self.assertIn('missing-observation-coordinates',a[0]['reasons'][4])
 def test_corrupt_interval_or_native_neighbor_is_rejected(self):
  for key,name,index,value in [('imerg','Grid/time_bnds',(0,1),0),('rootZone','cell_lat',(0,0),0)]:
   p,r=self.representative(key)
   with tempfile.TemporaryDirectory() as td:
    target=Path(td)/'bad.nc4';shutil.copy(p,target)
    with h5py.File(target,'r+') as f:f[name][index]=value
    with self.assertRaises(ValueError):decode(target,r)
 def test_duplicate_snapshot_rejected_during_processing(self):
  p,r=self.representative('diagnostics')
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);folder=root/'diagnostics';folder.mkdir()
   for name in ['first','duplicate']:
    shutil.copy(p,folder/(name+'.nc4'));(folder/(name+'.json')).write_text(json.dumps(r))
   with self.assertRaisesRegex(ValueError,'Duplicate diagnostics'):build(root,root/'output','2024-06-01','2024-06-30')
 def test_obsolete_version_is_retained_but_not_substituted(self):
  candidates=list((CACHE/'rootZone').glob('*202404*Vv8010*.json'))
  self.assertTrue(candidates)
  p=candidates[0];r=json.loads(p.read_text())
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);folder=root/'rootZone';folder.mkdir();shutil.copy(p,folder/p.name);shutil.copy(p.with_suffix('.nc4'),folder/p.with_suffix('.nc4').name)
   build(root,root/'output','2024-04-01','2024-04-30');d=json.loads((root/'output/2024-04.json').read_text());self.assertEqual(len(d['excludedSources']),1);self.assertEqual(d['excludedSources'][0]['sha256'],r['sha256']);self.assertEqual(d['rootZone'],[]);self.assertIsNone(d['days'][0]['root'][4]['mean'])
 def test_multi_month_processing_requires_explicit_month_partition(self):
  with tempfile.TemporaryDirectory() as td:
   with self.assertRaisesRegex(ValueError,'one calendar month'):build(CACHE,Path(td),'2024-06-01','2024-07-01')
if __name__=='__main__':unittest.main()
