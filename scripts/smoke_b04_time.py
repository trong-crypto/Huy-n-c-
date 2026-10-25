"""Start a temporary localhost Server and check TIME plus existing STOMP routes; no DB writes."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-fixture',action='store_true')
    parser.add_argument('--progress-only',action='store_true',help='Check the B02 progress/error/reconnect regression only')
    args=parser.parse_args()
    if not os.getenv('PGPASSWORD'): raise RuntimeError('Set PGPASSWORD in process environment')
    env=dict(os.environ,DB_URL='jdbc:postgresql://127.0.0.1:5432/huyenco',DB_USERNAME='postgres',DB_PASSWORD=os.environ['PGPASSWORD'])
    java=Path(os.getenv('JAVA_HOME') or str(Path(os.environ['ProgramFiles'])/'Java/jdk-17'))/'bin/java.exe'
    jar=ROOT/'server/target/huyen-co-server-0.1.0-SNAPSHOT.jar'
    if not jar.is_file(): raise RuntimeError('Package the database-profile Server first')
    with socket.socket() as binding:
        binding.bind(('127.0.0.1',0));port=binding.getsockname()[1]
    output=ROOT/'scripts/generated';output.mkdir(exist_ok=True)
    env['WS_URL']=f'ws://127.0.0.1:{port}/ws'
    env['TIME_REPORT_PATH']=str(output/'b04_time_stomp.json')
    if args.write_fixture: env['TIME_FIXTURE_PATH']=str(ROOT/'docs/examples/mai-hoa-time.response.json')
    with (output/'b04_server.log').open('w',encoding='utf-8') as log:
        process=subprocess.Popen([str(java),'-jar',str(jar),'--spring.profiles.active=db',f'--server.port={port}','--server.address=127.0.0.1'],
                                 cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        try:
            deadline=time.monotonic()+45
            while True:
                if process.poll() is not None: raise RuntimeError('Server stopped; inspect b04_server.log')
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health',timeout=1) as response:
                        if response.status==200: break
                except (urllib.error.URLError,TimeoutError): pass
                if time.monotonic()>deadline: raise TimeoutError('Server startup exceeded 45 seconds')
                time.sleep(.2)
            # Functional regressions share this temporary Server; no UI pages/components are changed.
            selected = ('smoke-progress-errors.mjs',) if args.progress_only else ('smoke-time.mjs','smoke-object-count.mjs','smoke-lines.mjs','smoke-stomp.mjs')
            for script in selected:
                subprocess.run(['node','scripts/'+script],cwd=ROOT/'client',env=env,check=True,timeout=100)
        finally:
            process.terminate()
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
    print('Temporary B04 Server stopped; application sources and evidence are ready for review.')

if __name__=='__main__': main()
