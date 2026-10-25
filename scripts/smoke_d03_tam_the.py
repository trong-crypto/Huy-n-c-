"""Run D03 and protocol regressions on a temporary localhost Server; no DB writes."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-fixtures',action='store_true')
    args=parser.parse_args()
    if not os.getenv('PGPASSWORD'):raise RuntimeError('Set PGPASSWORD in the process environment')
    env=dict(os.environ,DB_URL='jdbc:postgresql://127.0.0.1:5432/huyenco',DB_USERNAME='postgres',DB_PASSWORD=os.environ['PGPASSWORD'])
    java=Path(os.getenv('JAVA_HOME') or str(Path(os.environ['ProgramFiles'])/'Java/jdk-17'))/'bin/java.exe'
    jar=ROOT/'server/target/huyen-co-server-0.1.0-SNAPSHOT.jar'
    if not jar.is_file():raise RuntimeError('Package Server with database profile first')
    with socket.socket() as binding:binding.bind(('127.0.0.1',0));port=binding.getsockname()[1]
    output=ROOT/'scripts/generated';output.mkdir(exist_ok=True)
    env['WS_URL']=f'ws://127.0.0.1:{port}/ws'
    env['D03_REPORT_PATH']=str(output/'d03_stomp.json')
    if args.write_fixtures:env['D03_WRITE_FIXTURES']='1'
    with (output/'d03_server.log').open('w',encoding='utf-8') as log:
        process=subprocess.Popen([str(java),'-jar',str(jar),'--spring.profiles.active=db',f'--server.port={port}',
            '--server.address=127.0.0.1','--spring.flyway.enabled=false'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        try:
            deadline=time.monotonic()+45
            while True:
                if process.poll() is not None:raise RuntimeError('Server stopped: see d03_server.log')
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health',timeout=1) as response:
                        if response.status==200:break
                except (urllib.error.URLError,TimeoutError):pass
                if time.monotonic()>deadline:raise TimeoutError('Startup exceeded 45 seconds')
                time.sleep(.2)
            for script in ('smoke-tam-the.mjs','smoke-stomp.mjs','smoke-progress-errors.mjs','smoke-time.mjs','smoke-lines.mjs','smoke-object-count.mjs'):
                subprocess.run(['node','scripts/'+script],cwd=ROOT/'client',env=env,check=True,timeout=120)
        finally:
            process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
    print('Temporary D03 Server stopped. No migrations or imports were run against huyenco.')


if __name__=='__main__':main()
