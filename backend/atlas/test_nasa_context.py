import json,unittest
from pathlib import Path
from nasa_context import extract_imerg,extract_smap,extract_l4,imerg_total,smap_value,sha
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'frontend/public/atlas';CACHE=ROOT/'backend/.provider_cache/earthdata'
class NasaContracts(unittest.TestCase):
 def test_actual_files_and_subsets(self):
  pack=json.loads((PUBLIC/'nasa-context.json').read_text())
  for key,decode in [('smap',extract_smap),('imerg',extract_imerg),('rootZone',extract_l4)]:
   for source,asset in zip(pack[key]['sources'],pack[key]['assets'],strict=True):
    self.assertEqual(sha(CACHE/source['file']),source['sha256'])
    p=PUBLIC/asset['path'].removeprefix('/atlas/');self.assertEqual(sha(p),asset['sha256'])
    decoded=decode(CACHE/source['file'],source);saved=json.loads(p.read_text());self.assertEqual(decoded['raw'],saved['values']);self.assertEqual(decoded['schema'],saved['schema'])
  self.assertEqual(len(pack['imerg']['sources']),48)
  self.assertEqual(sum(r['value'] is not None for r in pack['smap']['rows']),6)
 def test_qa_rejects_uncertain_fill_surface_and_out_of_range(self):
  self.assertEqual(smap_value(.2,0,0),.2)
  for value,flag,surface in [(.2,1,0),(.2,2,0),(.2,0,8),(-9999,0,0),(.6,0,0),(.2,65534,0)]:self.assertIsNone(smap_value(value,flag,surface))
 def test_rates_durations_missing_and_overlap(self):
  pack=json.loads((PUBLIC/'nasa-context.json').read_text());cell=next(c['id'] for c in pack['imerg']['cells'] if c['pilot']);rows=[r for r in pack['imerg']['rows'] if r['cell']==cell]
  total=imerg_total(rows,pack['start'],pack['end']);self.assertAlmostEqual(total['totalMm'],1.329999960027635)
  incomplete=imerg_total(rows[1:],pack['start'],pack['end']);self.assertIsNone(incomplete['totalMm']);self.assertEqual(incomplete['validSeconds'],84600)
  filled=[dict(r) for r in rows];filled[0]['value']=None;self.assertEqual(imerg_total(filled,pack['start'],pack['end']),incomplete)
  with self.assertRaises(ValueError):imerg_total(rows+[rows[0]],pack['start'],pack['end'])
  # Nonzero real interval clipped to half its support yields half its accumulation.
  row=next(r for r in rows if r['value']>0);from datetime import datetime,timedelta
  midpoint=(datetime.fromisoformat(row['start'].replace('Z','+00:00'))+timedelta(minutes=15)).isoformat()
  self.assertAlmostEqual(imerg_total([row],row['start'],midpoint)['totalMm'],row['value']*.25)
if __name__=='__main__':unittest.main()
