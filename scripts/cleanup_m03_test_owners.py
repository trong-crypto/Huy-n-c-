"""Remove only opaque TEST owners created by smoke-m03 or smoke-d04; refuses a production database name.

Reads token hashes (not tokens/passwords) recorded by the acceptance client. PGPASSWORD
must be supplied in the process environment. No broad session/history deletion.
"""
import argparse
import json
import re
from pathlib import Path
from import_book_knowledge import ROOT, find_psql
from import_hexagram_names import psql

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',required=True)
    parser.add_argument('--task',choices=('M03','D04'),default='M03')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=5432)
    parser.add_argument('--user',default='postgres')
    parser.add_argument('--psql',default='psql')
    args=parser.parse_args()
    if not re.fullmatch(r'huyenco_m02_test_[a-z0-9_]{1,40}',args.database):
        raise ValueError('Only isolated huyenco_m02_test_* targets are allowed')
    source=ROOT/f'scripts/generated/{args.task.lower()}_owner_cleanup.json'
    if not source.exists(): print(f'No {args.task} test owners pending cleanup.');return
    hashes=json.loads(source.read_text(encoding='utf-8'))['tokenHashes']
    if not isinstance(hashes,list) or len(hashes)>100 or not all(isinstance(h,str) and re.fullmatch('[0-9a-f]{64}',h) for h in hashes):
        raise ValueError('Invalid M03 owner hash record')
    if not hashes: source.unlink();return
    # Hex-only values cannot inject SQL; database identity is checked on the same connection.
    values=','.join("'"+h+"'" for h in sorted(set(hashes)))
    result=psql(args,"BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; "
        "DO $$ BEGIN IF current_database()<> '"+args.database+"' THEN RAISE EXCEPTION 'Wrong TEST target'; END IF; END $$; "
        "WITH removed AS (DELETE FROM anonymous_sessions WHERE token_hash IN ("+values+") RETURNING owner_id) SELECT count(*) FROM removed; COMMIT;")
    source.unlink()
    print(args.task+' cleanup removed only recorded test owners: '+result)

if __name__=='__main__': main()
