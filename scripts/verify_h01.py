"""H01 integration: disposable DB, real HTTP/STOMP, restart persistence, knowledge regression.

Requires PGPASSWORD in environment. Never writes to the user's huyenco database.
"""
import argparse
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
from urllib.request import urlopen,Request
from urllib.error import HTTPError
import uuid
from import_book_knowledge import find_psql

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=18084)
    parser.add_argument('--write-fixtures',action='store_true')
    args=parser.parse_args()
    if not os.getenv('PGPASSWORD'):raise RuntimeError('PGPASSWORD is required in process environment.')
    env=dict(os.environ,PGCLIENTENCODING='UTF8',PGCONNECT_TIMEOUT='5',MAVEN_SKIP_RC='1')
    env['JAVA_HOME']=env.get('JAVA_HOME') or str(Path(os.environ['ProgramFiles'])/'Java/jdk-17')
    env.update(DB_USERNAME='postgres',DB_PASSWORD=env['PGPASSWORD'])
    name='huyenco_a02_'+uuid.uuid4().hex[:12]
    env['DB_URL']='jdbc:postgresql://127.0.0.1:5432/'+name
    psql=Path(find_psql('psql'));out=ROOT/'scripts/generated';out.mkdir(parents=True,exist_ok=True)
    created=False;server=None;log=None;node=None;report={'database':name,'passed':False,'cleanedUp':False}
    def command(values,**kw):
        return subprocess.run([str(v) for v in values],env=env,cwd=ROOT,check=True,timeout=kw.pop('timeout',180),**kw)
    def stop():
        nonlocal server,log
        if server is not None:
            server.terminate()
            try:server.wait(timeout=10)
            except subprocess.TimeoutExpired:server.kill();server.wait(timeout=10)
            server=None
        if log is not None:log.close();log=None
    def start(restart=False,no_db=False):
        nonlocal server,log
        log=(out/('h01_server_no_db.log' if no_db else 'h01_server_restart.log' if restart else 'h01_server.log')).open('wb')
        java_args=[str(Path(env['JAVA_HOME'])/'bin/java.exe'),'-jar',str(ROOT/'server/target/huyen-co-server-0.1.0-SNAPSHOT.jar'),
            '--spring.profiles.active='+('default' if no_db else 'db'),'--server.address=127.0.0.1','--server.port='+str(args.port),
            '--huyenco.history-result-ttl-seconds=5']
        if no_db:java_args+=['--spring.flyway.enabled=false','--spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration']
        server=subprocess.Popen(java_args,env=env,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        for _ in range(120):
            if server.poll() is not None:raise RuntimeError('Server exited; inspect h01_server log.')
            try:
                with urlopen(f'http://127.0.0.1:{args.port}/api/v1/health',timeout=1) as response:
                    if response.status==200:return
            except OSError:time.sleep(.25)
        raise RuntimeError('Server startup timed out.')
    try:
        command([psql.with_name('createdb.exe'),'-w','-h','127.0.0.1','-U','postgres',name]);created=True
        with (out/'h01_live_bootstrap.log').open('wb') as stream:
            command(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',ROOT/'scripts/import_all.ps1',
                     '-DbName',name,'-AuditOutput',out/'h01_live_audit.md'],stdout=stream,stderr=subprocess.STDOUT,timeout=650)
        start()
        child=dict(env,H01_HTTP_URL=f'http://127.0.0.1:{args.port}',H01_RESTART_CHECK='1')
        if args.write_fixtures:child['H01_WRITE_FIXTURES']='1'
        node=subprocess.Popen(['node',str(ROOT/'client/scripts/smoke-history.mjs')],env=child,cwd=ROOT,
                              stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
        lines=queue.Queue()
        def read():
            for line in node.stdout:lines.put(line)
            lines.put(None)
        threading.Thread(target=read,daemon=True).start()
        captured=[]
        while True:
            line=lines.get(timeout=180)
            if line is None:break
            captured.append(line)
            if line.strip()=='H01_READY_FOR_RESTART':
                stop();start(True);node.stdin.write('continue\n');node.stdin.flush()
        node.wait(timeout=20)
        (out/'h01_network.log').write_text(''.join(captured),encoding='utf-8')
        if node.returncode:raise RuntimeError('H01 network check failed; inspect h01_network.log')
        # Regression includes all 64 E02 entries, with no ownership headers needed for public knowledge.
        command([sys.executable,ROOT/'scripts/smoke_e02_hexagrams.py','--url',f'http://127.0.0.1:{args.port}'])
        sql="SELECT count(*) FROM interpretation_history;"
        result=command([psql,'-X','-w','-A','-t','-h','127.0.0.1','-U','postgres','-d',name,'-c',sql],capture_output=True,text=True)
        report.update(passed=True,restartPersistence=True,remainingHistory=int(result.stdout.strip()),e02Regression=True)
        stop();start(no_db=True)
        for route,method,payload,expected,code in (('/session','POST',b'{}',503,'DATABASE_UNAVAILABLE'),('/history','GET',None,401,'INVALID_SESSION')):
            request=Request(f'http://127.0.0.1:{args.port}/api/v1'+route,data=payload,method=method,
                            headers={'X-HuyenCo-Request':'1','Content-Type':'application/json','Origin':'http://localhost:3000'})
            try:urlopen(request,timeout=5)
            except HTTPError as failure:
                assert failure.code==expected and json.load(failure)['error']['code']==code
            else:raise AssertionError('Expected unavailable/unauthenticated error without DB')
        report['noDbHttp']=2
    finally:
        if node is not None and node.poll() is None:node.kill();node.wait(timeout=10)
        stop()
        if created and name.startswith('huyenco_a02_') and len(name)==24:
            command([psql.with_name('dropdb.exe'),'-w','-h','127.0.0.1','-U','postgres',name]);report['cleanedUp']=True
        (out/'h01_integration.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
