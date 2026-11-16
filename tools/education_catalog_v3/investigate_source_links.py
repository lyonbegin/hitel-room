#!/usr/bin/env python3
"""Source-first bibliographic research for HITEL's 1208 unresolved document IDs.

Never guesses an exact Scribd-to-book match. It records source accessibility,
external bibliographic candidates, their identifiers, and provenance. Existing
records are immutable. No logins, credentials, cookies, or CAPTCHA workarounds.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import difflib
import html
import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'tools' / 'education_catalog_v3'
INPUT_IDS = CATALOG / 'investigation-1208-ids.txt'
USER_AGENT = 'HITEL-education-metadata-audit/1.0 (+source-URL-only; no browser bypass)'
REQUEST_TIMEOUT = 12


def request_text(url: str, limit: int = 60000) -> tuple[int, str, str]:
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json,text/html;q=0.8,*/*;q=0.5'})
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
            return response.status, response.read(limit).decode('utf-8', 'replace'), response.geturl()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(3000).decode('utf-8','replace'), url
    except Exception as exc:
        return 0, type(exc).__name__ + ': ' + str(exc)[:200], url


def load_catalog():
    manifest = json.loads((CATALOG / 'manifest.json').read_text(encoding='utf8'))
    fields = manifest['schema']['materials']
    docs = {}
    for part in manifest['files']:
        if part['type'] != 'materials':
            continue
        raw = json.loads((CATALOG / part['file']).read_text(encoding='utf8'))
        for row in raw['rows']:
            obj = dict(zip(fields, row))
            docs[str(obj['id'])] = obj
    return docs


def title_for_query(title: str) -> str:
    text = html.unescape(str(title))
    text = re.sub(r'\b(?:pdf|hwp|docx|indd|word test|output)\b', ' ', text, flags=re.I)
    text = re.sub(r'\b20\d{6}\b|\b\d{9,13}\b|[\[\]{}_~★@()+]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:110]


def simplify(v: str) -> str:
    return re.sub('[^가-힣a-z0-9]+','',str(v).lower())


def compare(a: str,b: str) -> float:
    a=simplify(a); b=simplify(b)
    return round(difflib.SequenceMatcher(None, a,b).ratio(), 3) if a and b else 0.0


def inspect_one(source: dict) -> dict:
    docid = str(source['id'])
    title = str(source.get('title') or '')
    url = source.get('reference_url') or f'https://www.scribd.com/document/{docid}'
    result = {
       'document_id': docid,
       'original_title': title,
       'source_url': url,
       'source_page_status':'not_attempted',
       'source_http_code':None,
       'publisher_search_status':'not_attempted',
       'external_candidates':[],
       'same_original_book_verified':False,
       'decision':'external_bibliography_only_not_original_verified',
       'checked_at':datetime.now(timezone.utc).isoformat(timespec='seconds')
    }
    status, body, _ = request_text(url, limit=12000)
    result['source_http_code']=status
    lower=body.lower()
    if status in (403,429) or any(needle in lower for needle in ('client challenge','captcha','_fs-ch-','verify you are human','access denied')):
        result['source_page_status']='access_challenge'
    elif status==200 and '<html' in lower:
        mt=re.search(r'<title[^>]*>(.*?)</title>',body, re.I|re.S)
        observed=html.unescape(re.sub('<[^>]*>','',mt.group(1))).strip() if mt else ''
        result['source_page_status']='public_html_observed'
        result['observed_page_title']=observed[:300]
    elif status:
        result['source_page_status']='http_'+str(status)
    else:
        result['source_page_status']='network_unavailable'
        result['source_access_error']=body[:180]

    # Safe bibliographic candidate search, not assertion of identical PDF.
    query=title_for_query(title)
    if len(simplify(query)) < 5:
        result['publisher_search_status']='insufficient_query'
        return result
    query_url='https://www.googleapis.com/books/v1/volumes?'+urllib.parse.urlencode({'q':query, 'maxResults':5, 'printType':'books'})
    code, data, _ = request_text(query_url,limit=100000)
    if code!=200:
        result['publisher_search_status']='google_books_http_'+str(code)
        return result
    try:
        parsed=json.loads(data)
    except (json.JSONDecodeError,UnicodeDecodeError):
        result['publisher_search_status']='invalid_json'
        return result
    result['publisher_search_status']='candidate_lookup_completed'
    for c in (parsed.get('items') or [])[:5]:
        info=c.get('volumeInfo') or {}
        name=info.get('title') or ''
        similarity=compare(query,name)
        # Never imply a source-document match. Only retain high-likelihood
        # bibliographic candidates, even then subject/edition may conflict.
        if similarity<0.58:
            continue
        result['external_candidates'].append({
           'title':name, 'publisher':info.get('publisher') or '',
           'publishedDate':info.get('publishedDate') or '',
           'identifiers':info.get('industryIdentifiers') or [],
           'reference_url':info.get('infoLink') or '',
           'similarity_score_not_probability':similarity,
           'evidence':'Google Books public bibliographic listing, not original-document proof'
        })
    result['external_candidates'].sort(key=lambda x:x['similarity_score_not_probability'],reverse=True)
    result['decision']='bibliographic_candidates_only' if result['external_candidates'] else 'no_sufficient_bibliographic_candidate'
    return result


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--shard',type=int,required=True)
    p.add_argument('--total-shards',type=int,default=12)
    p.add_argument('--workers',type=int,default=2)
    p.add_argument('--output',default='investigation-results')
    args=p.parse_args()
    assert 0<=args.shard<args.total_shards
    all_ids=[line.strip() for line in INPUT_IDS.read_text(encoding='utf8').splitlines() if line.strip()]
    assert len(all_ids)==1208 and len(set(all_ids))==1208
    catalog=load_catalog()
    assert set(all_ids).issubset(set(catalog)), (len(all_ids),len(catalog))
    subset=[catalog[k] for i,k in enumerate(all_ids) if i%args.total_shards==args.shard]
    folder=pathlib.Path(args.output)
    folder.mkdir(parents=True,exist_ok=True)
    output=folder / f'shard-{args.shard:02d}.jsonl'
    counts={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(2,args.workers))) as pool, output.open('w',encoding='utf8') as f:
        for i,result in enumerate(pool.map(inspect_one,subset),start=1):
            f.write(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
            f.flush()
            key=result['source_page_status']
            counts[key]=counts.get(key,0)+1
            if i%20==0 or i==len(subset):
                print(f'PROGRESS shard={args.shard} completed={i}/{len(subset)} source_status={counts}',flush=True)
    summary={'shard':args.shard,'total':len(subset),'source_page_status':counts,'candidate_search_is_not_original_verification':True}
    (folder/f'shard-{args.shard:02d}-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
    print('HITEL_INVESTIGATION_SHARD_DONE '+json.dumps(summary,ensure_ascii=False),flush=True)

if __name__=='__main__':
    main()