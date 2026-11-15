"""Focused scientific checks: unit scaling, QA, gaps, and archived evidence integrity."""
import hashlib
import json
import unittest
from pathlib import Path
from field_evidence_capture import indices, landsat_valid, rootzone_awc

ROOT=Path(__file__).resolve().parents[2]

class EvidenceRules(unittest.TestCase):
    def test_fill_is_masked_before_reflectance_scaling(self):
        self.assertIsNone(indices(0,12000,24000,16000))
        self.assertIsNone(indices(100,12000,24000,16000))
    def test_correct_landsat_scaling_includes_offset(self):
        result=indices(12000,14000,24000,16000)
        red=14000*.0000275-.2;nir=24000*.0000275-.2
        self.assertAlmostEqual(result['ndvi'],(nir-red)/(nir+red))
        self.assertNotAlmostEqual(result['ndvi'],(24000-14000)/(24000+14000))
    def test_quality_rules(self):
        self.assertTrue(landsat_valid(64,0,66))
        for bit in (0,1,2,3,4,5,7):self.assertFalse(landsat_valid(64|(1<<bit),0,66))
        self.assertFalse(landsat_valid(64|(2<<8),0,66))
        for value in (1,2,2048):self.assertFalse(landsat_valid(64,value,66))
        self.assertTrue(landsat_valid(64,0,96))  # Documented low aerosol interpolation
        self.assertTrue(landsat_valid(64,0,160))  # Medium aerosol interpolation
        for value in (0,1,4,32,64,194,224):self.assertFalse(landsat_valid(64,0,value))
    def test_awc_depth_weighting_and_units(self):
        h=[{'hzdept_r':0,'hzdepb_r':20,'awc_r':.2},{'hzdept_r':20,'hzdepb_r':150,'awc_r':.15}]
        self.assertAlmostEqual(rootzone_awc(h),160)
    def test_missing_overlapping_or_incomplete_horizons_withheld(self):
        for hs in [[],[{'hzdept_r':0,'hzdepb_r':100,'awc_r':None}],
                   [{'hzdept_r':0,'hzdepb_r':90,'awc_r':.2}],
                   [{'hzdept_r':0,'hzdepb_r':60,'awc_r':.2},{'hzdept_r':50,'hzdepb_r':100,'awc_r':.2}]]:
            self.assertIsNone(rootzone_awc(hs))
    def test_actual_archive_contract(self):
        path=ROOT/'frontend/public/atlas/field-evidence.json'
        if not path.exists():self.skipTest('Run capture first')
        data=json.loads(path.read_text())
        self.assertEqual(data['schemaVersion'],'field-evidence-v1')
        self.assertEqual(data['field']['boundaryStatus'],'illustrative-needs-farmer-confirmation')
        self.assertGreater(len(data['observations']),0)
        soil=next(d for d in data['datasets'] if d['id']=='ssurgo')['summary']
        self.assertAlmostEqual(soil['mappedFraction'],1,places=3)
        for dataset in data['datasets']:
            for asset in dataset['assets']:
                local=ROOT/'frontend/public'/asset['path'].lstrip('/')
                self.assertEqual(hashlib.sha256(local.read_bytes()).hexdigest(),asset['sha256'])
        for obs in data['observations']:
            if obs['validFraction'] is None:
                self.assertIn(obs['status'],['excluded-tier','acquisition-failed']);self.assertIsNone(obs['ndvi'])
            else:
                self.assertGreaterEqual(obs['validFraction'],0)
                self.assertLessEqual(obs['validFraction'],1.00001)
                if obs['validFraction']<.8:self.assertIsNone(obs['ndvi'])
            self.assertIn('withheld',obs['classification'])
        self.assertTrue(all(x['geometry']['type'] in ('Polygon','MultiPolygon') for x in data['map']['features']))
    def test_season_has_every_discovered_date_and_maps_match_native_area(self):
        from field_evidence_capture import Capture
        root=ROOT/'frontend/public/atlas';data=json.loads((root/'field-evidence.json').read_text())
        catalog=Capture(root,True,False).discover_landsat(data['season']['start'],data['season']['end'])
        self.assertEqual([o['id'] for o in data['observations']],[s['id'] for s in catalog])
        for scene,obs in zip(catalog,data['observations']):
            self.assertEqual(scene['properties']['datetime'],obs['observedAt'])
            if scene['properties']['landsat:collection_category']!='T1':
                self.assertEqual(obs['status'],'excluded-tier');self.assertIsNone(obs['validFraction']);continue
            if obs['status']=='acquisition-failed':continue
            features=json.loads((ROOT/'frontend/public'/obs['mapAsset']['path'].lstrip('/')).read_text())['features']
            total=sum(f['properties']['intersectionAreaM2'] for f in features)
            accepted=sum(f['properties']['intersectionAreaM2'] for f in features if f['properties']['valid'])
            self.assertAlmostEqual(accepted/total,obs['validFraction'],places=5)
            self.assertAlmostEqual(total/10000,data['field']['areaHa'],places=3)
            self.assertTrue(all(f['properties']['observedAt']==obs['observedAt'] and f['properties']['nativeCellAreaM2']==900 for f in features))


class SeasonalDiscovery(unittest.TestCase):
    def test_pagination_and_configured_dates_keep_cloudy_and_tier_two(self):
        from field_evidence_capture import Capture
        calls=[]
        def item(key,date,tier='T1'):
            return {'id':key,'properties':{'platform':'landsat-9','datetime':date+'T16:00:00Z','landsat:collection_category':tier,'eo:cloud_cover':100}}
        pages=[{'features':[item('b','2024-04-02','T2')],'links':[{'rel':'next','href':'https://planetarycomputer.microsoft.com/api/stac/v1/search?token=next'}]},
               {'features':[item('a','2024-04-01')],'links':[]}]
        capture=object.__new__(Capture)
        def read(*args,**kwargs):calls.append((args,kwargs));return pages[len(calls)-1]
        capture.json=read
        result=capture.discover_landsat('2024-04-01','2024-04-30')
        self.assertEqual([r['id'] for r in result],['a','b'])
        self.assertEqual(calls[0][1]['params']['datetime'],'2024-04-01T00:00:00Z/2024-04-30T23:59:59Z')
        self.assertEqual(len(calls),2)

if __name__=='__main__':unittest.main()
