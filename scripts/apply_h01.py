"""Back up huyenco, apply only Flyway through V11, verify knowledge data unchanged.

Requires PGPASSWORD in the process environment. No credential is written to logs.
"""
import argparse
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import subprocess
import sys
from import_book_knowledge import find_psql
from import_hexagram_names import psql

ROOT=Path(__file__).resolve().parents[1]
KNOWLEDGE_TABLES=('source_books','source_sections','calculation_rules','trigrams','hexagrams','hexagram_lines',
                  'interpretations','tam_the_hour_anchors','tam_the_lookup_entries','tam_the_lookup_source_pages','external_sources')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='127.0.0.1');parser.add_argument('--port',type=int,default=5432)
    parser.add_argument('--database',default='huyenco');parser.add_argument('--user',default='postgres');parser.add_argument('--psql',default='psql')
    args=parser.parse_args()
    if not os.getenv('PGPASSWORD'):raise RuntimeError('Set PGPASSWORD in process environment; do not save passwords in source.')
    env=dict(os.environ,PGCONNECT_TIMEOUT='5',PGCLIENTENCODING='UTF8',MAVEN_SKIP_RC='1')
    env.update(DB_URL=f'jdbc:postgresql://{args.host}:{args.port}/{args.database}',DB_USERNAME=args.user,DB_PASSWORD=env['PGPASSWORD'])
    env['JAVA_HOME']=env.get('JAVA_HOME') or str(Path(os.environ['ProgramFiles'])/'Java/jdk-17')
    def snapshot():
        fields=[]
        for table in KNOWLEDGE_TABLES:
            fields.append("'"+table+"',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) FROM "+table+" t)")
        return json.loads(psql(args,'BEGIN READ ONLY; SELECT json_build_object('+','.join(fields)+')::text; COMMIT;'))
    before=snapshot()
    binary=Path(find_psql(args.psql));folder=ROOT/'scripts/generated';backupdir=folder/'db-backups';backupdir.mkdir(parents=True,exist_ok=True)
    backup=backupdir/('before-h01-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.dump')
    subprocess.run([str(binary.with_name('pg_dump.exe')),'-w','-Fc','-h',args.host,'-p',str(args.port),'-U',args.user,'-f',str(backup),args.database],env=env,check=True,timeout=120)
    subprocess.run([str(binary.with_name('pg_restore.exe')),'-l',str(backup)],env=env,check=True,timeout=30,capture_output=True)
    if backup.stat().st_size<1024:raise RuntimeError('Backup incomplete; migration not started.')
    print('Full DB backup: '+str(backup))
    with (folder/'h01_migration.log').open('wb') as log:
        subprocess.run(['cmd.exe','/d','/c','mvnw.cmd','-B','-ntp','-Pdatabase','flyway:migrate','-Dflyway.target=11'],
                       cwd=ROOT/'server',env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=240)
    after=snapshot()
    if before!=after:raise RuntimeError('Knowledge data changed during migration; inspect before continuing.')
    status=json.loads(psql(args,"""BEGIN READ ONLY; SELECT json_build_object(
        'migrationV11',(SELECT count(*)=1 AND bool_and(success) FROM flyway_schema_history WHERE version='11'),
        'sessions',(SELECT count(*) FROM anonymous_sessions),
        'history',(SELECT count(*) FROM interpretation_history))::text; COMMIT;"""))
    if not status['migrationV11']:raise RuntimeError('V11 not confirmed.')
    status.update(database=args.database,backup=str(backup),knowledgeUnchanged=True,knowledgeHashes=after)
    (folder/'h01_deployment.json').write_text(json.dumps(status,indent=2)+'\n',encoding='utf-8')
    print('H01 V11 applied; knowledge unchanged; sessions='+str(status['sessions'])+', history='+str(status['history']))

if __name__=='__main__':main()
