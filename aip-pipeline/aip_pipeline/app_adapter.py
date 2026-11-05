"""Merge AIP-derived airport datasets into the app's public/data/korea_airspace.json schema.

Per-airport replacement: airports processed from AIP get their procedures, terminal waypoints,
holdings and runway data replaced; metadata.aip_airports records provenance.
"""
from __future__ import annotations
import json, re, datetime

def proc_ident(pr):
    n = re.sub(r'^RNAV\s+', '', pr['name'] or '').strip()
    m = re.match(r'([A-Z]{3,5})\s+(\d)([A-Z]?)$', n)
    if m:
        return f"{m.group(1)[:4] if m.group(3) else m.group(1)}{m.group(2)}{m.group(3)}"
    rwy = pr.get('runway') or ''
    m = re.match(r'(ILS|LOC|RNP|RNAV|VOR|NDB)\s*([A-Z])?(?:/LOC\s*[A-Z])?\s*RWY\s*(\d{2}[LRC]?)', n.replace('/LOC', ' /LOC').replace('  ', ' '))
    if m or n.startswith(('ILS', 'RNP', 'VOR', 'LOC', 'NDB', 'RNAV')):
        kind = n.split()[0].split('/')[0]
        letter = re.search(r'^(?:ILS|LOC|RNP|VOR|NDB)(?:/LOC|/DME)?\s+([A-Z])\b(?!WY)', n)
        code = {'ILS': 'I', 'LOC': 'L', 'RNP': 'R', 'RNAV': 'R', 'VOR': 'D', 'NDB': 'N'}.get(kind, 'X')
        r = re.search(r'RWY\s*(\d{2}[LRC]?)', n)
        return f"{code}{r.group(1) if r else rwy}" + (f"-{letter.group(1)}" if letter else '')
    return n.replace(' ', '')

def alt_fields(L):
    a = [x for x in (L.get('alt_c') or []) if x[0] != 'FL']
    if not a:
        return None, None, None
    if len(a) >= 2:
        hi = max(a, key=lambda x: x[1]); lo = min(a, key=lambda x: x[1])
        return 'B', hi[1], lo[1]
    k, v = a[0]
    return {'AT': '@', 'AT_OR_ABOVE': '+', 'AT_OR_BELOW': '-'}[k], v, None

NOFIX = {'CA', 'VA', 'VI', 'VM', 'FA', 'VR', 'VD', 'FM', 'CI', 'CD', 'CR'}

def legs_app(pr, extra_wpts, fixes=None):
    out = []
    if pr['coding'].startswith('conventional') and pr.get('coords'):
        # constructed geometry → synthetic waypoints
        ident = proc_ident(pr)
        for i, p in enumerate(pr['coords'][1:], 1):
            wid = f"{ident}_{i}"
            extra_wpts.append({'id': wid, 'name': wid, 'lat': p[0], 'lon': p[1], 'type': 'AIP_CONSTRUCTED'})
            out.append({'seq': i * 10, 'wpt': wid, 'path': 'TF', 'course': None, 'dist': None, 'alt_desc': None,
                        'alt1': None, 'alt2': None, 'spd_lim': None, 'turn': None})
        return out
    for i, L in enumerate(pr['legs'], 1):
        d, a1, a2 = alt_fields(L)
        sp = L.get('speed_c')
        w = L.get('fix') or None
        if w and fixes is not None and w not in fixes and not w.startswith('THR') and (
                L.get('path') in NOFIX or not re.fullmatch(r'[A-Z0-9]{2,5}|RW\d{2}[LRC]?|D\d+(\.\d+)? [A-Z]{2,4}', w)):
            w = None        # e.g. VA leg whose 'fix' column holds an altitude, or table noise
        if w:
            m = re.match(r'THR\s+RWY\s*(\d{2}[LRC]?)$', w)
            if m: w = f"RW{m.group(1)}"
        out.append({'seq': i * 10, 'wpt': w, 'path': L.get('path'), 'course': L.get('course_mag'),
                    'dist': L.get('dist_nm'), 'alt_desc': d, 'alt1': a1, 'alt2': a2,
                    'spd_lim': sp[1] if sp else None, 'turn': L.get('turn'),
                    **({'flyover': True} if L.get('flyover') else {})})
    return out

def _put(d, key, legs):
    """Insert without silently overwriting: on a key clash the shorter procedure becomes KEY.<first fix>."""
    if key not in d:
        d[key] = legs; return
    old = d[key]
    if len(legs) > len(old):
        legs, old = old, legs
        d[key] = old
    first = next((L['wpt'] for L in legs if L.get('wpt')), None) or 'X'
    k2 = f"{key}.{first}"
    n = 2
    while k2 in d:
        k2 = f"{key}.{first}{n}"; n += 1
    d[k2] = legs

def merge(app: dict, ds: dict, airac: str):
    icao = ds['icao']
    P = app.setdefault('procedures', {'sids': {}, 'stars': {}, 'iaps': {}})
    extra = []
    sids, stars, iaps = {}, {}, {}
    for pr in ds['procedures']:
        if pr.get('qa') == 'reject':
            continue
        ident = proc_ident(pr)
        rw = f".RW{pr['runway']}" if pr.get('runway') else ''
        legs = legs_app(pr, extra, set(ds['fixes']))
        if not legs:
            continue
        tr = pr.get('transition')
        sfx = f".{tr}" if tr and re.fullmatch(r'[A-Z]{5}', tr) else rw
        if pr['type'] == 'SID':
            _put(sids, ident + sfx, legs)
        elif pr['type'] == 'STAR':
            _put(stars, ident + sfx, legs)
        elif pr['type'] == 'IAP':
            t = pr.get('transition') or ''
            m = re.match(r'(?:via|from)\s+([A-Z]{5})', t)
            key = ident if not m or 'to SOONA' in t or '(MAHF)' in t or t.startswith('via ' + (pr['legs'][0].get('fix') or '?') + '(IF)') else f"{ident}.{m.group(1)}"
            if pr['coding'].startswith('AIP fix/point') and m:
                key = f"{ident}.{m.group(1)}"
            _put(iaps, key, legs)
    P['sids'][icao] = sids; P['stars'][icao] = stars; P['iaps'][icao] = iaps
    # terminal waypoints
    navids = {n.get('ident') for n in ds['navaids']}
    tw = [w for w in app.get('terminalWaypoints', []) if w.get('region') != icao]
    for k, v in ds['fixes'].items():
        if k in navids or re.match(r'^RW\d{2}[LRC]?$', k) or k.startswith('THR'):
            continue
        tw.append({'id': k, 'name': k, 'lat': v['pos'][0], 'lon': v['pos'][1], 'type': 'AIP', 'region': icao})
    for e in extra:
        e['region'] = icao; tw.append(e)
    app['terminalWaypoints'] = tw
    # holdings
    hfix = {h['fix'] for h in ds['holdings']}
    hold = [h for h in app.get('holdings', []) if h.get('waypoint') not in hfix]
    seen = set()
    for h in ds['holdings']:
        key = (h['fix'], h.get('course_mag'))
        if key in seen or not h.get('latlon'):
            continue
        seen.add(key)
        a = [x[1] for x in (h.get('alt_c') or []) if x[0] != 'FL']
        sp = re.search(r'(\d{3})', h.get('speed') or '')
        hold.append({'waypoint': h['fix'], 'name': h['fix'], 'lat': h['latlon'][0], 'lon': h['latlon'][1],
                     'inbound_course': h.get('course_mag'), 'turn': h.get('turn') or 'R', 'leg_time': h.get('time_min') or (None if h.get('dist_nm') else 1),
                     'leg_length': h.get('dist_nm'), 'speed': int(sp.group(1)) if sp else None,
                     'min_alt': min(a) if a else None, 'max_alt': max(a) if a else None, 'source': 'AIP'})
    app['holdings'] = hold
    # airport / runways
    for apt in app.get('airports', []):
        if apt.get('icao') != icao:
            continue
        a = ds['airport']
        if a.get('arp'):
            apt['lat'], apt['lon'] = a['arp']
        if a.get('magvar'):
            apt['mag_var'] = a['magvar']['deg']
        byid = {f"RW{r['id']}": r for r in ds['runways']}
        for r in apt.get('runways', []):
            src = byid.get(r.get('id'))
            if src and src.get('thr'):
                r['lat'], r['lon'] = src['thr']; r['heading_true'] = src['true_brg']
                if src.get('len_m'): r['length_m'] = src['len_m']
                if src.get('width_m'): r['width_m'] = src['width_m']
        apt['data_source'] = 'AIP'
    md = app.setdefault('metadata', {})
    md.setdefault('aip_airports', {})[icao] = {'airac': airac, 'built_at': ds['built_at'],
                                              'sources': [s['file'] for s in ds['sources']],
                                              'issues': len([i for i in ds['issues'] if i['level'] in ('warn', 'error')])}
    md['source'] = 'eAIP Korea (AIP 차트 자동판독) — 미전환 공항은 기존 데이터 유지'
    md['updated'] = datetime.datetime.utcnow().isoformat() + 'Z'
    return app
