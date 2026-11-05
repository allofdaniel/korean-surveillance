"""CLI:  python -m aip_pipeline build --inbox DIR --airac 2026-11-25 --out OUTDIR [--app public/data/korea_airspace.json]

Groups every PDF/HTML in the inbox by airport (ICAO read from the documents), builds and validates each
airport, writes OUTDIR/<AIRAC>/<ICAO>.json + .geojson + report.md, and optionally merges into the app JSON.
"""
import argparse, glob, json, os, re, sys
from collections import defaultdict
import pymupdf as fitz
from .build import build_airport, geometry
from .export import to_geojson
from .docs import CHART_RE, TEXT_RE
from . import app_adapter

def detect_icao(path):
    try:
        if path.lower().endswith(('.html', '.htm')):
            t = open(path, encoding='utf-8', errors='replace').read(5000)
        else:
            d = fitz.open(path); t = ''.join(d[i].get_text() for i in range(min(2, len(d))))
    except Exception:
        return None
    m = CHART_RE.search(t) or TEXT_RE.search(t)
    if m:
        return m.group(1)
    m = re.search(r'\b(RK[A-Z]{2})\b', os.path.basename(path).upper())
    if m:
        return m.group(1)
    # image-only first page → OCR header
    from .docs import page_meta
    try:
        return page_meta(fitz.open(path)[0])['icao']
    except Exception:
        return None

def report_md(ds, airac):
    L = [f"# {ds['icao']} AIP 자동판독 리포트 (AIRAC {airac})", '',
         f"- 절차 {len(ds['procedures'])}개 / Fix {len(ds['fixes'])}개 / 홀딩 {len(ds['holdings'])}개 / 장애물 {len(ds['obstacles'])}개",
         f"- 지도 반영 {len([p for p in ds['procedures'] if p.get('qa') != 'reject'])}개 / 제외(검토 필요) {len([p for p in ds['procedures'] if p.get('qa') == 'reject'])}개",
         f"- 원본: {', '.join(s['file'] for s in ds['sources'])}", '', '## 검증 결과']
    if not ds['issues']:
        L.append('- 이상 없음 (모든 RNAV 구간 거리·방위가 게재값과 일치)')
    for i in ds['issues']:
        L.append(f"- [{i['level']}] {i['what']}")
    L += ['', '## 절차', '| 종류 | 이름 | 활주로 | 구간 | 근사 | 판정 |', '|---|---|---|---|---|---|']
    for p in ds['procedures']:
        L.append(f"| {p['type']} | {p['name']} {p.get('transition') or ''} | {p.get('runway') or ''} | {len(p['legs'])} | {'예' if p.get('approx') else ''} | {'제외: ' + ', '.join(p.get('qa_reasons', [])) if p.get('qa') == 'reject' else ''} |")
    return '\n'.join(L) + '\n'

def main(argv=None):
    ap = argparse.ArgumentParser(prog='aip_pipeline')
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build')
    b.add_argument('--inbox', required=True); b.add_argument('--airac', required=True); b.add_argument('--out', required=True)
    b.add_argument('--app'); b.add_argument('--enr-fixes', help='JSON {name:[lat,lon]} for en-route fixes')
    b.add_argument('--only', help='comma-separated ICAO filter')
    a = ap.parse_args(argv)
    files = sorted(f for f in glob.glob(os.path.join(a.inbox, '**', '*'), recursive=True) if f.lower().endswith(('.pdf', '.html', '.htm')))
    from . import parse_enr
    here = os.path.dirname(os.path.abspath(__file__))
    enr = json.load(open(os.path.join(here, 'enr_fixes.json')))   # verified baseline (ENR)
    if a.enr_fixes:
        enr.update(json.load(open(a.enr_fixes)))
    groups = defaultdict(list)
    for f in files:
        if f.lower().endswith('.pdf') and parse_enr.is_enr(f):
            enr.update(parse_enr.parse(f)); continue
        groups[detect_icao(f) or 'UNKNOWN'].append(f)
    outdir = os.path.join(a.out, a.airac); os.makedirs(outdir, exist_ok=True)
    app = json.load(open(a.app, encoding='utf-8')) if a.app else None
    summary = []
    for icao, fl in sorted(groups.items()):
        if icao == 'UNKNOWN' or (a.only and icao not in a.only.split(',')):
            summary.append(f"skip {icao}: {len(fl)} files"); continue
        ds, log = build_airport(icao, fl, enr)
        geometry(ds)
        json.dump(ds, open(os.path.join(outdir, f'{icao}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=list)
        json.dump(to_geojson(ds), open(os.path.join(outdir, f'{icao}.geojson'), 'w', encoding='utf-8'), ensure_ascii=False)
        open(os.path.join(outdir, f'{icao}_report.md'), 'w', encoding='utf-8').write(report_md(ds, a.airac))
        if app is not None and ds['procedures']:
            app_adapter.merge(app, ds, a.airac)
        n_err = len([i for i in ds['issues'] if i['level'] == 'error']); n_w = len([i for i in ds['issues'] if i['level'] == 'warn'])
        summary.append(f"{icao}: procs={len(ds['procedures'])} fixes={len(ds['fixes'])} obst={len(ds['obstacles'])} errors={n_err} warns={n_w} rejected={len([p for p in ds['procedures'] if p.get('qa') == 'reject'])}")
    if app is not None:
        json.dump(app, open(a.app, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(outdir, 'SUMMARY.txt'), 'w').write('\n'.join(summary) + '\n')
    print('\n'.join(summary))

if __name__ == '__main__':
    main()
