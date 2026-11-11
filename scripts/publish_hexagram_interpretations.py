"""Import the project-owner-approved 64-hexagram editorial package into V34.

Dry-run by default. --apply backs up, restores and rehearses before changing source.
Source approval is attributed to the project owner. Draft files remain source records.
"""
from __future__ import annotations
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
from getpass import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
from uuid import uuid5, NAMESPACE_URL
from prepare_chat_test_fixtures import hashes, literal, SERVER_JAR

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT/"data"/name for name in (
    "hexagram_interpretation_sources.csv", "hexagram_interpretation_pilot.draft.json",
    "hexagram_interpretation_overviews.draft.json", "hexagram_interpretation_details.draft.json")]
APPROVAL = "Chủ dự án duyệt toàn bộ gói biên tập trong cuộc trò chuyện ngày 11/11/2026. Phạm vi nguồn và dị bản theo docs/hexagram-interpretation/source-review.md. Đây là lời Việt biên soạn, không phải bản dịch đã đối chiếu toàn bộ ấn bản sách."
APPROVED_PACKAGE_SHA256 = "2012ab61cad531b8429a9527990b12cc97f90c1b8810b9a2ea053bcd49ef33cb"
AUTHOR = str(uuid5(NAMESPACE_URL, "huyenco:editorial-package-import"))
REVIEWER = str(uuid5(NAMESPACE_URL, "huyenco:owner-approved-publication"))

def package():
    catalog = list(csv.DictReader(FILES[0].open(encoding="utf-8-sig")))
    pilots, overviews, details = [json.loads(p.read_text(encoding="utf-8-sig"))["entries"] for p in FILES[1:]]
    result = {}
    for row in pilots:
        kinds = {s["kind"]: s["text"] for s in row["sections"] if s["kind"] != "LINE"}
        result[row["code"]] = dict(overview=kinds["OVERVIEW"], image=kinds["IMAGE"],
            original=kinds["HEXAGRAM_TEXT"], paraphrase=kinds["HEXAGRAM_PARAPHRASE"],
            lines=[s["text"] for s in row["sections"] if s["kind"] == "LINE"], application=kinds["APPLICATION"])
    overview_map = {r["code"]: r["text"] for r in overviews}
    for row in details:
        result[row["code"]] = {k:row[k] for k in ("image","original","paraphrase","application")}
        result[row["code"]].update(overview=overview_map[row["code"]], lines=[r["text"] for r in row["lines"]])
    assert len(catalog) == len(result) == 64
    assert set(result) == {r["code"] for r in catalog}
    for row in catalog:
        assert re.fullmatch(r"H_[A-Z0-9]+_[A-Z0-9]+",row["code"])
        assert len(result[row["code"]]["lines"]) == 6
        for key,maximum in (("overview",6000),("image",2000),("original",2000),("paraphrase",4000),("application",4000)):
            assert len(result[row["code"]][key]) <= maximum, (row["code"],key)
        assert all(0<len(line)<=2000 for line in result[row["code"]]["lines"])
    digest=hashlib.sha256(b"".join(p.name.encode()+b"\0"+p.read_bytes() for p in FILES)).hexdigest()
    return catalog,result,digest

def statement(database, catalog, content, digest, encoded):
    sql=["BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';",
         "SELECT pg_advisory_xact_lock(349264);",
         f"DO $$ BEGIN IF current_database()<>{literal(database)} OR (SELECT max(version::int) FROM flyway_schema_history WHERE success)<>34 THEN RAISE EXCEPTION 'Expected selected V34 database'; END IF; END $$;"]
    for uid,identifier,name,pwd in ((AUTHOR,"system.editorial-import","Lưu vết nhập gói biên tập",encoded[0]),
                                    (REVIEWER,"system.owner-approval","Lưu vết chủ dự án phê duyệt",encoded[1])):
        sql.append(f"INSERT INTO accounts(id,identifier_normalized,display_name,password_hash,role,status,created_at) VALUES ({literal(uid)},{literal(identifier)},{literal(name)},{literal(pwd)},'ADMIN','LOCKED',CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING;")
        sql.append(f"DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM accounts WHERE id={literal(uid)} AND identifier_normalized={literal(identifier)} AND role='ADMIN' AND status='LOCKED') THEN RAISE EXCEPTION 'Invalid audit actor'; END IF; END $$;")
    for row in catalog:
        code=row["code"]; sid="ZHOUYI_"+code
        note="Chu Dịch Hán cổ trên Wikisource; tiếng Việt biên soạn theo gói dự án. "+APPROVAL
        if not content[code]["original"]:
            note += " Nguyên văn lời quẻ để trống do dị bản. Xem bản Hán ghim trong URL."
        source=dict(id=sid,title="Chu Dịch (周易) · "+row["name"],author="Khuyết danh (văn bản cổ truyền)",
                    edition="Wikisource tiếng Trung, phiên bản oldid ghim",locator=row["zhou_yi_section"],
                    url=row["zhou_yi_chapter_url"],reuseNote=note,reviewStatus="VERIFIED")
        snapshot=json.dumps([source],ensure_ascii=False)
        sql.append(f"""
DO $entry$
BEGIN
 PERFORM 1 FROM hexagrams WHERE code={literal(code)} AND lines_bottom_up=ARRAY[{','.join('true' if c=='1' else 'false' for c in row['lines_bottom_up'])}]::boolean[] FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hexagram identity mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM cms_hexagram_interpretation_imports WHERE hexagram_code={literal(code)} AND package_sha256={literal(digest)}) THEN RETURN; END IF;
 IF EXISTS (SELECT 1 FROM cms_hexagram_interpretation_revisions WHERE hexagram_code={literal(code)}) THEN RAISE EXCEPTION 'Existing editorial work must be reviewed before import'; END IF;
 INSERT INTO cms_hexagram_interpretation_sources(id,hexagram_code,title,author,edition,locator,url,reuse_note,review_status)
 VALUES ({literal(sid)},{literal(code)},{','.join(literal(str(source[k])) for k in ('title','author','edition','locator','url','reuseNote','reviewStatus'))});
 INSERT INTO cms_hexagram_interpretation_revisions(hexagram_code,version,content,source_snapshot,created_by)
 VALUES ({literal(code)},1,{literal(json.dumps(content[code],ensure_ascii=False))}::jsonb,{literal(snapshot)}::jsonb,{literal(AUTHOR)});
 INSERT INTO cms_hexagram_interpretation_events(hexagram_code,sequence,revision,action,actor_id,review_note)
 VALUES ({literal(code)},1,1,'SUBMIT',{literal(AUTHOR)},NULL),
        ({literal(code)},2,1,'PUBLISH',{literal(REVIEWER)},{literal(APPROVAL)});
 INSERT INTO cms_hexagram_interpretation_imports(hexagram_code,revision,package_sha256)
 VALUES ({literal(code)},1,{literal(digest)});
END $entry$;
""")
    sql.append("COMMIT;")
    return "\n".join(sql)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database",default="huyenco")
    parser.add_argument("--psql-dir",type=Path,default=Path("C:/Program Files/PostgreSQL/18/bin"))
    parser.add_argument("--apply",action="store_true")
    args=parser.parse_args()
    assert args.database=="huyenco" or re.fullmatch(r"huyenco_.*_test(?:_[a-z0-9]+)?",args.database)
    catalog,content,digest=package()
    print(f"Validated 64 overviews, 384 lines; package {digest}",flush=True)
    if not args.apply: return
    if digest != APPROVED_PACKAGE_SHA256:
        parser.error("This package differs from the owner-approved snapshot and must be reviewed before publication.")
    env=dict(os.environ,PGPASSWORD=os.environ.get("PGPASSWORD") or getpass("PostgreSQL password: "),PGCLIENTENCODING="UTF8")
    pg=args.psql_dir; conn=["-h","127.0.0.1","-p","5432","-U","postgres","-w"]
    out=ROOT/"server/target/hexagram-publication";out.mkdir(parents=True,exist_ok=True)
    def run(command,stdin=None):
        r=subprocess.run([str(v) for v in command],input=stdin,env=env,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=120)
        if r.returncode: raise RuntimeError(r.stderr[:700])
        return r.stdout.strip()
    def query(db,sql):return run([pg/"psql.exe",*conn,"-d",db,"-XAtq","-v","ON_ERROR_STOP=1"],sql)
    stamp=datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    backup=ROOT/f"scripts/generated/db-backups/{args.database}-before-editorial-{stamp}.dump"
    backup.parent.mkdir(parents=True,exist_ok=True)
    run([pg/"pg_dump.exe",*conn,"-Fc","-d",args.database,"-f",backup])
    run([pg/"pg_restore.exe","--list",backup])
    print("Backup complete: "+str(backup),flush=True)
    trial="huyenco_editorial_test_"+stamp
    run([pg/"createdb.exe",*conn,trial])
    run([pg/"pg_restore.exe",*conn,"--no-owner","--no-privileges","--exit-on-error","--single-transaction","-d",trial,backup])
    encoded=hashes(SERVER_JAR,"C:/Program Files/Java/jdk-17/bin/java.exe",[secrets.token_urlsafe(48),secrets.token_urlsafe(48)])
    audit_sql="""SELECT json_build_object('overviews',count(*),'lines',sum(jsonb_array_length(r.content->'lines')),
    'published',count(*) FILTER(WHERE EXISTS(SELECT 1 FROM cms_hexagram_interpretation_events e WHERE e.hexagram_code=r.hexagram_code AND e.revision=r.version AND e.action='PUBLISH')))
    FROM cms_hexagram_interpretation_revisions r JOIN cms_hexagram_interpretation_imports i ON i.hexagram_code=r.hexagram_code AND i.revision=r.version WHERE i.package_sha256="""+literal(digest)
    def audit(db):
        value=json.loads(query(db,audit_sql))
        assert value==dict(overviews=64,lines=384,published=64),value
        stored=json.loads(query(db,"SELECT json_object_agg(hexagram_code, content) FROM cms_hexagram_interpretation_revisions r WHERE EXISTS(SELECT 1 FROM cms_hexagram_interpretation_imports i WHERE i.hexagram_code=r.hexagram_code AND i.revision=r.version AND i.package_sha256="+literal(digest)+")"))
        assert stored==content, "Stored editorial text differs from source package"
        return value
    query(trial,statement(trial,catalog,content,digest,encoded));audit(trial)
    query(trial,statement(trial,catalog,content,digest,encoded));audit(trial)
    print("Rehearsal and repeated import PASS",flush=True)
    query(args.database,statement(args.database,catalog,content,digest,encoded))
    result=audit(args.database)
    result.update(database=args.database,packageSha256=digest,backup=str(backup),backupSha256=hashlib.sha256(backup.read_bytes()).hexdigest(),trial=trial,
                  approval=APPROVAL,actorPolicy="Two locked audit principals, importer and project-owner approval; no login credentials retained.",
                  originalMissing=[r["code"] for r in catalog if not content[r["code"]]["original"]])
    (out/"publication-evidence.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:result[k] for k in ("database","overviews","lines","published","originalMissing")}),flush=True)
if __name__=="__main__":main()
