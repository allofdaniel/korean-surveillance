"""Unify aerodrome obstacles from AD 2.10 (TEXT), Type A and Type B charts; export for the app."""
from __future__ import annotations
import re
from .geo import inv

CATS = [  # app colour categories (src/utils/colors.ts OBSTACLE_COLORS)
    ('Natural', r'natural|peak|mountain|hill|terrain'),
    ('Tree', r'tree|forest|shrub'),
    ('Navaid', r'\b(loc|gp|glide|dme|vor|tacan|ils|ndb|radar|asr|par|navaid|rtil|als|papi|rvr|nfm|marker)\b'),
    ('Antenna', r'antenna|aerial'),
    ('Chimney', r'chimney|stack'),
    ('Mast', r'mast|light pole|lighting|\blight\b|lamp|cctv|pole'),
    ('Tower', r'tower|pylon|steel|turbine|crane|bridge|transmission'),
    ('Building', r'building|structure|shelter|house|hangar|fence|wall|dike|box|tank|church|factory|apartment'),
]

def category(t):
    s = (t or '').lower()
    for name, pat in CATS:
        if re.search(pat, s):
            return name
    return 'Unknown'

def clean_type(t):
    t = re.split(r'\s+(?:A I P|OFFICE OF|NR\b|NOTE\b|ELEV\b)', t or '')[0].strip(' ,/-')
    return t[:1].upper() + t[1:] if t else None

def unify(icao, ad210, charts, ad_elev_m=None):
    """Merge sources; the same obstacle (<=15 m apart, elevation within 2 m, different documents) is kept once with all sources."""
    recs = []
    for o in ad210:
        e = o['elev_m']
        est = False
        if e is None and o.get('hgt_m') is not None and ad_elev_m is not None:
            e, est = round(ad_elev_m + o['hgt_m'], 1), True
        recs.append({'id': o['id'], 'lat': o['lat'], 'lon': o['lon'], 'elev_m': e, 'elev_estimated': est,
                     'hgt_m': o.get('hgt_m'), 'type': clean_type(o.get('type')), 'marking': o.get('marking'),
                     'remarks': o.get('remarks'), 'sources': ['AD 2.10' + (f" Area {o['area']}" if o.get('area') else '')]})
    for o in charts:
        src = f"AD CHART {o.get('chart') or '?'}" + (f" #{o['no']}" if o.get('no') else '')
        hit = None
        chart_id = f"AD CHART {o.get('chart') or '?'}"
        for r in recs:
            if any(x.startswith(chart_id + ' #') for x in r['sources']):
                continue                       # entries of the same chart table are distinct obstacles
            if inv((r['lat'], r['lon']), (o['lat'], o['lon']))[1] * 1852 <= 15 and (r['elev_m'] is None or abs(r['elev_m'] - o['elev_m']) <= 2):
                hit = r
                break
        if hit:
            hit['sources'].append(src)
            if hit['elev_m'] is None or hit.get('elev_estimated'):
                hit['elev_m'], hit['elev_estimated'] = o['elev_m'], False
            continue
        recs.append({'id': f"{icao}-{o.get('chart') or 'X'}-{o.get('no')}", 'lat': o['lat'], 'lon': o['lon'],
                     'elev_m': o['elev_m'], 'elev_estimated': False, 'hgt_m': None, 'type': clean_type(o.get('type')),
                     'marking': None, 'remarks': None, 'sources': [src]})
    for r in recs:
        r['category'] = category(r['type'])
        r['airport'] = icao
    return recs

def to_app(recs):
    out = []
    for r in recs:
        if r['elev_m'] is None:
            continue
        out.append({'id': r['id'], 'ident': r['id'], 'lat': r['lat'], 'lon': r['lon'],
                    'height_m': r['elev_m'], 'height_ft': round(r['elev_m'] / 0.3048),
                    'agl_m': r.get('hgt_m'), 'type': r['category'], 'name': r['type'],
                    'airport': r['airport'], 'source': 'AIP ' + ', '.join(r['sources'])})
    return out
