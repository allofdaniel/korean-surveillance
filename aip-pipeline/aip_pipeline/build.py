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

def norm_proc_name(title: str):
    t = re.sub(r'\s+', ' ', title or '').strip()
    m = re.match(r'(RNP\s+RWY\s*\d{2}[LRC]?)\s*-\s*(.*)', t)
    if m:
        return m.group(1), m.group(2).strip()
    m = re.match(r'((?:RNAV\s+)?[A-Z]{5}\s+\d[A-Z])', t)
    if m:
        return m.group(1), None
    return t, None

def read_chart_pdf(path, log):
    """Yield page records with tables / text."""
    recs = []
    last_kind = None
    for i, page in docs.iter_pages(path):
        meta = docs.page_meta(page)
        k = chart_kind(meta['header'])
        tab = docs.is_tabulation(meta)
        if not tab and k:
            last_kind = k
        rw = re.findall(r'RWY\s*(\d{2}[LRC]?)', meta['header'] or '')
        rec = {'rwy': rw[0] if len(set(rw)) == 1 else None, 'file': os.path.basename(path), 'page': i + 1, **{x: meta[x] for x in ('icao', 'chart', 'date', 'amdt', 'effective')},
               'kind': (last_kind if tab else k) or last_kind, 'tabulation': tab, 'tables': [], 'text': None}
        if tab:
            tabs, _ = read_page_tables(page)
            for tb in tabs:
                c = pt.classify(tb)
                rec['tables'].append({'class': c, 'title': tb['title'], 'rows': tb['rows']})
        elif rec['kind'] == 'SID':
            rec['text'] = docs.ocr_page_text(page)
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
    for pg in pages:
        src = f"{pg['icao'] or icao} AD CHART {pg['chart']} ({pg['amdt'] or pg['date']})"
        for tb in pg['tables']:
            if tb['class'] == 'coding':
                legs = pt.coding_from_table(tb)
                name, trans = norm_proc_name(tb['title'])
                for L in legs:
                    if L['fix'] and L['latlon']: fix_obs[L['fix']].append((L['latlon'], src))
                ds['procedures'].append({'type': pg['kind'], 'name': name, 'transition': trans, 'source': src, 'runway': pg['rwy'],
                                         'coding': 'AIP coding table', 'legs': legs})
            elif tb['class'] == 'holding':
                for h in pt.holdings_from_table(tb):
                    h['source'] = src; ds['holdings'].append(h)
                    if h['fix'] and h['latlon']: fix_obs[h['fix']].append((h['latlon'], src))
            elif tb['class'] == 'fixpoint':
                title, fps = pt.fixpoints_from_table(tb)
                for fp in fps:
                    fix_obs[fp['name']].append((fp['latlon'], src))
                m = re.search(r'(.+?)\s+Approach to\s+(RWY\s*\d{2}[LRC]?)\s*(?:from\s+(\w+))?', title)
                pname = (re.sub(r'\s*/\s*', '/', m.group(1)) + ' ' + m.group(2)) if m else title
                seq = []
                for fp in fps:
                    if re.search(r'\b(DME|LOC|VOR/DME|VOR|GP|NDB)$', fp['name']):
                        continue
                    seq.append(fp)
                    if fp['name'].startswith('THR'):
                        break
                legs = [{'serial': f'{i+1:03d}', 'path': 'IF' if i == 0 else 'TF', 'fix': fp['name'], 'role': fp['role'],
                         'defn': fp['defn'], 'latlon': fp['latlon']} for i, fp in enumerate(seq)]
                ds['procedures'].append({'type': 'IAP', 'name': pname, 'transition': ('from ' + m.group(3)) if m and m.group(3) else None,
                                         'source': src, 'coding': 'AIP fix/point table (conventional)', 'legs': legs,
                                         'other_points': [fp for fp in fps if fp not in seq]})
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
        best, n = c.most_common(1)[0]
        pos = next(p for p, _ in obs if (round(p[0], 5), round(p[1], 5)) == best)
        ds['fixes'][name] = {'pos': pos, 'sources': sorted(set(s for _, s in obs))}
        for p, s in obs:
            d = inv(p, pos)[1] * 1852
            if d > 15:
                ds['issues'].append({'level': 'warn', 'what': f'fix {name} differs {d:.0f} m in {s}', 'fix': name})
    if enr_fixes:
        for k, v in enr_fixes.items():
            ds['fixes'].setdefault(k, {'pos': tuple(v), 'sources': ['ENR']})
    validate(ds)
    return ds, log

def validate(ds):
    F = ds['fixes']
    rw = {r['id']: r for r in ds['runways']}
    for pr in ds['procedures']:
        legs = pr['legs']
        for i, L in enumerate(legs):
            if not L.get('fix') or L.get('fix') not in F:
                if L.get('path') not in ('CA', 'VA', 'VI', 'VM', 'FA', 'VR', 'VD', None):
                    ds['issues'].append({'level': 'error', 'what': f"{pr['name']} {L.get('serial')}: fix '{L.get('fix')}' 좌표 없음"})
                continue
            if L.get('path') in ('TF',) and i > 0 and legs[i - 1].get('fix') in F and L.get('dist_nm') is not None:
                a, b = F[legs[i - 1]['fix']]['pos'], F[L['fix']]['pos']
                crs, d = inv(a, b)
                pub = L['dist_nm']
                if abs(d - pub) > max(0.15, pub * 0.015):
                    if abs(d - pub / 10) <= 0.15:   # OCR lost the decimal point (e.g., 77 -> 7.7)
                        ds['issues'].append({'level': 'fixed', 'what': f"{pr['name']} {L['serial']}: dist {pub} → {pub/10} (OCR 소수점 보정)"})
                        L['dist_nm'] = pub / 10
                    else:
                        ds['issues'].append({'level': 'warn', 'what': f"{pr['name']} {L['serial']} {legs[i-1]['fix']}→{L['fix']}: 게재 {pub} NM, 계산 {d:.2f} NM"})
                if L.get('course_true') is not None and angdiff(crs, L['course_true']) > 1.0:
                    ds['issues'].append({'level': 'warn', 'what': f"{pr['name']} {L['serial']}: 게재 진방위 {L['course_true']}°, 계산 {crs:.1f}°"})
            for a in L.get('alt_c') or []:
                if a[0] != 'FL' and a[1] > 25000:
                    ds['issues'].append({'level': 'warn', 'what': f"{pr['name']} {L.get('serial')}: 고도 '{L.get('alt')}' 판독 의심"})

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
