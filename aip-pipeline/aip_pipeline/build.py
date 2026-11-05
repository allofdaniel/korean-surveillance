"""Build a validated airport dataset from a set of AIP documents."""
from __future__ import annotations
import re, glob, os, json, hashlib, datetime
import pymupdf as fitz
from collections import defaultdict, Counter
from . import docs, parse_tables as pt, parse_ad2text, parse_obstacles, conventional
from .ocr_tables import read_page_tables
from .geo import inv, fwd, angdiff

KIND_WORDS = [('DEPARTURE', 'SID'), ('ARRIVAL', 'STAR'), ('APPROACH CHART', 'IAP'), ('INSTRUMENT APPROACH', 'IAP'),
              ('AERODROME OBSTACLE', 'OBST'), ('SURVEILLANCE MINIMUM', 'SMAC'), ('VISUAL APPROACH', 'VAC'),
              ('AERODROME CHART', 'ADC'), ('PARKING', 'PDC'), ('BIRD', 'BIRD')]

def chart_kind(text: str):
    u = (text or '').upper()
    for w, k in KIND_WORDS:
        if w in u:
            return k
    return None

def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()[:16]

RWY_OK = re.compile(r'^\d{2}[LRC]?$')

def clean_title(title: str, rwy: str | None = None) -> str:
    t = re.sub(r'\s+', ' ', (title or '').replace('|', '')).strip()
    t = t.replace('RNAV(GNSS)', 'RNAV').replace('RNAV (GNSS)', 'RNAV')
    t = t.replace('!', 'I')
    if 'Feeder Route' in t:
        t = t[t.index('Feeder Route'):]
    else:
        m = re.search(r'\b(RNAV|RNP|ILS|LOC|VOR|NDB|TACAN)\b', t)
        if m:
            t = t[m.start():]          # drop OCR noise / table captions in front of the procedure name
    t = re.sub(r'\b([A-Z]{3,5}) [Il|]([A-Z])\b', r'\1 1\2', t)      # OCR: DOTOL IN -> DOTOL 1N
    t = re.sub(r'\b([A-Z]{3,5}) O([A-Z])\b', r'\1 0\2', t)
    def _rw(m):
        tok = m.group(1)
        if RWY_OK.match(tok):
            return 'RWY ' + tok
        if rwy:
            return 'RWY ' + rwy
        tok = tok.translate(str.maketrans('OIlASB', '011458'))
        return 'RWY ' + tok
    t = re.sub(r'RWY\s*([0-9OIlASB]{1,3}[LRC]?)(?![A-Za-z0-9])', _rw, t)
    return t.strip(' -')

def norm_proc_name(title: str, rwy: str | None = None):
    """-> (name, transition, kind_hint). kind_hint: 'transition-only' | 'feeder' | 'missed' | 'holding' | None"""
    t = clean_title(title, rwy)
    if re.match(r'HOLDING', t, re.I):
        return None, None, 'holding'
    if re.match(r'MISSED', t, re.I) or not t:
        return None, None, 'missed'
    m = re.match(r'Feeder Route\s*-?\s*(.*)', t)
    if m:
        return None, m.group(1).strip(), 'feeder'
    m = re.match(r'(RNP(?:\s+[A-Z])?\s+RWY\s*\d{2}[LRC]?(?:\s*\(AR\))?)\s*-?\s*(.*)', t)
    if m:
        return m.group(1), (m.group(2).strip() or None), None
    m = re.match(r'^([A-Z]{5})\s+Transition$', t)
    if m:
        return None, m.group(1), 'transition-only'
    m = re.match(r'((?:RNAV\s+)?[A-Z]{3,5}\s+\d[A-Z]?)\b\s*(?:-\s*(?:([A-Z]{5})\s+Transition|RWY\s*(\d{2}[LRC]?)))?', t)
    if m:
        return m.group(1), m.group(2), None
    return t, None, None

def clean_fix(f):
    if not f:
        return f
    f = re.sub(r'[|()\[\]]', '', f).strip()
    m = re.match(r'^([A-Z]{2})([0-9O]{3})$', f)
    if m and re.search(r'\d', m.group(2)):          # TDO40 -> TD040
        f = m.group(1) + m.group(2).replace('O', '0')
    m = re.match(r'^RW(\d{2})[0O]$', f) or re.match(r'^RWY\s*(\d{2}[LRC]?)$', f)
    if m:
        f = 'RW' + m.group(1)
    return f

CACHE_V = 3
CACHE_DIR = os.environ.get('AIP_CACHE', os.path.expanduser('~/.cache/aip_pipeline'))

def _raw_pages(path):
    """OCR/table extraction per page — the slow part. Cached by file hash so parser fixes re-run in seconds."""
    key = os.path.join(CACHE_DIR, sha(path) + '.json')
    if os.path.exists(key):
        try:
            c = json.load(open(key, encoding='utf-8'))
            pages = c['pages'] if isinstance(c, dict) else c
            v = c.get('v', 1) if isinstance(c, dict) else 1
            if v == CACHE_V:
                return pages
            doc = fitz.open(path)
            if v == 1 and any(pg.rotation and len(pg.get_text()) > 200 for pg in doc):
                raise ValueError('v1 cache invalid for rotated text pages')
            # older cache: OCR'd (image) pages stay valid; text pages are cheap to re-extract
            for r in pages:
                pg = doc[r['i']]
                if r['tab'] and len(pg.get_text('text').strip()) > 200:
                    tabs, _ = read_page_tables(pg)
                    r['tables'] = [{'title': tb['title'], 'rows': tb['rows']} for tb in tabs]
            json.dump({'v': CACHE_V, 'pages': pages}, open(key, 'w', encoding='utf-8'), ensure_ascii=False)
            return pages
        except Exception:
            pass
    out = []
    last_kind = None
    for i, page in docs.iter_pages(path):
        meta = docs.page_meta(page)
        k = chart_kind(meta['header'])
        tab = docs.is_tabulation(meta)
        if not tab and k:
            last_kind = k
        r = {'i': i, 'meta': meta, 'tab': tab, 'tables': [], 'text': None}
        if tab:
            tabs, _ = read_page_tables(page)
            r['tables'] = [{'title': tb['title'], 'rows': tb['rows']} for tb in tabs]
        elif (k or last_kind) == 'SID':
            r['text'] = docs.ocr_page_text(page)
        out.append(r)
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        json.dump({'v': CACHE_V, 'pages': out}, open(key, 'w', encoding='utf-8'), ensure_ascii=False)
    except Exception:
        pass
    return out

def read_chart_pdf(path, log):
    """Page records with classified tables / text."""
    recs = []
    last_kind = None
    for r in _raw_pages(path):
        meta, tab, i = r['meta'], r['tab'], r['i']
        k = chart_kind(meta['header'])
        if not tab and k:
            last_kind = k
        rw = re.findall(r'RWY\s*(\d{2}[LRC]?)', meta['header'] or '')
        rec = {'rwy': rw[0] if len(set(rw)) == 1 else None, 'file': os.path.basename(path), 'page': i + 1, **{x: meta[x] for x in ('icao', 'chart', 'date', 'amdt', 'effective')},
               'kind': (last_kind if tab else k) or last_kind, 'tabulation': tab, 'tables': [], 'text': None, 'header': meta['header']}
        for tb in r['tables']:
            rec['tables'].append({'class': pt.classify(tb), 'title': tb['title'], 'rows': tb['rows']})
        if not tab and rec['kind'] == 'SID':
            rec['text'] = r['text']
        log.append(f"{rec['file']} p{rec['page']}: chart={rec['chart']} kind={rec['kind']} tab={tab} tables={[t['class'] for t in rec['tables']]}")
        recs.append(rec)
    return recs

def build_airport(icao: str, files: list[str], enr_fixes: dict | None = None, log=None):
    log = log if log is not None else []
    ds = {'icao': icao, 'built_at': datetime.datetime.utcnow().isoformat() + 'Z', 'sources': [], 'airport': {}, 'runways': [],
          'navaids': [], 'fixes': {}, 'procedures': [], 'holdings': [], 'obstacles': [], 'issues': []}
    fix_obs = defaultdict(list)   # name -> [(latlon, source)]
    pages = []
    for f in files:
        ds['sources'].append({'file': os.path.basename(f), 'sha': sha(f)})
        if f.lower().endswith(('.html', '.htm')) or docs.classify_pdf(f) == 'AD2_TEXT':
            a = parse_ad2text.parse(f)
            ds['airport'] = {'icao': a['icao'], 'arp': a['arp'], 'elev_m': a['elev_m'], 'magvar': a.get('magvar'), 'ctr': a['ctr'], 'text_amdt': a['amdt']}
            ds['runways'] = a['runways']
            ds['navaids'] = a['navaids']
            for r in a['runways']:
                if r['thr']: fix_obs[f"RW{r['id']}"].append((r['thr'], 'AD2.12'))
            for n in a['navaids']:
                if n['ident'] and n['latlon']: fix_obs[n['ident']].append((n['latlon'], 'AD2.19'))
            continue
        p0 = fitz.open(f)[0]
        hdr = docs.page_meta(p0)
        if chart_kind(hdr['header']) == 'OBST' or 'OBSTACLE CHART' in (p0.get_text() or '').upper():
            ds['obstacles'] += parse_obstacles.parse(f)
            continue
        pages += read_chart_pdf(f, log)
    # ---- collect tables
    last_base, last_proc = {}, {}
    for pg in pages:
        src = f"{pg['icao'] or icao} AD CHART {pg['chart']} ({pg['amdt'] or pg['date']})"
        for tb in pg['tables']:
            if tb['class'] == 'coding':
                legs = pt.coding_from_table(tb)
                for L in legs:
                    L['fix'] = clean_fix(L['fix'])
                name, trans, hint = norm_proc_name(tb['title'], pg['rwy'])
                pkey = (pg['file'], pg['kind'])
                if hint == 'holding':
                    for L in legs:
                        if L['fix']:
                            ds['holdings'].append({'ident': None, 'path': L['path'], 'fix': L['fix'], 'course': L['course'],
                                                   'course_mag': L['course_mag'], 'course_true': L['course_true'],
                                                   'time_min': None, 'dist_nm': L['dist_nm'], 'turn': L['turn'], 'alt': L['alt'],
                                                   'alt_c': L['alt_c'], 'speed': L['speed'], 'latlon': None, 'source': src})
                    continue
                for L in legs:
                    if L['fix'] and L['latlon']: fix_obs[L['fix']].append((L['latlon'], src))
                if hint == 'missed':
                    prev = last_proc.get(pkey)
                    if prev is not None:
                        for L in legs:
                            L['missed'] = True
                        prev['legs'] += [L for L in legs if L['path'] != 'IF']
                    continue
                if hint == 'feeder':
                    name = f"RNP RWY {pg['rwy']}" if pg['rwy'] else (last_base.get(pkey) or 'RNP')
                elif hint == 'transition-only':
                    name = last_base.get(pkey) or trans
                else:
                    last_base[pkey] = name
                kind = pg['kind']
                if not kind:
                    p0 = legs[0]['path'] if legs else ''
                    kind = 'IAP' if 'RWY' in (name or '') else ('SID' if p0 in ('CF', 'CA', 'VA', 'VI', 'DF', 'FA') else 'STAR')
                pr = {'type': kind, 'name': name, 'transition': trans, 'source': src, 'runway': pg['rwy'],
                      'coding': 'AIP coding table', 'legs': legs}
                ds['procedures'].append(pr)
                last_proc[pkey] = pr
            elif tb['class'] == 'holding':
                for h in pt.holdings_from_table(tb):
                    h['source'] = src; ds['holdings'].append(h)
                    if h['fix'] and h['latlon']: fix_obs[h['fix']].append((h['latlon'], src))
            elif tb['class'] == 'fixpoint':
                title, fps = pt.fixpoints_from_table(tb)
                fps = [fp for fp in fps if fp['name'] not in ('BRG', 'DME', 'RWY', 'ELEV', 'DIST', 'ALT', 'MAG', 'VOR', 'LOC', 'GP')]
                m = re.search(r'(.+?)\s+approach to\s+(RWY\s*\d{2}[LRC]?)\s*(?:from\s+(\w+))?', title, re.I)
                for fp in fps:
                    if fp['name'] == 'THR' and m:
                        fp['name'] = 'THR ' + re.sub(r'RWY\s*', 'RWY ', m.group(2))
                    fix_obs[fp['name']].append((fp['latlon'], src))
                pname = (re.sub(r'\s*/\s*', '/', m.group(1)) + ' ' + re.sub(r'RWY\s*', 'RWY ', m.group(2))) if m else title
                pname = re.sub(r'^(TACAN|VOR)\s+or\s+VOR/DME', 'VOR/DME', pname)
                seq = []
                for fp in fps:
                    if re.search(r'\b(DME|LOC|VOR/DME|VOR|GP|NDB|TACAN|VORTAC)$', fp['name']):
                        continue
                    seq.append(fp)
                    if fp['name'].startswith('THR'):
                        break
                mk = lambda pts: [{'serial': f'{i+1:03d}', 'path': 'IF' if i == 0 else 'TF', 'fix': fp['name'], 'role': fp['role'],
                                   'defn': fp['defn'], 'latlon': fp['latlon']} for i, fp in enumerate(pts)]
                base = {'type': 'IAP', 'name': pname, 'source': src, 'runway': pg['rwy'] or (re.sub(r'RWY\s*', '', m.group(2)) if m else None),
                        'coding': 'AIP fix/point table (conventional)', 'other_points': [fp for fp in fps if fp not in seq]}
                iafs = [k for k, fp in enumerate(seq) if 'IAF' in (fp['role'] or '')]
                ifk = next((k for k, fp in enumerate(seq) if re.search(r'\bIF\b', fp['role'] or '') and 'IAF' not in (fp['role'] or '')), None)
                if len(iafs) > 1 and ifk is not None and ifk > max(iafs):
                    # several initial approach fixes listed one after another: one segment per IAF (IAF … → IF), plus IF → THR
                    ds['procedures'].append({**base, 'transition': None, 'legs': mk(seq[ifk:])})
                    for n, k in enumerate(iafs):
                        end = iafs[n + 1] if n + 1 < len(iafs) else ifk
                        ds['procedures'].append({**base, 'transition': 'from ' + seq[k]['name'], 'legs': mk(seq[k:end] + [seq[ifk]])})
                else:
                    ds['procedures'].append({**base, 'transition': ('from ' + m.group(3)) if m and m.group(3) else None, 'legs': mk(seq)})
        if pg['text'] and pg['kind'] == 'SID':
            for nm, d in conventional.split_departures(pg['text']).items():
                ds['procedures'].append({'type': 'SID', 'name': nm, 'transition': None, 'source': f"{icao} AD CHART {pg['chart']} text", 'runway': pg['rwy'],
                                         'coding': 'conventional (constructed from description)', 'description': d['text'],
                                         'restrictions': d['restrictions'], 'legs': []})
    # drop description-only entries of RNAV procedures (RNAV charts also carry text descriptions)
    coded = {p['name'] for p in ds['procedures'] if p['legs']}
    ds['procedures'] = [p for p in ds['procedures'] if p['legs'] or f"RNAV {p['name']}" not in coded]
    # ---- resolve fixes (majority by rounded position)
    for name, obs in fix_obs.items():
        c = Counter((round(p[0], 5), round(p[1], 5)) for p, _ in obs)
        chart_pref = Counter((round(p[0], 5), round(p[1], 5)) for p, s_ in obs if not s_.startswith('AD2'))
        ref = tuple(enr_fixes[name]) if enr_fixes and name in enr_fixes else None
        near_enr = (lambda k: -inv(k, ref)[1]) if ref else (lambda k: 0)
        best = max(c, key=lambda k: (c[k], chart_pref.get(k, 0), near_enr(k)))
        pos = next(p for p, _ in obs if (round(p[0], 5), round(p[1], 5)) == best)
        ds['fixes'][name] = {'pos': pos, 'sources': sorted(set(s for _, s in obs))}
        for p, s in obs:
            d = inv(p, pos)[1] * 1852
            if d > 15:
                ds['issues'].append({'level': 'warn', 'what': f'fix {name} differs {d:.0f} m in {s}', 'fix': name})
    if enr_fixes:
        used = {L.get('fix') for pr in ds['procedures'] for L in pr['legs']} | {h.get('fix') for h in ds['holdings']}
        for k in used:
            if k and k not in ds['fixes'] and k in enr_fixes:
                ds['fixes'][k] = {'pos': tuple(enr_fixes[k]), 'sources': ['ENR']}
    # fixes still unknown: derive from previous fix + published true course + distance (TF/CF legs)
    for pr in ds['procedures']:
        legs = pr['legs']
        for i, L in enumerate(legs):
            f = L.get('fix')
            if not f or f in ds['fixes'] or i == 0 or L.get('path') not in ('TF', 'CF'):
                continue
            pf = legs[i - 1].get('fix')
            if pf in ds['fixes'] and L.get('course_true') is not None and L.get('dist_nm'):
                pos = fwd(tuple(ds['fixes'][pf]['pos']), L['course_true'], L['dist_nm'])
                ds['fixes'][f] = {'pos': pos, 'sources': [f"computed from {pf} {L['course_true']}° {L['dist_nm']} NM"]}
                ds['issues'].append({'level': 'warn', 'what': f"fix {f} 좌표 판독 실패 → {pf}에서 진방위/거리로 계산 ({pr['name']})", 'fix': f})
    for h in ds['holdings']:
        if not h.get('latlon') and h.get('fix') in ds['fixes']:
            h['latlon'] = tuple(ds['fixes'][h['fix']]['pos'])
    validate(ds)
    return ds, log

def _label(pr):
    return f"{pr['name']}" + (f" [{pr['transition']}]" if pr.get('transition') else '')

def validate(ds):
    """Check every leg against published distance/true course. Procedures with gross problems get qa='reject'
    (kept in the dataset/report, but not exported to the app)."""
    F = ds['fixes']
    for pr in ds['procedures']:
        legs = pr['legs']
        bad = []
        lab = _label(pr)
        for i, L in enumerate(legs):
            if not L.get('fix') or L.get('fix') not in F:
                if L.get('path') not in ('CA', 'VA', 'VI', 'VM', 'FA', 'VR', 'VD', None):
                    ds['issues'].append({'level': 'error', 'proc': lab, 'what': f"{lab} {L.get('serial')}: fix '{L.get('fix')}' 좌표 없음"})
                    bad.append(f"fix {L.get('fix')} 좌표 없음")
                continue
            if L.get('path') in ('TF',) and i > 0 and legs[i - 1].get('fix') in F and L.get('dist_nm') is not None:
                a, b = F[legs[i - 1]['fix']]['pos'], F[L['fix']]['pos']
                crs, d = inv(a, b)
                pub = L['dist_nm']
                if abs(d - pub) > max(0.15, pub * 0.015):
                    if abs(d - pub / 10) <= 0.15:   # OCR lost the decimal point (e.g., 77 -> 7.7)
                        ds['issues'].append({'level': 'fixed', 'proc': lab, 'what': f"{lab} {L['serial']}: dist {pub} → {pub/10} (OCR 소수점 보정)"})
                        L['dist_nm'] = pub / 10
                    else:
                        ds['issues'].append({'level': 'warn', 'proc': lab, 'what': f"{lab} {L['serial']} {legs[i-1]['fix']}→{L['fix']}: 게재 {pub} NM, 계산 {d:.2f} NM"})
                        if abs(d - pub) > max(1.0, pub * 0.2) and abs(d - pub / 10) > 1.0 and pub < 100:
                            bad.append(f"{legs[i-1]['fix']}→{L['fix']} 거리 불일치")
                if L.get('course_true') is not None and angdiff(crs, L['course_true']) > 1.0:
                    ds['issues'].append({'level': 'warn', 'proc': lab, 'what': f"{lab} {L['serial']}: 게재 진방위 {L['course_true']}°, 계산 {crs:.1f}°"})
                    if angdiff(crs, L['course_true']) > 10 and d > 0.5:
                        bad.append(f"{legs[i-1]['fix']}→{L['fix']} 방위 불일치")
            for a in L.get('alt_c') or []:
                if a[0] != 'FL' and a[1] > 25000:
                    ds['issues'].append({'level': 'warn', 'proc': lab, 'what': f"{lab} {L.get('serial')}: 고도 '{L.get('alt')}' 판독 의심"})
        pr['qa'] = 'reject' if bad else 'ok'
        if bad:
            pr['qa_reasons'] = sorted(set(bad))

def geometry(ds, climb_ft_per_nm=318.0):
    """Attach 'coords' (list of (lat,lon)) and 'approx' to each procedure."""
    F = {k: v['pos'] for k, v in ds['fixes'].items()}
    rws = {r['id']: r for r in ds['runways']}
    var = (ds['airport'].get('magvar') or {}).get('deg', 0.0)
    navs = {n['ident']: tuple(n['latlon']) for n in ds['navaids'] if n.get('ident') and n.get('latlon')}
    for pr in ds['procedures']:
        m = re.search(r'RWY\s*(\d{2}[LRC]?)', (pr['name'] or '') + ' ' + (pr.get('source') or ''))
        rid = pr.get('runway') or (m.group(1) if m else None)
        if not rid and pr['type'] == 'SID':
            rid = guess_runway(pr, rws, F)
        pr['runway'] = rid
        pts, approx = [], False
        if pr['type'] == 'SID' and rid in rws:
            other = [r for r in rws.values() if r['id'] != rid]
            der = tuple(other[0]['thr']) if other else tuple(rws[rid]['thr'])
            if pr['coding'].startswith('conventional') and pr.get('description'):
                pts, approx, steps = conventional.build(pr['description'], der, rws[rid]['true_brg'], navs, F, var)
                pr['construction'] = steps
                pr['coords'] = pts; pr['approx'] = True; continue
            pts = [der]
        for L in pr['legs']:
            f = L.get('fix')
            if f in F:
                pts.append(tuple(F[f]))
            elif L.get('path') == 'CA' and pts and rid in rws:
                alt = next((a[1] for a in (L.get('alt_c') or []) if a[0] != 'FL'), 3000)
                nm = max(1.0, alt / climb_ft_per_nm * 0.5)
                pts.append(fwd(pts[-1], rws[rid]['true_brg'], nm)); approx = True
        pr['coords'] = pts; pr['approx'] = approx
    return ds

def guess_runway(pr, rws, F):
    if not pr['legs'] or not rws:
        return None
    L = pr['legs'][0]
    if L.get('course_true') is not None:
        return min(rws.values(), key=lambda r: angdiff(r['true_brg'], L['course_true']))['id']
    return None
