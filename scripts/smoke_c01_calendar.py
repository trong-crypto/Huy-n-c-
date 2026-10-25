"""Run a private temporary Server against huyenco and check real calendar HTTP responses.
Requires a packaged -Pdatabase jar and PGPASSWORD; changes no user data or UI.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-fixtures',action='store_true')
    args=parser.parse_args()
    if not os.getenv('PGPASSWORD'): raise RuntimeError('Set PGPASSWORD in process environment')
    jar=ROOT/'server/target/huyen-co-server-0.1.0-SNAPSHOT.jar'
    if not jar.is_file(): raise RuntimeError('Package the database-profile jar first')
    env=dict(os.environ,DB_URL='jdbc:postgresql://127.0.0.1:5432/huyenco',DB_USERNAME='postgres',DB_PASSWORD=os.environ['PGPASSWORD'])
    java=Path(os.getenv('JAVA_HOME') or str(Path(os.environ['ProgramFiles'])/'Java/jdk-17'))/'bin/java.exe'
    with socket.socket() as binding:
        binding.bind(('127.0.0.1',0)); port=binding.getsockname()[1]
    output=ROOT/'scripts/generated';output.mkdir(exist_ok=True)
    log=(output/'c01_server.log').open('w',encoding='utf-8')
    process=subprocess.Popen([str(java),'-jar',str(jar),'--spring.profiles.active=db',f'--server.port={port}','--server.address=127.0.0.1'],
                             cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    checks=0
    def call(endpoint,payload,expected=200):
        nonlocal checks
        data=payload if isinstance(payload,bytes) else json.dumps(payload).encode()
        request=urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/calendar/{endpoint}',data=data,headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(request,timeout=8) as response: status,body=response.status,response.read()
        except urllib.error.HTTPError as error: status,body=error.code,error.read()
        result=json.loads(body)
        assert status==expected,(status,result)
        assert str(uuid.UUID(result['requestId']))==result['requestId']
        assert result['status']==('COMPLETED' if expected==200 else 'FAILED')
        assert (result['error'] is None)==(expected==200)
        if expected!=200: assert result['data'] is None
        checks+=1
        return result
    def date(year,month,day,kind='SOLAR',leap=False):
        return dict(calendarType=kind,year=year,month=month,day=day,isLeapMonth=leap)
    try:
        deadline=time.monotonic()+45
        while True:
            if process.poll() is not None: raise RuntimeError('Temporary Server stopped; inspect c01_server.log')
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health',timeout=1) as response:
                    if response.status==200: break
            except (urllib.error.URLError,TimeoutError): pass
            if time.monotonic()>deadline: raise TimeoutError('Server startup exceeded 45 seconds')
            time.sleep(.2)
        example=json.loads((ROOT/'docs/examples/calendar-convert.request.json').read_text())
        convert=call('convert',example)
        assert convert['data']['lunarDate']==dict(year=1999,month=11,day=25,isLeapMonth=False)
        lunar=call('convert',date(2023,2,1,'LUNAR',True));assert lunar['data']['solarDate']=='2023-03-22'
        for solar,expected in ((date(1900,1,1),'1900-01-01'),(date(2099,12,31),'2099-12-31')):
            forward=call('convert',solar);assert forward['data']['solarDate']==expected
            back=call('convert',dict(calendarType='LUNAR',**forward['data']['lunarDate']));assert back['data']['solarDate']==expected
        invalid=call('convert',date(1900,2,29),400);assert invalid['error']['code']=='INVALID_DATE'
        for payload in (date(2100,1,1),date(2024,2,1,'LUNAR',True),date(2023,2,30,'LUNAR',True),b'{}{}',b'{"year":2024,"year":2023}',b'\xff'):
            call('convert',payload,400)
        can_request={'date':date(2024,2,10),'time':'23:59'}
        can=call('can-chi',can_request)
        assert can['data']['year']=={'stem':'GIAP','branch':'THIN'}
        assert can['data']['hour']=={'stem':'GIAP','branch':'TY'}
        assert call('can-chi',{'date':date(2024,2,10)})['data']['hour'] is None
        call('can-chi',{'date':date(2024,2,10),'time':'24:00'},400)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda value:call('convert',value),[date(2024,2,9),date(2024,2,10)]))
        assert results[0]['requestId']!=results[1]['requestId']
        assert results[0]['data']['lunarDate']['year']==2023 and results[1]['data']['lunarDate']['year']==2024
        if args.write_fixtures:
            samples={'calendar-convert.response.json':convert,'calendar-can-chi.request.json':can_request,
                     'calendar-can-chi.response.json':can,'calendar-invalid-date.response.json':invalid}
            for filename,value in samples.items():
                if 'requestId' in value: value=dict(value,requestId='550e8400-e29b-41d4-a716-446655440026')
                (ROOT/'docs/examples'/filename).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        report={'httpChecks':checks,'database':'huyenco','temporaryPort':port,'fixturesWritten':args.write_fixtures,'serverStopped':False}
    finally:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
        log.close()
    report['serverStopped']=True
    (output/'c01_http_result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
