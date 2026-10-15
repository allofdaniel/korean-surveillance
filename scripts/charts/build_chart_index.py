#!/usr/bin/env python3
"""Rasterise Korean eAIP AD-2 charts and georeference them from their own graticule labels.

    python3 build_chart_index.py <cache_dir> <public_dir> [ICAO ...]

<cache_dir>  output of fetch_aip_charts.py (manifest.json + PDFs)
<public_dir> the app's public/ folder; writes charts/aip/<ICAO>/*.webp and charts/aip_index.json

Georeferencing: every vector chart prints its graticule as text ("126°50'E", "35°36'00\"N")
centred on the grid lines. Those label centres are ground-control points whose pixel position
comes straight from the PDF text layer — no OCR, no clicking. A 4-parameter similarity
(scale + rotation + offset, i.e. a conformal chart) is fitted with RANSAC so coordinate tables
on the same sheet (threshold/stand coordinates) are rejected as outliers. A sheet only gets a
map overlay when the fit is tight, the frame lies near its aerodrome and it is not marked
NOT TO SCALE; everything else is still listed for the chart viewer.
"""
import io, json, math, os, random, re, sys, time
import numpy as np
import pymupdf
from PIL import Image

VIEW_DPI = 170          # chart viewer raster (full sheet)
OVL_DPI = 200           # map overlay raster (graticule frame only)
WHITE = 236             # >= this on all channels becomes transparent in overlays
KM_LAT = 110.574
KM_LON_EQ = 111.320

TYPE_RULES = [
    (r'LIGHTING', 'ADC'), (r'^AD CHART|AERODROME CHART', 'ADC'), (r'PARKING|DOCKING', 'PDC'),
    (r'GROUND MOVEMENT', 'GMC'), (r'OBSTACLE CHART TYPE A', 'AOC-A'), (r'OBSTACLE CHART TYPE B', 'AOC-B'),
    (r'OBSTACLE CHART TYPE C', 'AOC-C'), (r'PRECISION APP', 'PATC'), (r'AREA CHART', 'AREA'),
    (r'\bSID\b|STANDARD DEPARTURE', 'SID'), (r'\bSTAR\b|STANDARD ARRIVAL|STANDARD TERMINAL ARRIVAL', 'STAR'),
    (r'SURVEILLANCE MINIMUM', 'ATCSMAC'), (r'INSTR(UMENT)? APCH|INSTRUMENT APPROACH', 'IAC'),
    (r'VISUAL APCH|VISUAL APPROACH', 'VAC'), (r'BIRD', 'BIRD'),
]
TYPE_KO = {'ADC': '비행장 차트', 'PDC': '주기장 차트', 'GMC': '지상이동 차트', 'AOC-A': '장애물 차트 A',
           'AOC-B': '장애물 차트 B', 'AOC-C': '장애물 차트 C', 'PATC': '정밀접근 지형도', 'AREA': '지역 차트',
           'SID': 'SID', 'STAR': 'STAR', 'ATCSMAC': '레이더 최저고도', 'IAC': '계기접근', 'VAC': '시계접근',
           'BIRD': '조류 서식', 'OTHER': '기타'}

LABEL = re.compile(r"^(\d{1,3})°(\d{1,2})'(?:(\d{1,2}(?:\.\d+)?)\")?([NSEW])$")
PROC = re.compile(r"\b((?:HI-)?(?:ILS|LOC|LDA|RNAV|RNP|VOR|NDB|DME|TACAN|GLS|SRA|PAR|ASR|GNSS|COPTER)"
                  r"[A-Za-z0-9()/ .\-]{0,40}?RWY\s*\d{2}[LRC]?(?:\s*/\s*\d{2}[LRC]?)*)")
CHART_NO = re.compile(r"\b([A-Z]{4})\s*AD\s*CHART\s*(2\s*-\s*\d+(?:\s*-\s*\d+)?)")


def chart_type(title):
    for pat, t in TYPE_RULES:
        if re.search(pat, title, re.I):
            return t
    return 'OTHER'


def norm_quotes(s):
    return (s.replace('´', "'").replace('’', "'").replace('′', "'").replace('‘', "'")
             .replace('˝', '"').replace('″', '"').replace('”', '"').replace('“', '"').replace("''", '"'))


def graticule_points(page):
    pts = []
    for x0, y0, x1, y1, t, *_ in page.get_text('words'):
        m = LABEL.match(norm_quotes(t.strip()))
        if not m:
            continue
        deg, mi, sec, hemi = int(m.group(1)), int(m.group(2)), m.group(3), m.group(4)
        if sec is not None and ('.' in sec or int(sec) % 10):
            continue  # table coordinates (thresholds, stands, ARP) — graticules are round values
        v = deg + mi / 60 + (int(sec) if sec else 0) / 3600
        if hemi in 'SW':
            v = -v
        kind = 'lat' if hemi in 'NS' else 'lon'
        if kind == 'lat' and not (30 <= v <= 40) or kind == 'lon' and not (122 <= v <= 134):
            continue
        pts.append(((x0 + x1) / 2, (y0 + y1) / 2, v, kind, y1 - y0))
    return list({(round(p[0], 1), round(p[1], 1), p[2], p[3]): p for p in pts}.values())  # (x, y, value, kind, h)


def fit_similarity(pts, lat0, lon0):
    """E = a x + b y + c ; N = b x - a y + d  (y down, north up when b≈0). Units: km per PDF point."""
    k = math.cos(math.radians(lat0)) * KM_LON_EQ
    rows, rhs = [], []
    for x, y, v, kind, *_ in pts:
        if kind == 'lon':
            rows.append([x, y, 1, 0]); rhs.append((v - lon0) * k)
        else:
            rows.append([-y, x, 0, 1]); rhs.append((v - lat0) * KM_LAT)
    A, B = np.array(rows, float), np.array(rhs, float)
    if np.linalg.matrix_rank(A) < 4:
        return None
    sol, *_ = np.linalg.lstsq(A, B, rcond=None)
    return sol, k


def residuals_km(model, pts, lat0, lon0):
    (a, b, c, d), k = model
    out = []
    for x, y, v, kind, *_ in pts:
        if kind == 'lon':
            out.append(abs(a * x + b * y + c - (v - lon0) * k))
        else:
            out.append(abs(b * x - a * y + d - (v - lat0) * KM_LAT))
    return np.array(out)


def ransac(pts, lat0, lon0, iters=400):
    lons = [p for p in pts if p[3] == 'lon']
    lats = [p for p in pts if p[3] == 'lat']
    if len({p[2] for p in lons}) < 2 or len({p[2] for p in lats}) < 2:
        return None
    rnd = random.Random(7)
    best = None
    for _ in range(iters):
        l1, l2 = rnd.sample(lons, 2)
        a1, a2 = rnd.sample(lats, 2)
        if l1[2] == l2[2] or a1[2] == a2[2]:
            continue
        m = fit_similarity([l1, l2, a1, a2], lat0, lon0)
        if not m:
            continue
        s = math.hypot(m[0][0], m[0][1])            # km per point
        if not (0.0004 <= s <= 2.5):
            continue
        tol = max(0.05, 4 * s)
        r = residuals_km(m, pts, lat0, lon0)
        inl = [p for p, e in zip(pts, r) if e < tol]
        score = (len(inl), -float(np.mean(r[r < tol])) if len(inl) else 0)
        if best is None or score > best[0]:
            best = (score, inl)
    if not best or best[0][0] < 5:
        return None
    inl = best[1]
    m = fit_similarity(inl, lat0, lon0)
    if not m:
        return None
    r = residuals_km(m, inl, lat0, lon0)
    return m, inl, float(np.sqrt(np.mean(r ** 2)) * 1000)


def to_lonlat(model, x, y, lat0, lon0):
    (a, b, c, d), k = model
    return [round(lon0 + (a * x + b * y + c) / k, 7), round(lat0 + (b * x - a * y + d) / KM_LAT, 7)]


def page_text_top(page, frac=0.25):
    H = page.rect.height
    lines = []
    for blk in page.get_text('dict')['blocks']:
        for ln in blk.get('lines', []):
            t = ' '.join(s['text'] for s in ln['spans']).strip()
            if t and ln['bbox'][1] < H * frac:
                lines.append(t)
    return lines


def name_page(page, item_title, ctype, idx, npages):
    top = page_text_top(page)
    joined = ' | '.join(top)
    no = CHART_NO.search(' '.join(page_text_top(page, 0.12)))
    chart_no = re.sub(r'\s+', '', no.group(2)) if no else ''
    procs = [m.group(1).strip() for line in top for m in [PROC.search(line)] if m]
    proc = max(procs, key=len) if procs else ''
    tab = 'DATA TABULATION' in joined.upper() or 'TABULATION' in joined.upper()
    if ctype in ('IAC', 'VAC') and proc:
        name = proc + (' · 데이터표' if tab else '')
    elif ctype in ('SID', 'STAR'):
        rw = sorted(set(re.findall(r'RWY\s*(\d{2}[LRC]?)', joined)))
        rnav = 'RNAV ' if re.search(r'RNAV|RNP', joined) else ''
        name = f"{rnav}{ctype}" + (f" RWY {'/'.join(rw)}" if rw else '') + (' · 데이터표' if tab else '')
    elif ctype == 'ADC' and re.search(r'LIGHTING', joined, re.I):
        name = 'LIGHTING AND MARKING CHART'
    else:
        name = item_title.upper()
    if npages > 1 and not proc and ctype not in ('SID', 'STAR'):
        name = f'{name} ({idx + 1})'
    return name, chart_no, tab


def transparent_overlay(pix):
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).convert('RGBA')
    a = np.array(img)
    white = (a[:, :, 0] >= WHITE) & (a[:, :, 1] >= WHITE) & (a[:, :, 2] >= WHITE)
    a[white, 3] = 0
    return Image.fromarray(a)


def save_webp(img, path, quality):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6)


def main():
    cache, public = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    man = json.load(open(os.path.join(cache, 'manifest.json')))
    arp = {}
    try:
        for a in json.load(open(os.path.join(public, 'data', 'korea_airspace.json')))['airports']:
            arp[a['icao']] = (a['lat'], a['lon'])
    except Exception:
        pass
    idx_path = os.path.join(public, 'charts', 'aip_index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) and only else {'airports': {}}
    index['airac'] = man['airac']
    index['generated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    stats = {'pages': 0, 'georef': 0}
    for icao, items in man['airports'].items():
        if only and icao not in only:
            continue
        lat0, lon0 = arp.get(icao, (36.5, 127.8))
        out_dir = os.path.join(public, 'charts', 'aip', icao)
        entries, used = [], set()
        for it in items:
            it = dict(it, title=re.sub(r'_\d{6,}|\[\d+\]', '', it['title']).strip(' _'))
            ctype = chart_type(it['title'])
            sec = it.get('section') or ''
            if not it.get('pdf'):
                entries.append({'id': f"{icao}-{sec or ctype}", 'type': ctype, 'name': it['title'].upper(),
                                'chartNo': sec.replace('2-', '2-', 1), 'pdf': it['url']})
                continue
            try:
                doc = pymupdf.open(os.path.join(cache, it['pdf']))
            except Exception as e:
                print('  ! open failed', it['pdf'], e)
                continue
            for pi, page in enumerate(doc):
                stats['pages'] += 1
                name, chart_no, tab = name_page(page, it['title'], ctype, pi, doc.page_count)
                cid = re.sub(r'[^A-Za-z0-9-]+', '-', f"{icao}-{sec or ctype}-p{pi + 1}").strip('-')
                while cid in used:
                    cid += 'x'
                used.add(cid)
                e = {'id': cid, 'type': ctype, 'name': name, 'chartNo': chart_no or sec, 'pdf': it['url'],
                     'page': pi + 1, 'file': f'/charts/aip/{icao}/{cid}.webp'}
                vpix = page.get_pixmap(dpi=VIEW_DPI, alpha=False)
                save_webp(Image.frombytes('RGB', (vpix.width, vpix.height), vpix.samples),
                          os.path.join(out_dir, f'{cid}.webp'), 72)
                # georeference
                if not tab and 'NOT TO SCALE' not in page.get_text().upper():
                    pts = graticule_points(page)
                    fit = ransac(pts, lat0, lon0) if len(pts) >= 5 else None
                    if fit:
                        model, inl, rms = fit
                        s_m = math.hypot(model[0][0], model[0][1]) * 1000   # metres per PDF point
                        xs = [p[0] for p in inl]; ys = [p[1] for p in inl]
                        W, H = page.rect.width, page.rect.height
                        mg = float(np.median([p[4] for p in inl]))   # labels sit just outside the neat line
                        x0, x1 = max(0, min(xs) + mg), min(W, max(xs) - mg)
                        y0, y1 = max(0, min(ys) + mg), min(H, max(ys) - mg)
                        cx, cy = to_lonlat(model, (x0 + x1) / 2, (y0 + y1) / 2, lat0, lon0)
                        dist = math.hypot((cx - lon0) * math.cos(math.radians(lat0)) * KM_LON_EQ, (cy - lat0) * KM_LAT)
                        big = (x1 - x0) * (y1 - y0) > 0.12 * W * H
                        rot = math.degrees(math.atan2(model[0][1], model[0][0]))
                        if rms <= max(80, 3 * s_m) and dist <= 160 and big and len(inl) >= 6 and abs(rot) < 2:
                            opix = page.get_pixmap(dpi=OVL_DPI, clip=pymupdf.Rect(x0, y0, x1, y1), alpha=False)
                            save_webp(transparent_overlay(opix), os.path.join(out_dir, f'{cid}.ov.webp'), 80)
                            e['overlay'] = {
                                'file': f'/charts/aip/{icao}/{cid}.ov.webp',
                                'bounds': [to_lonlat(model, x0, y0, lat0, lon0), to_lonlat(model, x1, y0, lat0, lon0),
                                           to_lonlat(model, x1, y1, lat0, lon0), to_lonlat(model, x0, y1, lat0, lon0)],
                                'rmsM': round(rms, 1), 'gcps': len(inl), 'mPerPt': round(s_m, 2),
                                'rotDeg': round(math.degrees(math.atan2(model[0][1], model[0][0])), 2),
                            }
                            stats['georef'] += 1
                entries.append(e)
        index['airports'][icao] = entries
        g = sum(1 for e in entries if e.get('overlay'))
        print(f'{icao}: {len(entries)} sheets, {g} georeferenced', flush=True)
    os.makedirs(os.path.dirname(idx_path), exist_ok=True)
    with open(idx_path, 'w') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    print('done', stats)


if __name__ == '__main__':
    main()
