"""Scientific QA and actual JSON/CSV collection identity tests; no credentials."""
import json,unittest
from datetime import datetime,timedelta
from pathlib import Path
from modis_capture import modis_valid,parse_subset
ROOT=Path(__file__).resolve().parents[2]/'frontend/public/atlas'
class ModisRules(unittest.TestCase):
    def test_cloud_water_snow_fill_and_timing_are_rejected(self):
        q=(1<<11)|(1<<6)
        self.assertTrue(modis_valid(2000,1000,q,0,66,65,80))
        for flag in (1,1<<8,1<<10,1<<14,1<<15):self.assertFalse(modis_valid(2000,1000,q|flag,0,66,65,80))
        self.assertFalse(modis_valid(2000,1000,1<<6,0,66,65,80))
        self.assertFalse(modis_valid(2000,1000,q,1,66,65,80))
        self.assertFalse(modis_valid(-3000,1000,q,0,66,65,80))
        self.assertFalse(modis_valid(2000,1000,q,0,64,65,80))
    def test_actual_capture_reproduces_and_withholds_low_coverage(self):
        path=ROOT/'modis-context.json'
        if not path.exists():self.skipTest('Run optional MODIS capture')
        record=json.loads(path.read_text());meta={m['band']:m for m in record['qa']['bandMetadata']};actual=[]
        for a in record['assets']:
            local=ROOT/a['path'].removeprefix('/atlas/')
            if local.suffix=='.csv':
                data=json.loads(local.with_suffix('.json').read_text());actual.extend(parse_subset(data,local.read_text(),meta))
        self.assertEqual(actual,record['summary']['series'])
        dates=json.loads((ROOT/'evidence-raw/modis/dates.json').read_text())['dates']
        expected=[d['calendar_date'] for d in dates if record['summary']['requestedStart']<=d['calendar_date'] and (datetime.strptime(d['calendar_date'],'%Y-%m-%d')+timedelta(days=15)).strftime('%Y-%m-%d')<=record['summary']['requestedEnd']]
        self.assertEqual([r['periodStart'] for r in actual],expected)
        self.assertTrue(any(r['ndvi'] is None for r in actual))
        for row in actual:
            if row['validFraction']<.8:self.assertIsNone(row['ndvi']);self.assertIsNone(row['evi'])
            self.assertTrue(all('.061.' in g for g in row['sourceGranules']))
            if row['validPixels']:
                self.assertLessEqual(row['periodStart'],row['selectedPixelDateMin'])
                self.assertLessEqual(row['selectedPixelDateMax'],row['periodEnd'])
            else:
                self.assertIsNone(row['selectedPixelDateMin']);self.assertIsNone(row['selectedPixelDateMax'])
    def test_wrong_collection_and_mismatched_arrays_never_activate(self):
        csvs=sorted((ROOT/'evidence-raw/modis').glob('*.csv'))
        if not csvs:self.skipTest('Run MODIS capture')
        p=csvs[0];data=json.loads(p.with_suffix('.json').read_text());meta={m['band']:m for m in json.loads((ROOT/'evidence-raw/modis/bands.json').read_text())['bands']};text=p.read_text()
        with self.assertRaisesRegex(ValueError,'collection'):parse_subset(data,text.replace('.061.','.006.'),meta)
        data['subset'][0]['data'][0]+=1
        with self.assertRaisesRegex(ValueError,'mismatch'):parse_subset(data,text,meta)
if __name__=='__main__':unittest.main()
