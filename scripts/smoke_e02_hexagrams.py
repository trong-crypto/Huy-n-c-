"""Read-only HTTP acceptance checks for E02; fixtures are captured from real responses."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen
import uuid

from import_hexagram_glosses import load_review, note
from import_hexagram_names import load_names
from import_book_knowledge import TRIGRAMS

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8080')
    parser.add_argument('--write-fixtures', action='store_true')
    parser.add_argument('--no-db', action='store_true')
    args = parser.parse_args()
    calls = []

    def get(suffix='', query=None, status=200):
        url = args.url.rstrip('/') + '/api/v1/hexagrams' + suffix
        if query is not None:
            url += '?' + (query if isinstance(query, str) else urlencode(query))
        try:
            with urlopen(url, timeout=12) as response:
                http, data = response.status, json.load(response)
        except HTTPError as failure:
            http, data = failure.code, json.load(failure)
        assert http == status, (url, http, data)
        uuid.UUID(data['requestId'])
        assert data['status'] == ('COMPLETED' if http == 200 else 'FAILED'), data
        if http == 200:
            assert data['error'] is None
        else:
            assert data['data'] is None
            assert data['error']['ruleCode'] is None
        calls.append({'path':suffix,'query':query,'http':http})
        return data

    if args.no_db:
        for suffix in ('','/H_CAN_CAN'):
            assert get(suffix, status=503)['error']['code'] == 'DATABASE_UNAVAILABLE'
    else:
        expected = {r['hexagram_code']:r for r in load_review()}
        names = {r['code']:r for r in load_names()}
        trigrams = {code:[bool(x) for x in lines] for code,_,_,_,lines in TRIGRAMS}
        all_items = []
        for page in range(4):
            data = get(query={'page':page})['data']
            assert (data['page'], data['size'], data['totalElements'], data['totalPages']) == (page,20,64,4)
            all_items.extend(data['items'])
        codes = [x['code'] for x in all_items]
        assert codes == sorted(expected) and len(set(codes)) == 64
        for item in all_items:
            data = get('/'+item['code'])['data']
            row, name = expected[item['code']], names[item['code']]
            assert data['name'] == row['canonical_name']
            assert data['verificationStatus'] == 'VERIFIED' and data['nameKind'] == 'CANONICAL_TITLE'
            assert data['linesBottomUp'] == trigrams[name['lower']] + trigrams[name['upper']]
            assert data['sourceReferences'][0]['pdfPage'] == int(row['pdf_page'])
            gloss, = data['interpretations']
            assert gloss['category'] == gloss['resultCode'] == 'NAME_GLOSS'
            assert gloss['verificationStatus'] == 'VERIFIED' and gloss['content'] == row['gloss']
            assert gloss['sourceOrder'] == int(row['order']) and gloss['printedSourceLabel'] == row['printed_source_label']
            assert gloss['verificationNote'] == note(row)
            source, = gloss['sourceReferences']
            assert source['sourceId'] == 'MH' and source['pdfPage'] == int(row['pdf_page'])
            assert source['printedPage'] == row['printed_page'] and len(source['sha256']) == 64
        for name in ('Bĩ','Bí','Lý','Càn','Cấn','Ký tế','Vị tế'):
            found=get(query={'q':name})['data']['items']
            assert len(found) == 1 and found[0]['name'] == name
        for text, wanted in (('bi',{'Bĩ','Bí'}),('ly',{'Ly','Lý'}),('can',{'Càn','Cấn'})):
            found=get(query={'q':text})['data']['items']
            assert {r['name'] for r in found} == wanted
        assert get(query={'q':'h_kham_ton'})['data']['items'][0]['name'] == 'Tỉnh'
        for key in ('upperTrigramCode','lowerTrigramCode'):
            for trigram in trigrams:
                assert get(query={key:trigram})['data']['totalElements'] == 8
        assert get(query={'upperTrigramCode':'KHAM','lowerTrigramCode':'TON'})['data']['totalElements'] == 1
        assert get(query={'page':2147483647,'size':100})['data']['items'] == []
        assert get(query={'q':'nothing here'})['data']['totalPages'] == 0
        for query in ('page=-1','size=0','size=101','page=2147483648','page=1.5','size=',
                      'page=1&page=2','unknown=x','upperTrigramCode=BAD','lowerTrigramCode='):
            assert get(query=query, status=400)['error']['code'] == 'INVALID_INPUT'
        assert get(query={'q':'x'*101},status=400)['error']['code'] == 'INVALID_INPUT'
        for text in ("%' OR 1=1 --", '%'):
            assert get(query={'q':text})['data']['items'] == []
        missing=get('/H_UNKNOWN_CAN',status=404)
        assert missing['error']['code'] == 'NOT_FOUND'
        get('/bad',status=400)
        with ThreadPoolExecutor(max_workers=4) as pool:
            results=list(pool.map(lambda _:get('/H_KHAM_TON'),range(8)))
        assert len({r['requestId'] for r in results}) == 8
        if args.write_fixtures:
            samples={'hexagrams-list.response.json':get(query={'page':0,'size':2}),
                     'hexagram-tinh.response.json':get('/H_KHAM_TON'),
                     'hexagram-not-found.response.json':missing}
            for filename, body in samples.items():
                body['requestId']='550e8400-e29b-41d4-a716-446655440002'
                (ROOT/'docs/examples'/filename).write_text(json.dumps(body,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    output=ROOT/'scripts/generated'/('e02_no_db_http.json' if args.no_db else 'e02_http.json')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'url':args.url,'requests':len(calls),'passed':True,'calls':calls},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'E02 HTTP PASS: {len(calls)} requests; {output}')


if __name__ == '__main__':
    main()
