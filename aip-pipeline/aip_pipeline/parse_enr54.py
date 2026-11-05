"""ENR 5.4 AIR NAVIGATION OBSTACLES - EN-ROUTE (height 100 m AGL or higher).

Row: NR / area (district) / type / DDMMSSN DDDMMSSE / ELEV/HGT (m, 'Unknown' allowed) / lighting
"""
from __future__ import annotations
import re
import pymupdf as fitz

ROW = re.compile(
    r'(?<![\d/])(\d{1,4})\s+'
    r'([A-Z][A-Za-z\-]+(?:\s+[A-Z][A-Za-z\-]+)?)\s*'          # area
    r'(?:\(([^)]{1,30})\)\s*)?'                                # (district)
    r'(?:Unknown\s+)?'
    r'([A-Za-z][A-Za-z /&\-]{1,30}?)\s+'                        # type
    r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])\s+(\d{3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])\s*'
    r'(Unknown|\d{1,4}(?:\.\d+)?)\s*/\s*(Unknown|\d{1,4}(?:\.\d+)?)\s*'
    r'([A-Za-z/& ]{0,20}?)(?=\s+\d{1,4}\s+[A-Z]|\s*※|\s*Change|\s*OFFICE|\s*A I P|$)')

def _dd(d, m, s, h):
    v = int(d) + int(m) / 60 + min(float(s), 59.99) / 3600
    return -v if h in 'SW' else v

CO = re.compile(r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])\s+(\d{3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])')
EH = re.compile(r'(Unknown|\d{1,4}(?:\.\d+)?)\s*/\s*(Unknown|\d{1,4}(?:\.\d+)?)')

def parse(path: str):
    out, region = [], None
    for page in fitz.open(path):
        lines = [l.replace('\u3000', ' ').strip() for l in page.get_text('text').split('\n')]
        lines = [l for l in lines if l]
        for l in lines[:12]:
            m = re.match(r'^([A-Z][A-Z ]+AREA)$', l)
            if m:
                region = m.group(1).title()
        i = 0
        while i < len(lines):
            if re.fullmatch(r'\d{1,4}', lines[i]):
                # gather fields until the coordinate line
                j, fields = i + 1, []
                while j < len(lines) and j < i + 8 and not CO.search(lines[j]) and not re.fullmatch(r'\d{1,4}', lines[j]):
                    fields.append(lines[j]); j += 1
                if j < len(lines) and CO.search(lines[j]) and fields:
                    c = CO.search(lines[j])
                    tail = lines[j][c.end():] + ' ' + ' '.join(lines[j + 1:j + 3])
                    e = EH.search(tail)
                    if e:
                        g = c.groups()
                        lat, lon = _dd(*g[0:4]), _dd(*g[4:8])
                        area = fields[0]
                        dist = next((f.strip('()') for f in fields[1:] if f.startswith('(')), None)
                        typ = [f for f in fields[1:] if not f.startswith('(') and f != 'Unknown']
                        typ = typ[-1] if typ else None
                        rest = tail[e.end():].strip().split(' ')
                        lgt = ' '.join(x for x in rest[:3] if re.match(r'^(OBST|Unknown|NIL|W|R|&|LGT|Red|White)', x)) or None
                        if 33 <= lat <= 39 and 124 <= lon <= 132:
                            out.append({'id': f"ENR54-{(region or 'X').replace(' ', '').replace('Area', '')}-{lines[i]}",
                                        'region': region, 'area': area, 'district': dist, 'type': typ,
                                        'lat': round(lat, 6), 'lon': round(lon, 6),
                                        'elev_m': None if e.group(1) == 'Unknown' else float(e.group(1)),
                                        'hgt_m': None if e.group(2) == 'Unknown' else float(e.group(2)),
                                        'lighting': lgt, 'source': 'ENR 5.4'})
                        i = j + 1
                        continue
            i += 1
    seen, uniq = set(), []
    for o in out:
        k = (o['id'], o['lat'], o['lon'])
        if k not in seen:
            seen.add(k); uniq.append(o)
    return uniq
