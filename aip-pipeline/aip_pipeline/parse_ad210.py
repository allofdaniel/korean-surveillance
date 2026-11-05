"""AD 2.10 AERODROME OBSTACLES (Area 2 / Area 3 tables in AD 2 TEXT) -> obstacle records.

Rows look like:  RKSIOB001 / Pylon / 373203.9N / 1262255.8E / 428 ft/ 25 ft / Marked/LGTD / remarks
"""
from __future__ import annotations
import re
from .coords import parse_latlon
from .parse_ad2text import load_text

IDRE = re.compile(r'\b(RK[A-Z]{2}OB\d{3,4}[A-Z]?)\b')
LL = re.compile(r'(\d{6}(?:\.\d+)?)\s*([NS])\s*(\d{7}(?:\.\d+)?)\s*([EW])')
EH = re.compile(r'(?:(\d{1,2}\s\d{3}|\d{1,4}(?:\.\d+)?)\s*(ft|m)\s*/?\s*)?(?:/\s*(\d{1,2}\s\d{3}|\d{1,4}(?:\.\d+)?)\s*(ft|m))?')

def _text(path):
    if path.lower().endswith(('.html', '.htm')):
        return load_text(path)
    import pymupdf as fitz
    return '\n'.join(p.get_text('text') for p in fitz.open(path))

def parse(path: str):
    t = _text(path)
    i = t.find('AD 2.10')
    j = t.find('AD 2.11', i + 10)
    sec = t[i:j if j > i else i + 200000]
    one = re.sub(r'\s+', ' ', sec)
    marks = [(m.start(), m.group(1)) for m in re.finditer(r'In Area (\d)', one)]
    ids = list(IDRE.finditer(one))
    out, seen = [], set()
    for n, m in enumerate(ids):
        oid = m.group(1)
        seg = one[m.end(): ids[n + 1].start() if n + 1 < len(ids) else len(one)]
        g = LL.search(seg)
        if oid in seen or not g:
            continue
        ll = parse_latlon(f'{g.group(1)}{g.group(2)} {g.group(3)}{g.group(4)}')
        e = None
        for e_ in EH.finditer(seg, g.end()):
            if e_.group(1) or e_.group(3):
                e = e_
                break
            if e_.start() > g.end() + 40:
                break
        if not ll or not e:
            continue
        seen.add(oid)
        k = 0.3048 if (e.group(2) or e.group(4)) == 'ft' else 1.0
        elev = float(e.group(1).replace(' ', '')) * k if e.group(1) else None
        hgt = float(e.group(3).replace(' ', '')) * (0.3048 if e.group(4) == 'ft' else 1.0) if e.group(3) else None
        typ = re.sub(r'\s+', ' ', seg[:g.start()]).strip(' /-')
        rest = seg[e.end():].strip()
        mk = re.match(r'(NIL|Marked\s*/\s*LGTD|Marked|LGTD|-)', rest)
        area = next((a for pos, a in reversed(marks) if pos < m.start()), None)
        out.append({'id': oid, 'type': typ[:40] or None, 'lat': ll[0], 'lon': ll[1], 'elev_m': round(elev, 1) if elev is not None else None,
                    'hgt_m': round(hgt, 1) if hgt else None, 'marking': mk.group(1).replace(' ', '') if mk else None,
                    'remarks': re.split(r'In Area \d|OFFICE OF|Change ?:|A I P|Remarks \d|RK[A-Z]{2} AD', rest[mk.end():] if mk else rest)[0].strip()[:120] or None, 'area': area, 'source': 'AD 2.10'})
    return out
