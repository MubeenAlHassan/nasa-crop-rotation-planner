import importlib.util
from pathlib import Path
import unittest
from atlas import pipeline
class PipelineTests(unittest.TestCase):
    def test_rate_to_accumulation(self):
        self.assertEqual(pipeline.precipitation_mm(6,30),3)
        self.assertIsNone(pipeline.precipitation_mm(-999,30))
        self.assertRaises(ValueError,pipeline.precipitation_mm,2,0)
    def test_qa_weighted_mean(self):
        self.assertEqual(pipeline.weighted_summary([10,100,20],[1,2,3],[True,False,True]),17.5)
        self.assertIsNone(pipeline.weighted_summary([10],[1],[False]))
    def test_null_nan_fill_not_zero(self):
        for value in [None,float('nan'),-999,True]: self.assertIsNone(pipeline.clean(value))
        self.assertEqual(pipeline.clean(0),0)
    def test_capture_hashes(self):
        import json,hashlib
        root=Path(__file__).resolve().parents[2]/'frontend/public/atlas'
        package=json.loads((root/'iowa.json').read_text())
        self.assertEqual(len(package['weather']),4383)
        for source in package['sources']:
            self.assertEqual(hashlib.sha256((root/source['raw_file']).read_bytes()).hexdigest(),source['sha256'])
        self.assertEqual(hashlib.sha256((root/'iowa.json').read_bytes()).hexdigest(),(root/'iowa.sha256').read_text().strip())
if __name__=='__main__': unittest.main()
