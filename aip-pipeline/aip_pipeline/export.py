import json, math
from .geo import fwd

def _f(geom, props):
    return {'type': 'Feature', 'geometry': geom, 'properties': props}

def to_geojson(ds):
    feats = []
    a = ds['airport']
    if a.get('arp'):
        feats.append(_f({'type': 'Point', 'coordinates': [a['arp'][1], a['arp'][0]]}, {'kind': 'ARP', 'icao': ds['icao'], 'elev_m': a.get('elev_m')}))
        ctr = a.get('ctr')
        if ctr and ctr.get('center') == 'ARP':
            ring = [list(reversed(fwd(a['arp'], b, ctr['radius_nm']))) for b in range(0, 361, 5)]
            feats.append(_f({'type': 'Polygon', 'coordinates': [ring]}, {'kind': 'CTR', 'icao': ds['icao'], 'radius_nm': ctr['radius_nm']}))
    if len(ds['runways']) >= 2 and all(r.get('thr') for r in ds['runways'][:2]):
        r1, r2 = ds['runways'][:2]
        feats.append(_f({'type': 'LineString', 'coordinates': [[r1['thr'][1], r1['thr'][0]], [r2['thr'][1], r2['thr'][0]]]},
                        {'kind': 'RWY', 'icao': ds['icao'], 'name': f"{r1['id']}/{r2['id']}"}))
    for n in ds['navaids']:
        if n.get('latlon'):
            feats.append(_f({'type': 'Point', 'coordinates': [n['latlon'][1], n['latlon'][0]]},
                            {'kind': 'NAVAID', 'icao': ds['icao'], 'name': n.get('ident') or n['type'], 'navtype': n['type'], 'freq': n.get('freq')}))
    navid = {n.get('ident') for n in ds['navaids']}
    for k, v in ds['fixes'].items():
        if k in navid or k.startswith('RW'):
            continue
        feats.append(_f({'type': 'Point', 'coordinates': [v['pos'][1], v['pos'][0]]}, {'kind': 'FIX', 'icao': ds['icao'], 'name': k, 'src': '; '.join(v['sources'][:3])}))
    for pr in ds['procedures']:
        c = pr.get('coords') or []
        if len(c) >= 2:
            legs = [{k: L.get(k) for k in ('serial', 'path', 'fix', 'course', 'dist_nm', 'alt', 'speed', 'turn', 'flyover', 'role') if L.get(k) not in (None, '', False)} for L in pr['legs']]
            feats.append(_f({'type': 'LineString', 'coordinates': [[p[1], p[0]] for p in c]},
                            {'kind': pr['type'], 'icao': ds['icao'], 'name': pr['name'], 'transition': pr.get('transition'), 'runway': pr.get('runway'),
                             'coding': pr['coding'], 'approx': pr.get('approx', False), 'src': pr['source'], 'legs': json.dumps(legs, ensure_ascii=False)}))
    for h in ds['holdings']:
        if h.get('latlon'):
            feats.append(_f({'type': 'Point', 'coordinates': [h['latlon'][1], h['latlon'][0]]},
                            {'kind': 'HOLD', 'icao': ds['icao'], 'name': h['fix'], 'ident': h.get('ident'), 'inbound': h.get('course'), 'turn': h.get('turn'), 'alt': h.get('alt'), 'speed': h.get('speed')}))
    for o in ds['obstacles']:
        feats.append(_f({'type': 'Point', 'coordinates': [o['lon'], o['lat']]},
                        {'kind': 'OBST', 'icao': ds['icao'], 'id': o['id'], 'elev_m': o['elev_m'], 'hgt_m': o.get('hgt_m'),
                         'obst_type': o['type'], 'category': o.get('category'), 'marking': o.get('marking'), 'src': ', '.join(o['sources'])}))
    return {'type': 'FeatureCollection', 'features': feats}
