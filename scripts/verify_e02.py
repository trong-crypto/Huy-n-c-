"""Start the built server temporarily, test E02 HTTP, prove production DB unchanged.

Requires PGPASSWORD in the process environment and a -Pdatabase package build.
No migrations or writes are performed against the selected database.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

from import_book_knowledge import find_psql
from test_a02_bootstrap import TABLES

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5432)
    parser.add_argument('--database', default='huyenco')
    parser.add_argument('--user', default='postgres')
    parser.add_argument('--http-port', type=int, default=18082)
    parser.add_argument('--no-db-port', type=int, default=18083)
    parser.add_argument('--write-fixtures', action='store_true')
    args = parser.parse_args()
    if not os.environ.get('PGPASSWORD'):
        raise RuntimeError('PGPASSWORD is required in the environment; never save it in source.')
    env = dict(os.environ, PGCLIENTENCODING='UTF8', PGCONNECT_TIMEOUT='5')
    env['JAVA_HOME'] = env.get('JAVA_HOME') or str(Path(os.environ['ProgramFiles'])/'Java/jdk-17')
    java = str(Path(env['JAVA_HOME'])/'bin/java.exe')
    output = ROOT/'scripts/generated'
    output.mkdir(parents=True,exist_ok=True)
    psql = find_psql('psql')

    def snapshot():
        queries = ['BEGIN READ ONLY;']
        for table in TABLES:
            queries.append("SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) FROM " + table + ' t;')
        queries.append('COMMIT;')
        result = subprocess.run([psql,'-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',
                    '-h',args.host,'-p',str(args.port),'-U',args.user,'-d',args.database],
                    input='\n'.join(queries),env=env,capture_output=True,text=True,encoding='utf-8',timeout=30,check=True)
        return hashlib.sha256(result.stdout.strip().encode()).hexdigest()

    def serve(no_db):
        port = args.no_db_port if no_db else args.http_port
        url = 'http://127.0.0.1:'+str(port)
        command=[java,'-jar',str(ROOT/'server/target/huyen-co-server-0.1.0-SNAPSHOT.jar'),
                 '--server.address=127.0.0.1','--server.port='+str(port),'--spring.flyway.enabled=false']
        child_env=dict(env)
        if no_db:
            child_env.pop('SPRING_PROFILES_ACTIVE',None)
            command += ['--spring.profiles.active=default',
                        '--spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration']
        else:
            child_env.update(DB_URL=f'jdbc:postgresql://{args.host}:{args.port}/{args.database}',
                             DB_USERNAME=args.user, DB_PASSWORD=env['PGPASSWORD'])
            command += ['--spring.profiles.active=db','--spring.datasource.hikari.read-only=true']
        log=output/('e02_server_no_db.log' if no_db else 'e02_server.log')
        with log.open('wb') as stream:
            process = subprocess.Popen(command,cwd=ROOT,env=child_env,stdout=stream,stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            try:
                for _ in range(120):
                    if process.poll() is not None:
                        raise RuntimeError('Server exited; inspect '+str(log))
                    try:
                        with urlopen(url+'/api/v1/health',timeout=1) as response:
                            if response.status == 200: break
                    except OSError:
                        time.sleep(0.25)
                else:
                    raise RuntimeError('Server readiness timeout; inspect '+str(log))
                smoke=[sys.executable,str(ROOT/'scripts/smoke_e02_hexagrams.py'),'--url',url]
                if no_db: smoke += ['--no-db']
                elif args.write_fixtures: smoke += ['--write-fixtures']
                subprocess.run(smoke,env=env,cwd=ROOT,timeout=120,check=True)
            finally:
                process.terminate()
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait(timeout=10)

    before = snapshot()
    serve(True)
    serve(False)
    after = snapshot()
    assert before == after, 'The selected DB changed during the HTTP check; inspect before claiming read-only completion.'
    report={'database':args.database,'beforeSha256':before,'afterSha256':after,
            'identicalRows':True,'httpVerified':True,'noDbVerified':True,'temporaryServersStopped':True}
    (output/'e02_database_unchanged.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('E02 HTTP complete; both servers stopped, database snapshot unchanged.')


if __name__ == '__main__':
    main()
