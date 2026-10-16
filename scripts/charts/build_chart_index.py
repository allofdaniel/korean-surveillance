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
    return parse_labels(page.get_text('words'))


def parse_labels(words):
    pts = []
    for x0, y0, x1, y1, t, *_ in words:
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


def ocr_graticule_points(page, dpi=400):
    """Graticule labels drawn as outlines (no text layer): OCR the sheet sparsely with tesseract."""
    import csv, subprocess, tempfile
    tmp = os.path.join(tempfile.mkdtemp(), 'g.png')
    page.get_pixmap(dpi=dpi).save(tmp)
    out = subprocess.run(['tesseract', tmp, '-', '--psm', '11', '-c', 'tessedit_create_tsv=1'],
                         capture_output=True, text=True).stdout
    k = 72 / dpi
    words = []
    for r in csv.DictReader(io.StringIO(out), delimiter='\t', quoting=csv.QUOTE_NONE):
        t = (r.get('text') or '').strip().replace('˚', '°').replace('º', '°')
        if t:
            x, y, w, h = (float(r[c]) * k for c in ('left', 'top', 'width', 'height'))
            words.append((x, y, x + w, y + h, t))
    return parse_labels(words)


R_EARTH = 6378.137  # km, WGS84 / Web Mercator sphere


def _merc(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def to_local(lat, lon, lat0, lon0):
    """Web-Mercator coordinates scaled to km at lat0. A similarity fitted in this frame maps straight
    onto Mapbox's image-source corners (which interpolate linearly in Web Mercator)."""
    k = R_EARTH * math.cos(math.radians(lat0))
    E = None if lon is None else math.radians(lon - lon0) * k
    N = None if lat is None else (_merc(lat) - _merc(lat0)) * k
    return E, N


def from_local(E, N, lat0, lon0):
    k = R_EARTH * math.cos(math.radians(lat0))
    lon = lon0 + math.degrees(E / k)
    lat = math.degrees(2 * math.atan(math.exp(_merc(lat0) + N / k)) - math.pi / 2)
    return lat, lon


def gcp_rows(pts, lat0, lon0):
    rows, rhs = [], []
    for x, y, v, kind, *_ in pts:
        if kind == 'lon':
            rows.append([x, y, 1, 0]); rhs.append(to_local(None, v, lat0, lon0)[0])
        else:
            rows.append([-y, x, 0, 1]); rhs.append(to_local(v, None, lat0, lon0)[1])
    return rows, rhs


def fit_similarity(pts, lat0, lon0, extra=None):
    """E = a x + b y + c ; N = b x - a y + d  (y down, north up when b≈0). Units: km per PDF point.
    `extra` = (rows, rhs, weight) appended to the graticule equations (runway centreline constraints)."""
    rows, rhs = gcp_rows(pts, lat0, lon0)
    A, B = np.array(rows, float), np.array(rhs, float)
    if extra and extra[0]:
        A = np.vstack([A, np.array(extra[0], float) * extra[2]])
        B = np.concatenate([B, np.array(extra[1], float) * extra[2]])
    if np.linalg.matrix_rank(A) < 4:
        return None
    sol, *_ = np.linalg.lstsq(A, B, rcond=None)
    return sol, None


def residuals_km(model, pts, lat0, lon0):
    a, b, c, d = model[0]
    rows, rhs = gcp_rows(pts, lat0, lon0)
    return np.array([abs(r[0] * a + r[1] * b + r[2] * c + r[3] * d - t) for r, t in zip(rows, rhs)])


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
    a, b, c, d = model[0]
    lat, lon = from_local(a * x + b * y + c, b * x - a * y + d, lat0, lon0)
    return [round(lon, 7), round(lat, 7)]


def to_page(model, lat, lon, lat0, lon0):
    a, b, c, d = model[0]
    E, N = to_local(lat, lon, lat0, lon0)
    M = np.array([[a, b], [b, -a]])
    return np.linalg.solve(M, np.array([E - c, N - d]))


# ── Runway refinement ────────────────────────────────────────────────────
# Graticule labels only pin a large-scale chart to ~5-15 m (label centring, drafting). Aerodrome
# charts draw runways to scale, and the navdata thresholds are surveyed, so the drawn runway edges
# give an independent, much tighter constraint on rotation and lateral position.

def page_segments(page):
    S = []
    for dr in page.get_drawings():
        for it in dr['items']:
            if it[0] == 'l':
                S.append(((it[1].x, it[1].y), (it[2].x, it[2].y)))
            elif it[0] in ('re', 'qu'):
                if it[0] == 're':
                    r = it[1]; c = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
                else:
                    q = it[1]; c = [(p.x, p.y) for p in (q.ul, q.ur, q.lr, q.ll)]
                S += [(c[i], c[(i + 1) % 4]) for i in range(4)]
    return np.array(S, float).reshape(-1, 2, 2)


def runway_pairs(runways):
    by = {r['id']: r for r in runways or [] if r.get('id', '').startswith('RW') and r.get('lat')}
    out, seen = [], set()
    for k, r in by.items():
        try:
            n = int(k[2:4])
        except ValueError:
            continue
        opp = f"RW{(n + 18 - 1) % 36 + 1:02d}{ {'L': 'R', 'R': 'L', 'C': 'C'}.get(k[4:5], '') }"
        if opp in by and opp not in seen and k not in seen:
            out.append((r, by[opp])); seen.update((k, opp))
    return out


def runway_constraints(page, model, runways, lat0, lon0, segs=None):
    """For each runway, find its two drawn edge lines and return centreline constraint rows:
    a point on the drawn centreline must map onto the surveyed centreline (cross-track only)."""
    a, b, c, d = model[0]
    s_km = math.hypot(a, b)
    segs = page_segments(page) if segs is None else segs
    if not len(segs):
        return [], [], []
    P, Q = segs[:, 0], segs[:, 1]
    V = Q - P
    Ls = np.linalg.norm(V, axis=1) + 1e-9
    rows, rhs, found = [], [], []
    for r1, r2 in runway_pairs(runways):
        A = to_page(model, r1['lat'], r1['lon'], lat0, lon0)
        B = to_page(model, r2['lat'], r2['lon'], lat0, lon0)
        L = np.linalg.norm(B - A)
        if L * s_km * 1000 < 300:
            continue
        u = (B - A) / L; nrm = np.array([-u[1], u[0]])
        par = np.abs(V @ u) / Ls > math.cos(math.radians(1.0))
        o1 = (P - A) @ nrm; o2 = (Q - A) @ nrm
        t1 = (P - A) @ u; t2 = (Q - A) @ u
        om_m = (o1 + o2) / 2 * s_km * 1000
        inside = (np.maximum(t1, t2) > -0.05 * L) & (np.minimum(t1, t2) < 1.05 * L)
        idx = np.where(par & inside & (Ls > 0.01 * L) & (np.abs(om_m) < 60))[0]
        if len(idx) < 2:
            continue
        # edges are often drawn as many short collinear pieces: cluster by lateral offset (1 m bins)
        idx = idx[np.argsort(om_m[idx])]
        clusters, cur = [], [idx[0]]
        for k in idx[1:]:
            if om_m[k] - om_m[cur[-1]] <= 1.0:
                cur.append(k)
            else:
                clusters.append(cur); cur = [k]
        clusters.append(cur)
        lines = []
        for cl in clusters:
            ts = np.concatenate([t1[cl], t2[cl]]); os_ = np.concatenate([o1[cl], o2[cl]])
            lo, hi = max(ts.min(), 0), min(ts.max(), L)
            cover = sum(max(0.0, min(max(t1[k], t2[k]), L) - max(min(t1[k], t2[k]), 0)) for k in cl)
            if cover < 0.4 * L or hi - lo < 0.5 * L:
                continue
            Aa = np.vstack([np.ones_like(ts), ts]).T
            (al, be), *_ = np.linalg.lstsq(Aa, os_, rcond=None)
            lines.append((float(np.mean(om_m[cl])), al, be))
        if len(lines) < 2:
            continue
        width_m = (r1.get('width_m') or 150) * 0.3048          # navdata width is in feet
        best = None
        for i in range(len(lines)):
            for j in range(i + 1, len(lines)):
                sep = lines[j][0] - lines[i][0]
                if not (0.6 * width_m <= sep <= 1.6 * width_m):
                    continue
                score = abs(sep - width_m) + 0.5 * abs((lines[i][0] + lines[j][0]) / 2)
                if best is None or score < best[0]:
                    best = (score, lines[i], lines[j])
        if not best:
            continue
        _, li, lj = best
        E1, N1 = to_local(r1['lat'], r1['lon'], lat0, lon0)
        E2, N2 = to_local(r2['lat'], r2['lon'], lat0, lon0)
        g = np.array([E2 - E1, N2 - N1]); g /= np.linalg.norm(g)
        nE, nN = -g[1], g[0]
        for t in (0.15 * L, 0.85 * L):
            off = (li[1] + li[2] * t + lj[1] + lj[2] * t) / 2
            x, y = A + u * t + nrm * off
            rows.append([nE * x - nN * y, nE * y + nN * x, nE, nN])
            rhs.append(nE * E1 + nN * N1)
        om_m = {'i': li[0], 'j': lj[0]}
        found.append((r1['id'], r2['id'], round((li[0] + lj[0]) / 2, 1), round(lj[0] - li[0], 1)))
    return rows, rhs, found


def refine_with_runways(page, fit, runways, lat0, lon0):
    """Re-fit with runway centreline constraints (σ≈1 m) on top of the graticule GCPs (σ≈rms)."""
    model, inl, rms = fit
    rows, rhs, found = runway_constraints(page, model, runways, lat0, lon0)
    if not found:
        return fit, None
    w = max(rms, 3.0) / 0.3          # weight ratio: graticule σ / runway σ (the drawn runway is what we overlay)
    m2 = fit_similarity(inl, lat0, lon0, (rows, rhs, w))
    if not m2:
        return fit, None
    # sanity: the graticule must still agree (allow drafting error) and the correction must be modest
    r = residuals_km(m2, inl, lat0, lon0)
    rms2 = float(np.sqrt(np.mean(r ** 2)) * 1000)
    shift = max(np.linalg.norm(np.array(to_lonlat(m2, x, y, lat0, lon0)) - np.array(to_lonlat(model, x, y, lat0, lon0)))
                for x, y in ((p[0], p[1]) for p in inl)) * 111_000
    if rms2 > max(25.0, 3 * rms) or shift > 80:
        return fit, {'rejected': True, 'runways': found, 'shiftM': round(shift, 1)}
    # residual of runway constraints after refit
    a, b, c, d = m2[0]
    rr = [abs(rw[0] * a + rw[1] * b + rw[2] * c + rw[3] * d - t) * 1000 for rw, t in zip(rows, rhs)]
    return (m2, inl, rms2), {'runways': found, 'rwyResM': round(max(rr), 1), 'shiftM': round(shift, 1)}


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


def georeference(page, ctype, icao, cid, lat0, lon0, runways, out_dir, ocr=False):
    """Fit the sheet to its graticule (text layer, or OCR of outlined labels) and write the overlay.
    Returns the overlay record or None."""
    if 'NOT TO SCALE' in page.get_text().upper():
        return None
    pts = graticule_points(page)
    if ocr and len(pts) < 5:
        pts = ocr_graticule_points(page)
    fit = ransac(pts, lat0, lon0) if len(pts) >= 5 else None
    refine = None
    if fit and ctype in ('ADC', 'GMC', 'PDC') and runways:
        fit, refine = refine_with_runways(page, fit, runways, lat0, lon0)
    if not fit:
        return None
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
    if not (rms <= max(80, 3 * s_m) and dist <= 160 and big and len(inl) >= 6 and abs(rot) < 2):
        return None
    opix = page.get_pixmap(dpi=OVL_DPI, clip=pymupdf.Rect(x0, y0, x1, y1), alpha=False)
    save_webp(transparent_overlay(opix), os.path.join(out_dir, f'{cid}.ov.webp'), 80)
    ov = {
        'file': f'/charts/aip/{icao}/{cid}.ov.webp',
        'bounds': [to_lonlat(model, x0, y0, lat0, lon0), to_lonlat(model, x1, y0, lat0, lon0),
                   to_lonlat(model, x1, y1, lat0, lon0), to_lonlat(model, x0, y1, lat0, lon0)],
        'rmsM': round(rms, 1), 'gcps': len(inl), 'mPerPt': round(s_m, 2), 'rotDeg': round(rot, 2),
    }
    if ocr and len(graticule_points(page)) < 5:
        ov['ocr'] = True
    if refine and not refine.get('rejected'):
        ov['runwayFit'] = refine
    return ov


def main():
    cache, public = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    man = json.load(open(os.path.join(cache, 'manifest.json')))
    arp, arp_rwys = {}, {}
    try:
        for a in json.load(open(os.path.join(public, 'data', 'korea_airspace.json')))['airports']:
            arp[a['icao']] = (a['lat'], a['lon'])
            arp_rwys[a['icao']] = a.get('runways') or []
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
                if not tab:
                    ov = georeference(page, ctype, icao, cid, lat0, lon0, arp_rwys.get(icao), out_dir)
                    if ov:
                        e['overlay'] = ov
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
