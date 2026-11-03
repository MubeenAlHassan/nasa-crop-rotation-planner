import unittest
from atlas.harmonize import hls_valid,ecostress_valid,smap_valid,ndvi
class QATests(unittest.TestCase):
    def test_hls_cloud_snow_shadow_and_fill(self):
        self.assertTrue(hls_valid(0))
        for bad in [1,2,4,8,16,32,192,255]:self.assertFalse(hls_valid(bad))
        self.assertAlmostEqual(ndvi(.2,.6,0),.5)
        self.assertIsNone(ndvi(.2,.6,2))
        self.assertIsNone(ndvi(0,0,0))
    def test_ecostress_requires_best_clear_land(self):
        self.assertTrue(ecostress_valid(0,0,0))
        self.assertFalse(ecostress_valid(1,0,0))
        self.assertFalse(ecostress_valid(0,1,0))
        self.assertFalse(ecostress_valid(0,0,1))
    def test_smap_quality_and_fill(self):
        self.assertTrue(smap_valid(0,.2))
        self.assertFalse(smap_valid(1,.2))
        self.assertFalse(smap_valid(0,-9999))
        self.assertFalse(smap_valid(0,float('nan')))
if __name__=='__main__':unittest.main()
