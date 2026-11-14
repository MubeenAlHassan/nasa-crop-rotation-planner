import unittest,json,tempfile,hashlib
from pathlib import Path
import h5py,numpy as np
from grace_process import process,nominal_months,aggregate,CACHE
class GraceContracts(unittest.TestCase):
 def test_real_file_and_replay(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=process(Path(tmp)/'grace');p=Path('frontend/public/atlas/grace/iowa-region.json');self.assertEqual((Path(tmp)/'grace/iowa-region.json').read_bytes(),p.read_bytes());self.assertEqual((Path(tmp)/'grace-index.json').read_bytes(),Path('frontend/public/atlas/grace-index.json').read_bytes())
  self.assertEqual(len(d['records']),240);self.assertEqual(sum(r['status']=='accepted' for r in d['records']),210)
  with h5py.File(CACHE/d['source']['file']) as f:
   self.assertEqual(hashlib.sha256((CACHE/d['source']['file']).read_bytes()).hexdigest(),d['source']['sha256']);self.assertEqual(f['lwe_thickness'].attrs['units'],b'cm');self.assertEqual(f['uncertainty'].attrs['units'],b'cm')
   for r in [v for v in d['records'] if v['status']=='accepted'][::17]:
    for j,m in enumerate(d['mascons']):
     c=next(c for c in d['cells'] if c['masconId']==m['id']);self.assertEqual(r['valuesMm'][j],float(f['lwe_thickness'][r['sourceIndex'],c['row'],c['column']])*10);self.assertEqual(r['sigmaMm'][j],float(f['uncertainty'][r['sourceIndex'],c['row'],c['column']])*10)
   labels=nominal_months(f);self.assertEqual(labels[labels.index('2011-12')+1],'2012-01')
  for month in ['2017-07','2018-05','2018-08']:
   r=next(r for r in d['records'] if r['month']==month);self.assertIsNone(r['regionalMm']);self.assertIsNone(r['time'])
  self.assertFalse(d['gainApplied']);self.assertTrue(all(c['landMask']==1 for c in d['cells']));self.assertAlmostEqual(sum(m['weight'] for m in d['mascons']),1)
 def test_missing_and_correlated_uncertainty(self):
  self.assertEqual(aggregate([10,20],[2,4],[.25,.75]),(17.5,3.5));self.assertEqual(aggregate([10,None],[2,4],[.25,.75]),(None,None));self.assertEqual(aggregate([10,20],[2,None],[.25,.75]),(17.5,None))
if __name__=='__main__':unittest.main()
