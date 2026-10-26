"""Create a new isolated TEST DB; bootstrap twice; verify M02 import and corruption guards.

Requires PGPASSWORD in the environment. Never changes the project's huyenco DB.
Leaves the dedicated TEST database available for inspection; refuses an existing name.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

from import_book_knowledge import find_psql
from import_m02_readings import ROOT, TABLES, build_sql
from check_m01_readings import load_review, require


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',required=True)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=5432)
    parser.add_argument('--user',default='postgres')
    parser.add_argument('--pdf-dir',default=str(Path.home()/'Downloads'))
    args=parser.parse_args()
    require(re.fullmatch(r'huyenco_m02_test_[a-z0-9_]{1,40}',args.database) is not None,
            'A new huyenco_m02_test_* database name is required')
    require(os.environ.get('PGPASSWORD'),'PGPASSWORD is required')
    load_review(pdf_dir=Path(args.pdf_dir))  # Validate originals before creating anything.
    executable=Path(find_psql('psql'))
    common=['-w','-h',args.host,'-p',str(args.port),'-U',args.user]
    env=dict(os.environ,PGCLIENTENCODING='UTF8',PGCONNECT_TIMEOUT='10',MAVEN_SKIP_RC='1')
    env.setdefault('JAVA_HOME',str(Path(os.environ['ProgramFiles'])/'Java/jdk-17'))
    report={'database':args.database,'startedAt':datetime.now(timezone.utc).isoformat(),
            'bootstrapRuns':0,'idempotent':False,'protectedBaselineUnchanged':False,
            'corruptionGuardsPassed':0,'schemaGuardsPassed':0,'runtimeEnabled':False,
            'productionDatabaseChanged':False,'status':'RUNNING'}
    output=ROOT/'scripts/generated/m02_database_test_report.json'
    output.parent.mkdir(parents=True,exist_ok=True)

    def run(command, *, cwd=ROOT, text=None, timeout=180):
        completed=subprocess.run([str(x) for x in command],cwd=cwd,env=env,input=text,
                                 capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=timeout)
        if completed.returncode:
            raise RuntimeError(completed.stdout[-3500:]+'\n'+completed.stderr[-3500:])
        return completed.stdout.strip()

    def sql(statement, database=None):
        return run([executable,*common,'-X','-A','-t','-q','-v','ON_ERROR_STOP=1',
                    '-d',database or args.database],text=statement)

    def snapshot():
        names=json.loads(sql("SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"))
        return {name:json.loads(sql('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb) FROM '+name+' t'))
                for name in names}

    try:
        require(sql("SELECT count(*) FROM pg_database WHERE datname='"+args.database+"'",'postgres') == '0',
                'TEST name already exists; refusing to overwrite it')
        run([executable.with_name('createdb.exe'),*common,args.database])
        before=None
        for iteration in (1,2):
            log=run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',
                     ROOT/'scripts/import_all.ps1','-DbName',args.database,'-DbHost',args.host,
                     '-DbPort',args.port,'-DbUser',args.user,'-PdfDir',args.pdf_dir,
                     '-AuditOutput',ROOT/'scripts/generated/m02_baseline_audit.md'],timeout=650)
            (ROOT/f'scripts/generated/m02_bootstrap_{iteration}.log').write_text(log,encoding='utf-8')
            baseline=snapshot()
            run([os.sys.executable,ROOT/'scripts/import_m02_readings.py','--apply','--database',args.database,
                 '--host',args.host,'--port',args.port,'--user',args.user,'--pdf-dir',args.pdf_dir],timeout=200)
            after=snapshot()
            require(all(rows == after[table] for table,rows in baseline.items() if table not in TABLES),
                    'M02 modified pre-existing knowledge, sessions or migration rows')
            report['protectedBaselineUnchanged']=True
            if before is not None: require(before == after,'Second bootstrap/import changed persisted data')
            before=after
            report['bootstrapRuns']=iteration
        report['idempotent']=True
        report['tableCounts']={table:len(before[table]) for table in TABLES}
        body=build_sql(load_review()).removeprefix('BEGIN;').removesuffix('COMMIT;\n')
        for mutation,expected in (
            ("UPDATE reading_source_bundles SET reviewer='changed'",'changed/protected'),
            ("UPDATE reading_source_bundles SET document_sha256=repeat('0',64)",'changed/protected'),
            ("UPDATE reading_source_bundles SET reviewed_document=jsonb_set(reviewed_document,'{decisions,0,basis}', '\"SOURCE_VERIFIED\"')",'changed/protected'),
            ("DELETE FROM mai_hoa_reading_templates WHERE template_code='MH-LOVE-SAME_ELEMENT'",'incomplete existing bundle'),
            ("UPDATE mai_hoa_reading_templates SET content='changed',source_record=jsonb_set(source_record,'{content}','\"changed\"') WHERE topic='GENERAL'",'changed/protected'),
            ("UPDATE tam_the_supplement_results SET source_table_label='Phá' WHERE result_code='TT-DIEN-SAN-06'",'changed/protected'),
            ("UPDATE tam_the_supplement_mappings SET table_row=2 WHERE lookup_key='BRANCH:TY|MONTH:01'",'changed/protected'),
            ("UPDATE source_books SET pdf_page_count=1 WHERE pdf_page_count=672",'source PDF identity mismatch'),
        ):
            try:
                sql('BEGIN;'+mutation+';'+body+'ROLLBACK;')
            except RuntimeError as error:
                require(expected in str(error),'Unexpected guard failure: '+str(error))
                report['corruptionGuardsPassed']+=1
            else: raise AssertionError('An altered review/source record was accepted')
        for mutation in (
            "UPDATE tam_the_supplement_mappings SET lookup_key='BRANCH:TY|MONTH:00' WHERE lookup_key='BRANCH:TY|MONTH:01'",
            "UPDATE mai_hoa_reading_templates SET content=' ' WHERE template_code='MH-LOVE-SAME_ELEMENT'",
            "UPDATE reading_source_bundles SET reviewed_document=jsonb_set(reviewed_document,'{runtimeEnabled}','true')",
        ):
            try: sql('BEGIN;'+mutation+';ROLLBACK;')
            except RuntimeError as error:
                require('violates check constraint' in str(error),'Unexpected schema failure: '+str(error))
                report['schemaGuardsPassed']+=1
            else: raise AssertionError('Schema accepted invalid knowledge')
        require(snapshot() == before,'Guard tests changed persisted data')
        report['stableSnapshotSha256']=hashlib.sha256(json.dumps(before,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        require(sql('SELECT count(*) FROM anonymous_sessions') == sql('SELECT count(*) FROM interpretation_history') == '0',
                'TEST database unexpectedly contains user sessions/history')
        report['status']='PASS'
        print(json.dumps(report,ensure_ascii=False,indent=2))
    except Exception as error:
        report['status']='FAIL'
        report['error']=str(error)
        raise
    finally:
        output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__':
    main()
