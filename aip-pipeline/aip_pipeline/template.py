"""Conventional procedures (DME arcs, heading legs, radials) built from a reference coding template,
re-anchored on AIP data and verified against the current AIP chart text.

Why: conventional SIDs/approaches are published as drawings + prose, without coding tables. A
commercial nav database (Navigraph, kept under reference/ and never served to the app) already holds
the ARINC-424 leg *structure* for them (CA/CF/AF/VI/VD … legs). We reuse only that structure:

  * every waypoint is re-computed from AIP data — AD 2 / ENR 4.4 fixes, AIP navaid position +
    radial/DME (D-fixes, arc end points), or the AIP runway threshold for final-approach fixes;
  * DME arcs are drawn around the AIP navaid position;
  * the procedure is accepted only if its named fixes and courses are found on the current AIP
    charts of that airport (text layer, or OCR for image-only charts).

Each output procedure carries a verification score and the max offset between the AIP-derived
waypoints and the reference, so differences (e.g. procedures amended since the reference cycle)
are visible in the report.
"""
from __future__ import annotations
import re, math
from .geo import inv, fwd, angdiff, intersect, point_at_dme
from .corpus import norm

NOFIX = {'CA', 'VA', 'VI', 'VM', 'FA', 'VR', 'VD', 'FM', 'CI', 'CD', 'CR', 'FC', 'FD'}
RWYFIX = re.compile(r'^(?:CF|FF|FI|CI|CL|FL|MA|MD|FD|FX|IF|DE|RW|MM|OM|IM|FN)\d{2}[LRCB]?$')
DFIX = re.compile(r'^D(\d{3})([A-Z])$')
REFNAME = re.compile(r'^I?([A-Z]{2,4}?)(\d{3})(\d{3})')

def _letter_nm(c):
    return ord(c) - 64

class Ctx:
    def __init__(self, icao, ds, ref, corpus, enr):
        self.icao = icao; self.ds = ds; self.ref = ref; self.corpus = corpus; self.enr = enr or {}
        self.rtw = {}
        for w in ref.get('terminalWaypoints', []):
            if w.get('region') == icao:
                self.rtw[w['id']] = w
        self.rwp = {w.get('name'): w for w in ref.get('waypoints', [])}
        self.rnav = {}
        for n in ref.get('navaids', []):
            self.rnav.setdefault(n['ident'], n)
        self.rapt = next((a for a in ref.get('airports', []) if a['icao'] == icao), {})
        # AIP navaids: AD 2.19, ENR 4.1, navaid coordinates printed on the charts
        self.nav, self.aip_decl = {}, {}
        # DME / VOR positions first (distances are measured from the DME antenna, not the LOC)
        order = sorted(ds.get('navaids', []), key=lambda n: 0 if re.search(r'DME|VOR|TACAN', n.get('type') or '') else 1)
        for n in order:
            if n.get('ident') and n.get('latlon'):
                self.nav.setdefault(n['ident'], tuple(n['latlon']))
                if n.get('decl') is not None:
                    self.aip_decl.setdefault(n['ident'], n['decl'])
        for k, v in self.enr.items():
            if len(k) == 3 and k not in self.nav:
                self.nav[k] = tuple(v)
        for k, v in chart_navaids(corpus).items():
            self.nav.setdefault(k, v)
        self.fixes = {k: tuple(v['pos']) for k, v in ds['fixes'].items()}
        self.rws = {r['id']: r for r in ds['runways'] if r.get('thr')}
        self.var = (ds['airport'].get('magvar') or {}).get('deg')
        if self.var is None:
            self.var = self.rapt.get('mag_var') or -8.0
        self.cal_decl = calibrate_declination(self)
        self.elev = ds['airport'].get('elev_m') or 0
        self.elev_ft = (self.elev or 0) * 3.28084
        self.arp = tuple(ds['airport'].get('arp') or (self.rapt.get('lat'), self.rapt.get('lon')))

    def decl(self, nav):
        if nav in self.cal_decl:
            return self.cal_decl[nav]
        if nav in self.aip_decl:
            return self.aip_decl[nav]
        n = self.rnav.get(nav)
        if n and n.get('mag_var') is not None:
            return n['mag_var']
        return self.var

    def true(self, mag, nav=None):
        return (mag + (self.decl(nav) if nav else self.var)) % 360

    def ref_pos(self, w):
        r = self.rtw.get(w) or self.rwp.get(w)
        if r and r.get('lat') is not None:
            return (r['lat'], r['lon'])
        n = self.rnav.get(w)
        if n and n.get('lat') is not None:
            return (n['lat'], n['lon'])
        return None

    def thr(self, rid):
        """AIP threshold for runway id like '04R' (B -> L)."""
        rid = rid.replace('B', 'L')
        r = self.rws.get(rid) or self.rws.get(rid.rstrip('LRC'))
        return tuple(r['thr']) if r else None

    def ref_thr(self, rid):
        for r in self.rapt.get('runways', []) or []:
            if r.get('id') in ('RW' + rid, 'RW' + rid.replace('B', 'L')):
                return (r['lat'], r['lon'])
        return None

    def resolve(self, w, rwy_hint=None):
        """-> (pos, source) using AIP data only; (None, why) if impossible."""
        if w in self.fixes:
            return self.fixes[w], 'AIP fix'
        if w in self.nav:
            return self.nav[w], 'AIP navaid'
        if w in self.enr:
            return tuple(self.enr[w]), 'AIP ENR 4.4'
        m = re.match(r'^RW(\d{2}[LRC]?)$', w)
        if m and self.thr(m.group(1)):
            return self.thr(m.group(1)), 'AIP THR'
        rp = self.ref_pos(w)
        rname = (self.rtw.get(w) or {}).get('name', '')
        m = DFIX.match(w)
        if m:
            rad, dist = int(m.group(1)), _letter_nm(m.group(2))
            mm = REFNAME.match(rname or '')
            cands = [mm.group(1)] if mm else []
            mm2 = re.search(r'\(([A-Z]{3}) (\d+(?:\.\d+)?) DME\)', rname or '')
            if mm2:
                cands = [mm2.group(1)] + cands
            cands += sorted(self.nav, key=lambda k: inv(self.nav[k], self.arp)[1])
            for nav in cands:
                if nav in self.nav:
                    p = fwd(self.nav[nav], self.true(rad, nav), dist)
                    if rp is None or inv(p, rp)[1] < 1.5:
                        return p, f'AIP {nav} R{rad:03d}/D{dist}'
        if RWYFIX.match(w) and rp:
            m = re.search(r'(\d{2}[LRCB]?)$', w)
            rid = m.group(1)
            a, b = self.thr(rid), self.ref_thr(rid)
            if a and b:
                crs, d = inv(b, rp)
                return fwd(a, crs, d), f'AIP THR {rid} + 기준 오프셋'
        # DME step-down / final fixes (reference name = NAV + radial + distance): AIP navaid + DME
        mm = REFNAME.match(rname or '')
        if mm and rp and mm.group(1) in self.nav:
            nav = mm.group(1)
            brg, d = inv(self.nav[nav], rp)
            d1 = round(d, 1)
            if any(re.search(r'(?<![\d.])%s(?![\d])' % re.escape(f'{d1:.1f}'), pg['norm']) for pg in self.corpus):
                return fwd(self.nav[nav], brg, d1), f'AIP {nav} D{d1:.1f} (차트 확인)'
        # named fix defined on the chart as "R xxx NAV/Dyy"
        p = self.chart_def(w)
        if p:
            return p
        if rp:
            return rp, 'REF(미검증)'
        return None, 'unresolved'

    def chart_def(self, w):
        pat = re.compile(re.escape(w) + r'.{0,60}?R\s*(\d{3})\s*([A-Z]{3})\s*/\s*D\s*(\d+(?:\.\d+)?)|R\s*(\d{3})\s*([A-Z]{3})\s*/\s*D\s*(\d+(?:\.\d+)?).{0,60}?' + re.escape(w))
        rp = self.ref_pos(w)
        for pg in self.corpus:
            for m in pat.finditer(pg['norm']):
                g = m.groups()
                rad, nav, d = (g[0], g[1], g[2]) if g[0] else (g[3], g[4], g[5])
                if nav in self.nav:
                    p = fwd(self.nav[nav], self.true(int(rad), nav), float(d))
                    if rp is None or inv(p, rp)[1] < 2.0:
                        return p, f'AIP 차트 R{rad} {nav}/D{d}'
        return None

def calibrate_declination(ctx):
    """Effective VOR declination from AIP itself: fixes printed as 'R ddd NAV/Ddd' whose
    coordinates are published (coding/fix tables, ENR 4.4)."""
    from statistics import median
    known = dict(ctx.fixes)
    for k, v in ctx.enr.items():
        known.setdefault(k, tuple(v))
    obs = {}
    pat = re.compile(r'\b([A-Z]{5})\b[^A-Z]{0,40}?R\s*(\d{3})\s*([A-Z]{3})\s*/\s*D\s*(\d+(?:\.\d+)?)|R\s*(\d{3})\s*([A-Z]{3})\s*/\s*D\s*(\d+(?:\.\d+)?)[^A-Z]{0,40}?\b([A-Z]{5})\b')
    for pg in ctx.corpus:
        for m in pat.finditer(pg['norm']):
            g = m.groups()
            fx, rad, nav, d = (g[0], g[1], g[2], g[3]) if g[0] else (g[7], g[4], g[5], g[6])
            if fx in known and nav in ctx.nav:
                brg, dist = inv(ctx.nav[nav], known[fx])
                if abs(dist - float(d)) < 0.3:
                    obs.setdefault(nav, []).append(((brg - int(rad) + 180) % 360) - 180)
    return {k: round(median(v), 2) for k, v in obs.items() if v and all(abs(x - median(v)) < 1.0 for x in v)}

def chart_navaids(corpus):
    """'KWA | 35°07'34"N | 126°48'44"E' printed in chart navaid boxes."""
    from .coords import parse_latlon
    out = {}
    for pg in corpus:
        t = pg['text']
        for m in re.finditer(r"(?m)^\s*([A-Z]{3,4})\s*\n\s*(\d{2}°\s*\d{2}'\s*\d{2}(?:\.\d+)?\"\s*[NS])\s*\n\s*(\d{3}°\s*\d{2}'\s*\d{2}(?:\.\d+)?\"\s*[EW])", t):
            ll = parse_latlon(m.group(2) + ' ' + m.group(3))
            if ll:
                out.setdefault(m.group(1), ll)
    return out

# ---------------------------------------------------------------- verification
def crs_in(c, txt):
    """Course printed on the chart: as a heading/track (ddd°), or as the radial flown inbound (reciprocal)."""
    return any(re.search(r'(?<!\d)%03d(?!\d)' % x, txt) for x in {c % 360, (c + 180) % 360} | {(c + d) % 360 for d in (-1, 1)})

def verify(ctx, kind, key, legs):
    """Score how much of the template is printed on the current AIP charts of this airport."""
    rid = None
    m = re.search(r'RW(\d{2}[LRCB]?)', key) or re.match(r'^[A-Z](\d{2}[LRC]?)', key)
    if m:
        rid = m.group(1).replace('B', '')
    named = sorted({L['wpt'] for L in legs if L.get('wpt') and re.fullmatch(r'[A-Z]{5}|[A-Z]{3}', L['wpt'])})
    courses = sorted({int(L['course']) for L in legs if L.get('course') is not None and L.get('path') in ('CF', 'AF', 'VI', 'CA', 'VA', 'VD', 'CD', 'VM', 'FD', 'FC', 'CI')})
    want = {'sids': ('DEPARTURE', 'SID'), 'stars': ('ARRIVAL', 'STAR'), 'iaps': ('APPROACH',)}[kind]
    pages = [pg for pg in ctx.corpus if not pg.get('is_text_doc') and any(k in pg['norm'] for k in want)]
    if rid:
        pages = [pg for pg in pages if re.search(r'RWY\s*' + rid[:2], pg['norm'])] or pages
    if kind == 'iaps':
        typ = {'I': 'ILS', 'L': 'LOC', 'D': 'VOR', 'N': 'NDB', 'T': 'TACAN', 'V': 'VOR', 'S': 'VOR'}.get(key[0])
        if typ:
            pages = [pg for pg in pages if typ in pg['norm']] or pages

    def score(pg):
        nf = sum(1 for n in named if re.search(r'\b' + n + r'\b', pg['norm'])) / len(named) if named else 1.0
        nc = sum(1 for c in courses if crs_in(c, pg['norm'])) / len(courses) if courses else 1.0
        return nf, nc

    if not pages:
        return 0.0, 0.0, None
    ranked = sorted(pages, key=lambda pg: score(pg), reverse=True)
    best = ranked[0]
    nf, nc = score(best)
    if nf < 0.75 or nc < 0.5:
        # labels on many charts are vector outlines: OCR the best candidate pages and re-score
        from .corpus import ocr_page
        for pg in ranked[:3]:
            ocr_page(pg)
        top = ranked[:3]
        ranked = sorted(top, key=lambda pg: score(pg), reverse=True)
        best = ranked[0]
        nf, nc = score(best)
        if nf >= 0.75 and nc < 0.5 and courses:
            # course labels are often on the companion page (plan view vs. tabulation): use the candidate set
            alltxt = ' '.join(pg['norm'] for pg in top)
            nc = sum(1 for c in courses if crs_in(c, alltxt)) / len(courses)
    return nf, nc, f"{best['file']} p{best['page']}" + (' (OCR)' if best['src'] == 'ocr' or best.get('ocr_done') else '')

# ---------------------------------------------------------------- geometry
def build_legs(ctx, kind, key, legs, prefix):
    """Template legs -> app legs with AIP coordinates; synthetic points for heading/arc legs."""
    out, extra, srcs, devs = [], [], {}, []
    rid = None
    m = re.search(r'RW(\d{2}[LRCB]?)$', key) or re.match(r'^[A-Z](\d{2}[LRC]?)', key)
    if m:
        rid = m.group(1)
    pos = None
    if kind == 'sids' and rid:
        t = ctx.thr(rid)
        opp = None
        if t:
            rr = ctx.rws.get(rid.replace('B', 'L')) or ctx.rws.get(rid[:2])
            if rr:
                # DER = threshold + runway length along runway bearing
                opp = fwd(t, rr['true_brg'], (rr.get('len_m') or 0) / 1852.0)
        pos = opp or t
    approx = False
    n = 0
    start = pos
    prev_pos = None

    def add_pt(p, path='TF', src_leg=None):
        nonlocal n
        n += 1
        wid = f'{prefix}_{n}'
        extra.append({'id': wid, 'name': wid, 'lat': p[0], 'lon': p[1], 'type': 'AIP_CONSTRUCTED'})
        o = {k: (src_leg or {}).get(k) for k in ('alt_desc', 'alt1', 'alt2', 'spd_lim', 'turn')}
        out.append({'wpt': wid, 'path': path, 'course': (src_leg or {}).get('course'), 'dist': None, **o,
                    '_pos': p, '_syn': True, '_arc': path == 'TF' and (src_leg or {}).get('path') == 'AF'})

    for i, L in enumerate(legs):
        w, path = L.get('wpt'), L.get('path')
        crs = L.get('course')
        if path in ('HM', 'HA', 'HF', 'PI'):
            out.append({k: L.get(k) for k in ('wpt', 'path', 'course', 'dist', 'alt_desc', 'alt1', 'alt2', 'spd_lim', 'turn')})
            continue
        if w and path not in NOFIX:
            p, src = ctx.resolve(w)
            if p is None:
                return None, extra, {'unresolved': w}, devs, approx
            srcs[w] = src
            rp = ctx.ref_pos(w)
            if rp:
                devs.append((w, inv(p, rp)[1] * 1852))
            if path == 'AF' and pos is not None:
                rf = refine_arc_end(ctx, pos, p)
                if rf:
                    p = rf[0]; srcs[w] = rf[1]
                    if rp:
                        devs[-1] = (w, inv(p, rp)[1] * 1852)
                cr = arc_center_from_ref(ctx, w)
                c = None
                if cr and abs(inv(cr[1], pos)[1] - inv(cr[1], p)[1]) >= 0.6 and L.get('course') is not None:
                    # not on the arc yet: join it at the published start radial, then fly the arc
                    a0 = fwd(cr[1], ctx.true(L['course'], cr[0]), inv(cr[1], p)[1])
                    add_pt(a0, 'TF', L)
                    out[-1]['_arc'] = True
                    approx = True
                    prev_pos, pos = pos, a0
                if cr and abs(inv(cr[1], pos)[1] - inv(cr[1], p)[1]) < 0.6:
                    c = (cr[0], cr[1], inv(cr[1], p)[1], 0)
                else:
                    c = arc_center(ctx, pos, p)
                if c:
                    for q in arc_points(c[1], pos, p, L.get('turn') or 'R'):
                        add_pt(q, 'TF', L)
                    srcs[f'arc→{w}'] = f'AIP {c[0]} D{c[2]:.1f} arc'
            out.append({**{k: L.get(k) for k in ('course', 'dist', 'alt_desc', 'alt1', 'alt2', 'spd_lim', 'turn')}, 'wpt': w, 'path': 'TF' if path == 'AF' else path, '_pos': p})
            prev_pos, pos = pos, p
            continue
        # leg without a terminating fix: heading / course legs
        if pos is None or crs is None:
            continue
        nav = nearest_dme(ctx, pos)
        brg = ctx.true(crs, None)
        nxt = legs[i + 1] if i + 1 < len(legs) else None
        q = None
        # SIDs: turn onto the new heading with a real turn radius (direction as published) before flying it
        if kind == 'sids' and prev_pos is not None and inv(prev_pos, pos)[1] > 0.05:
            h_in = inv(prev_pos, pos)[0]
            if angdiff(h_in, brg) > 15:
                tdir = (L.get('turn') or '').upper()[:1]
                for a_pt in turn_arc(pos, h_in, brg, tdir):
                    add_pt(a_pt, 'TF', {'turn': L.get('turn')})
                    out[-1]['_arc'] = True
                    prev_pos, pos = pos, a_pt
        if path in ('VD', 'CD', 'FD') and L.get('dist') and nav:
            q = point_at_dme(pos, brg, ctx.nav[nav], float(L['dist']))
        elif path in ('VI', 'CI') and nxt and nxt.get('wpt'):
            np_, _ = ctx.resolve(nxt['wpt'])
            if np_ is not None:
                if nxt.get('path') == 'AF':
                    c = arc_center_from_ref(ctx, nxt['wpt'])
                    if c:
                        q = point_at_dme(pos, brg, c[1], inv(c[1], np_)[1])
                elif nxt.get('course') is not None:
                    q = intersect(pos, brg, np_, (ctx.true(nxt['course']) + 180) % 360)
                if q is None:
                    q = intersect(pos, brg, np_, (inv(np_, pos)[0]))
        elif path in ('CA', 'VA', 'FA'):
            alt = L.get('alt1') or 2000
            q = fwd(pos, brg, max(0.6, min(8.0, (alt - ctx.elev_ft) / 300.0)))
        if q is None:
            q = fwd(pos, brg, 3.0)
        approx = True
        add_pt(q, path, L)
        prev_pos, pos = pos, q
    if kind == 'sids' and start is not None:
        out, extra = smooth_turns(out, extra, start, prefix)
    for o in out:
        for k in ('_pos', '_syn', '_arc'):
            o.pop(k, None)
    return out, extra, srcs, devs, approx

def turn_arc(p, h_in, h_out, tdir, r=None, step=0.1):
    r = r or TURN_R_NM
    if tdir not in ('L', 'R'):
        tdir = 'R' if ((h_out - h_in) % 360) < 180 else 'L'
    total = (h_out - h_in) % 360 if tdir == 'R' else (h_in - h_out) % 360
    if total > 270:          # coded turn direction disagrees with geometry: take the short way
        tdir = 'L' if tdir == 'R' else 'R'
        total = 360 - total
    dh = step / r * 57.2958
    pts, h, cur, done = [], h_in, p, 0.0
    while done + dh < total:
        h = (h + dh) % 360 if tdir == 'R' else (h - dh) % 360
        done += dh
        cur = fwd(cur, h, step)
        if int(done / dh) % 3 == 0:
            pts.append(cur)
    return pts

TURN_R_NM = 1.5   # ~210 kt IAS, 25° bank: radius of the turn initiated over a DME / altitude point

def smooth_turns(out, extra, start, prefix):
    """SIDs: insert the DER as first point and replace instantaneous turns at heading/DME points
    (fly-over) by a turn of radius TURN_R_NM followed by a direct track to the next point."""
    pts = [o for o in out if o.get('_pos') is not None]
    if not pts:
        return out, extra
    ex = {e['id']: e for e in extra}
    k = len(extra)
    new_out = []
    der = f'{prefix}_DER'
    extra.append({'id': der, 'name': der, 'lat': start[0], 'lon': start[1], 'type': 'AIP_CONSTRUCTED'})
    new_out.append({'wpt': der, 'path': 'IF', 'course': None, 'dist': None, 'alt_desc': None, 'alt1': None, 'alt2': None,
                    'spd_lim': None, 'turn': None})
    prev = start
    seq = [o for o in out]
    for i, o in enumerate(seq):
        new_out.append(o)
        p = o.get('_pos')
        if p is None:
            continue
        nxt = next((x for x in seq[i + 1:] if x.get('_pos') is not None), None)
        if o.get('_syn') and not o.get('_arc') and nxt is not None and prev is not None and inv(prev, p)[1] > 0.05:
            h = inv(prev, p)[0]
            tgt = nxt['_pos']
            if angdiff(h, inv(p, tgt)[0]) > 15 and inv(p, tgt)[1] > 2.2 * TURN_R_NM:
                cur, step = p, 0.1
                tdir = (nxt.get('turn') or '').upper()[:1] if not nxt.get('_arc') else ''
                dmax = step / TURN_R_NM * 57.2958
                turned = 0.0
                for _ in range(400):
                    want = inv(cur, tgt)[0]
                    if tdir == 'R':
                        diff = (want - h) % 360
                        diff = 0 if diff < 2 or diff > 358 else diff
                    elif tdir == 'L':
                        diff = -((h - want) % 360)
                        diff = 0 if diff > -2 or diff < -358 else diff
                    else:
                        diff = (want - h + 540) % 360 - 180
                        diff = 0 if abs(diff) < 2 else diff
                    if diff == 0 or inv(cur, tgt)[1] < 0.3 or turned > 200:
                        break
                    dh = max(-dmax, min(dmax, diff))
                    h = (h + dh) % 360
                    turned += abs(dh)
                    cur = fwd(cur, h, step)
                    k += 1
                    if k % 3 == 0:
                        wid = f'{prefix}_t{k}'
                        extra.append({'id': wid, 'name': wid, 'lat': cur[0], 'lon': cur[1], 'type': 'AIP_CONSTRUCTED'})
                        new_out.append({'wpt': wid, 'path': 'TF', 'course': None, 'dist': None, 'alt_desc': None,
                                        'alt1': None, 'alt2': None, 'spd_lim': None, 'turn': o.get('turn')})
        prev = p
    return new_out, extra

ARC_RE = re.compile(r'\b([A-Z]{3})\s*D\s*(\d+(?:\.\d+)?)\s*ARC\b.{0,80}?\bR\s*(\d{3})\s*([A-Z]{3})\b')

def refine_arc_end(ctx, start, ref_end):
    """Arc end as published: intersection of 'NAV Dnn arc' with the lead/termination radial 'R ddd NAV2'."""
    best = None
    for pg in ctx.corpus:
        for m in ARC_RE.finditer(pg['norm']):
            cn, r, rad, n2 = m.group(1), float(m.group(2)), int(m.group(3)), m.group(4)
            if cn not in ctx.nav or n2 not in ctx.nav:
                continue
            c = ctx.nav[cn]
            if abs(inv(c, start)[1] - r) > 0.6:
                continue
            brg = ctx.true(rad, n2)
            prev = None
            k = 0.0
            while k < 60:
                q = fwd(ctx.nav[n2], brg, k)
                d = inv(c, q)[1] - r
                if prev is not None and prev * d <= 0:
                    off = inv(q, ref_end)[1]
                    if off < 2.0 and (best is None or off < best[2]):
                        best = (q, f'AIP {cn} D{r:g} arc ∩ R{rad:03d} {n2}', off)
                prev = d; k += 0.05
    return best[:2] if best else None

def nearest_dme(ctx, p):
    c = [k for k in ctx.nav if len(k) == 3 and inv(ctx.nav[k], p)[1] < 25] or [k for k in ctx.nav if len(k) >= 3]
    return min(c, key=lambda k: inv(ctx.nav[k], p)[1]) if c else None

def arc_center(ctx, a, b):
    best = None
    for k, c in ctx.nav.items():
        ra, rb = inv(c, a)[1], inv(c, b)[1]
        if 2 <= ra <= 40 and abs(ra - rb) < 0.6:
            if best is None or abs(ra - rb) < best[3]:
                best = (k, c, (ra + rb) / 2, abs(ra - rb))
    return best

def arc_center_from_ref(ctx, w):
    nm = (ctx.rtw.get(w) or {}).get('name', '')
    m = REFNAME.match(nm)
    if m and m.group(1) in ctx.nav:
        d = DFIX.match(w)
        return (m.group(1), ctx.nav[m.group(1)], _letter_nm(d.group(2)) if d else int(m.group(3)))
    return None

def arc_points(c, a, b, turn, step_deg=4):
    r = (inv(c, a)[1] + inv(c, b)[1]) / 2
    s, e = inv(c, a)[0], inv(c, b)[0]
    if (turn == 'R' and (e - s) % 360 > 200) or (turn == 'L' and (s - e) % 360 > 200):
        turn = 'L' if turn == 'R' else 'R'     # DME arcs are < 200°: coded direction is relative to the other end
    if turn == 'R':
        sweep = (e - s) % 360
        angs = [s + k for k in range(step_deg, int(sweep), step_deg)]
    else:
        sweep = (s - e) % 360
        angs = [s - k for k in range(step_deg, int(sweep), step_deg)]
    return [fwd(c, x % 360, r) for x in angs]

# ---------------------------------------------------------------- driver
def _parts(k):
    m = re.match(r'^([A-Z])(\d{2}[LRC]?)-?([A-Z])?(?:\.(.+))?$', k)
    return (m.group(1), m.group(2), m.group(4)) if m else None

def aip_alias(key, mine, app_keys):
    """Map a reference approach key (e.g. I36LZ.PEDLO) to the AIP-table key (I36L.PEDLO)."""
    p = _parts(key)
    if not p:
        return None
    hits = [k for k in mine if app_keys.get(('iaps', k), '').startswith('AIP fix/point') and _parts(k)
            and _parts(k)[:2] == p[:2] and (_parts(k)[2] or '') == (p[2] or '')]
    return hits[0] if len(hits) == 1 else None

def rename_sids(ctx, ds, mine, built, rows):
    """Give template SIDs their current AIP names: '<FIX> <n><L>' charts combine the runway part
    and the transition into one SID (e.g. SOORO2.RW36B + SOORO2.KALOD -> KALOD 1S)."""
    from .app_adapter import proc_ident
    names = {n.get('name'): n['ident'] for n in ctx.ref.get('navaids', []) if n.get('name')}
    folded, keep = set(), set()
    for p in ds['procedures']:
        if p['type'] != 'SID' or not p['coding'].startswith('conventional') or not p.get('runway'):
            continue
        m = re.match(r'^([A-Z]{3,5}) (\d[A-Z])$', p['name'])
        if not m:
            continue
        endfix = names.get(m.group(1), m.group(1))
        rw = p['runway']
        bases = {k.split('.')[0] for k in built if k.endswith('.RW' + rw) or k.endswith('.RW' + rw[:2] + 'B')}
        cands = [(b, f'{b}.{endfix}') for b in bases if f'{b}.{endfix}' in mine]
        if len(cands) != 1:
            continue
        b, tr = cands[0]
        rwk = next(k for k in (f'{b}.RW{rw}', f'{b}.RW{rw[:2]}B') if k in mine)
        newk = f"{proc_ident(p)}.RW{rw}"
        legs = [dict(L) for L in mine[rwk]] + [dict(L) for L in mine[tr] if L.get('path') != 'IF']
        for j, L in enumerate(legs, 1):
            L['seq'] = j * 10
        mine[newk] = legs
        folded |= {rwk, tr}
        rows.append({'kind': 'sids', 'key': newk, 'fix_match': 1.0, 'course_match': 1.0, 'page': None,
                     'result': f'AIP 명칭 적용 ({rwk} + {tr} → {p["name"]})'})
    for k in folded:
        b = k.split('.')[0]
        if k.split('.')[1].startswith('RW'):
            # keep a runway part only while unfolded transitions of the same SID still need it
            if any(t.startswith(b + '.') and t not in folded and not t.split('.')[1].startswith('RW') for t in mine):
                continue
        mine.pop(k, None)
    return rows

def augment(app, ds, ref, corpus, enr, log=None):
    """Add conventional procedures that the coding tables did not cover. Returns report rows."""
    icao = ds['icao']
    ctx = Ctx(icao, ds, ref, corpus, enr)
    P = app['procedures']
    rows = []
    covered = set()
    for kind in ('sids', 'stars', 'iaps'):
        for k, legs in P[kind].get(icao, {}).items():
            if any((L.get('wpt') or '').startswith(k.split('.')[0] + '_') for L in legs):
                continue      # text-constructed approximation: template may replace it
            covered |= {L['wpt'] for L in legs if L.get('wpt')}
    extra_all = []
    built = set()
    for kind in ('sids', 'stars', 'iaps'):
        refp = ref['procedures'][kind].get(icao, {})
        mine = P[kind].setdefault(icao, {})
        for key, legs in refp.items():
            named = {L['wpt'] for L in legs if L.get('wpt') and not RWYFIX.match(L['wpt']) and not DFIX.match(L['wpt'])}
            if key.startswith('R') and kind == 'iaps':
                continue                                   # RNP approaches come from coding tables
            # AIP-table procedure for the same approach (type + runway + transition, Y/Z letter ignored)
            target = key
            if kind == 'iaps':
                alias = aip_alias(key, mine, ds.get('app_keys', {}))
                if alias:
                    target = alias
            textbuilt = target in mine and any((L.get('wpt') or '').startswith(target.split('.')[0] + '_') for L in mine[target])
            straight_tbl = target in mine and ds.get('app_keys', {}).get((kind, target), '').startswith('AIP fix/point') \
                and any(L.get('path') in ('AF', 'VI', 'CI', 'VD', 'CD') for L in legs)
            have = target in mine and not textbuilt and not straight_tbl
            if have:
                continue
            if target not in mine and kind != 'iaps' and named and len(named - covered) / len(named) <= 0.5 \
                    and not any(L.get('path') in ('AF', 'VI', 'VD', 'FD', 'CD') for L in legs):
                continue                                   # already drawn from AIP coding tables
            nf, nc, page = verify(ctx, kind, key, legs)
            row = {'kind': kind, 'key': key, 'fix_match': round(nf, 2), 'course_match': round(nc, 2), 'page': page}
            if nf < 0.75 or nc < 0.5:
                row['result'] = '제외: 현재 AIP 차트에서 확인 안 됨'
                rows.append(row); continue
            prefix = f"{icao}_{key.replace('.', '_')}"
            out, extra, srcs, devs, approx = build_legs(ctx, kind, key, legs, prefix)
            if out is None:
                row['result'] = f"제외: 좌표 산출 불가 ({srcs.get('unresolved')})"
                rows.append(row); continue
            unver = [w for w, s in srcs.items() if s.startswith('REF')]
            row['max_dev_m'] = round(max((d for _, d in devs), default=0))
            row['ref_only_fixes'] = unver
            row['approx'] = approx
            if unver and len(unver) > len(srcs) / 2:
                row['result'] = '제외: AIP에서 좌표를 찾지 못한 fix가 과반'
                rows.append(row); continue
            for j, o in enumerate(out, 1):
                o['seq'] = j * 10
            mine[target] = out
            built.add(target)
            extra_all += extra
            row['result'] = '반영' if target == key else f'반영 (AIP 표 절차 {target} 형상 교체)'
            rows.append(row)
    rename_sids(ctx, ds, P['sids'].setdefault(icao, {}), {k for k in built if k in P['sids'].get(icao, {})}, rows)
    tw = app['terminalWaypoints']
    known = {(w.get('region'), w['id']) for w in tw}
    for e in extra_all:
        e['region'] = icao
        if (icao, e['id']) not in known:
            tw.append(e); known.add((icao, e['id']))
    # fixes used by template procedures that are not yet terminal waypoints
    for kind in ('sids', 'stars', 'iaps'):
        for key, legs in P[kind].get(icao, {}).items():
            for L in legs:
                w = L.get('wpt')
                if w and (icao, w) not in known and not re.match(r'^RW\d{2}', w):
                    p, src = ctx.resolve(w)
                    if p:
                        tw.append({'id': w, 'name': w, 'lat': p[0], 'lon': p[1], 'type': 'AIP' if not src.startswith('REF') else 'REF', 'region': icao})
                        known.add((icao, w))
    ds['template_report'] = rows
    return rows
