import copy
from collections import Counter
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import import_tam_the_d02 as source
from audit_tv3 import Audit, audit_d02


class D02Tests(unittest.TestCase):
    def test_wealth_keeps_two_matches_and_missing_months(self):
        entries,_=source.load_records()
        wealth=[e for e in entries if e['rule']=='TT-TAI-LOC']
        self.assertEqual(120,len(wealth))
        self.assertEqual([1,7],[int(e['code'][-2:]) for e in wealth if e['key']=='STEM:GIAP|MONTH:01'])
        self.assertEqual([], [e for e in wealth if e['key']=='STEM:GIAP|MONTH:02'])
        self.assertEqual({2},set(Counter(e['key'] for e in wealth).values()))
        self.assertEqual(60,len({e['key'] for e in wealth}))
        c3=next(e for e in wealth if e['code']=='WEALTH_C03')
        self.assertEqual(('Bất lộc','Bối Lộc'),(c3['table_label'],c3['heading']))
        self.assertTrue(any('[CHU_MO]' in e['content'] for e in wealth))

    def test_love_control_cases_and_full_continuation_pages(self):
        entries,_=source.load_records()
        love={e['key']:e for e in entries if e['rule']=='TT-TINH-DUYEN'}
        for key,code in (('KIM|MONTH:04',1),('KIM|MONTH:01',10),('MOC|MONTH:01',4),('HOA|MONTH:12',12)):
            self.assertEqual(f'LOVE_C{code:02d}',love['ELEMENT:'+key]['code'])
        self.assertEqual(60,len(love))
        self.assertEqual(15,sum(len(e['pages'])==2 for e in love.values()))
        self.assertEqual({(64,65),(65,66),(66,67)},{tuple(e['pages']) for e in love.values() if len(e['pages'])==2})
        self.assertTrue(all(len(e['content'].splitlines())==8 for e in love.values()))

    def test_hour_boundaries_all_months_and_midnight(self):
        _,anchors=source.load_records()
        for a in anchors:
            month=int(a['month']);h,m=map(int,a['start'].split(':'));start=h*60+m
            for slot,branch in enumerate(source.BRANCHES):
                for offset,part in ((0,1),(39,1),(40,2),(79,2),(80,3),(119,3)):
                    t=(start+slot*120+offset)%1440
                    self.assertEqual((branch,part),source.classify_hour(month,f'{t//60:02d}:{t%60:02d}',anchors))
            counts=Counter(source.classify_hour(month,f'{t//60:02d}:{t%60:02d}',anchors) for t in range(1440))
            self.assertEqual(36,len(counts));self.assertEqual({40},set(counts.values()))
        for time,result in (('05:19',('SUU',3)),('05:20',('DAN',1)),('06:00',('DAN',2)),('06:40',('DAN',3)),('07:20',('MAO',1)),('00:00',('HOI',2))):
            self.assertEqual(result,source.classify_hour(5,time,anchors))

    def test_invalid_hour_inputs_fail_closed(self):
        _,anchors=source.load_records()
        for month,time in ((0,'05:20'),(13,'05:20'),(True,'05:20'),(5,'24:00'),(5,'05:60'),(5,'5:20'),(5,'05:20:00'),(5,'-1:10')):
            with self.subTest(month=month,time=time),self.assertRaises(ValueError):source.classify_hour(month,time,anchors)

    def test_all_source_files_and_manifest_are_pinned(self):
        files=list((source.ROOT/'data').glob('tam_the_d02*'))
        for changed in files:
            with tempfile.TemporaryDirectory() as folder:
                for f in files:shutil.copyfile(f,Path(folder)/f.name)
                p=Path(folder)/changed.name;p.write_text(p.read_text(encoding='utf-8')+' ',encoding='utf-8')
                with self.assertRaises(ValueError):source.load_records(folder)

    def test_windows_newlines_preserve_review_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            for f in (source.ROOT/'data').glob('tam_the_d02*'):
                (Path(folder)/f.name).write_bytes(f.read_text(encoding='utf-8').replace('\n','\r\n').encode())
            self.assertEqual(source.load_records(),source.load_records(folder))

    @staticmethod
    def sample_db():
        entries,anchors=source.load_records()
        rows=[dict(e,status='VERIFIED',editor=source.EDITOR,reviewer=source.REVIEWER,reviewed_at='2026-10-25',
                   page_sources=source.page_sources(e),table_sha=source.SOURCE_SHA,content_sha=source.SOURCE_SHA,
                   table_source=source.source_label(e['table_page']),content_source=source.source_label(e['content_page']),
                   table_printed=str(e['table_page']+1),content_printed=str(e['content_page']+1)) for e in entries]
        rules=[dict(module='TAM_THE',code=code,status='VERIFIED',reviewer=source.REVIEWER,reviewed_at='2026-10-25',
                    verification_note=source.RULE_NOTES[code],description=source.DESCRIPTIONS[code],
                    label=source.RULE_LOCATIONS[code][0],pdf=source.RULE_LOCATIONS[code][1],
                    printed=str(source.RULE_LOCATIONS[code][1]+1),book_sha=source.SOURCE_SHA) for code in source.CODES]
        ars=[dict(month=int(a['month']),start=a['start'],source=a['source_branch'],adopted=a['adopted_branch'],
                  pdf=int(a['primary_page']),label=a['primary_label'],printed=str(int(a['primary_page'])+1),book_sha=source.SOURCE_SHA,
                  status='VERIFIED',reviewer=source.REVIEWER,reviewed_at='2026-10-25',verification_note=source.anchor_note(a)) for a in anchors]
        ars[4]['reviewer']='TV2 (project owner confirmation)'
        ars[4]['verification_note']='TV2 confirmation reported by project owner on 2026-10-23; source printed DAU, team adopts DAN only for month 5.'
        return dict(d02_entries=rows,rules=rules,anchors=ars,migrations=['9'])

    def test_audit_rejects_corrupt_text_metadata_source_chain_and_anchor(self):
        db=self.sample_db();self.assertTrue(audit_d02(Audit(),db))
        for collection,index,field,value in (
            ('d02_entries',0,'content','invented'),('d02_entries',0,'note',None),
            ('d02_entries',0,'table_sha','wrong'),('d02_entries',0,'page_sources',[]),
            ('rules',0,'reviewer','someone else'),('anchors',0,'start','04:30'),('anchors',4,'reviewer',source.REVIEWER)):
            altered=copy.deepcopy(db);altered[collection][index][field]=value
            with self.subTest(field=field):self.assertFalse(audit_d02(Audit(),altered))


if __name__=='__main__':unittest.main()
