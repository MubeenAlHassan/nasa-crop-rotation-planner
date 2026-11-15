import hashlib,json,unittest
from pathlib import Path
from pipeline import normalize_power
ROOT=Path(__file__).resolve().parents[2]/'frontend/public/atlas'
class HistoryExtensions(unittest.TestCase):
 def test_real_power_metadata_and_all_twenty_years_reproduce(self):
  d=json.loads((ROOT/'power-history.json').read_text());rows=[]
  for source in d['sources']:
   p=ROOT/source['raw_file'];self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),source['sha256'])
   raw=json.loads(p.read_text());self.assertEqual(raw['geometry']['coordinates'][:2],[-93.65,42.025]);self.assertEqual(raw['header']['time_standard'],'UTC')
   rows.extend(normalize_power(raw,int(source['id'][-4:])))
  self.assertEqual(rows,d['weather']);self.assertEqual(len(rows),7305)
  self.assertEqual([r for r in rows if r['date']>='2013-01-01'],json.loads((ROOT/'iowa.json').read_text())['weather'])
 def test_power_fill_and_units_are_not_silently_coerced(self):
  d=json.loads((ROOT/'raw/power-2005.json').read_text());d['properties']['parameter']['PRECTOTCORR']['20050101']=d['header']['fill_value']
  self.assertIsNone(normalize_power(d,2005)[0]['rain']);d['parameters']['PRECTOTCORR']['units']='mm/hour'
  with self.assertRaisesRegex(ValueError,'unit'):normalize_power(d,2005)
 def test_registered_season_native_assets_and_missingness(self):
  from field_evidence_capture import Capture
  d=json.loads((ROOT/'landsat-seasons.json').read_text());base=json.loads((ROOT/'field-evidence.json').read_text());self.assertEqual(d['field'],base['field'])
  for s in d['seasons']:
   actual=Capture(ROOT,True,False).discover_landsat(s['start'],s['end']);self.assertEqual([i['id'] for i in actual],[o['id'] for o in s['observations']])
   for a in s['assets']:self.assertEqual(hashlib.sha256((ROOT/a['path'].removeprefix('/atlas/')).read_bytes()).hexdigest(),a['sha256'])
   for o in s['observations']:
    if o['status']!='available':self.assertIsNone(o['ndvi']);self.assertIsNone(o['bsi'])
    if o['status']=='excluded-tier':self.assertIsNone(o['validFraction'])
    if o.get('mapAsset'):
     m=json.loads((ROOT/o['mapAsset']['path'].removeprefix('/atlas/')).read_text());self.assertTrue(all(f['properties']['observedAt']==o['observedAt'] and f['properties']['nativeCellAreaM2']==900 for f in m['features']))
if __name__=='__main__':unittest.main()
