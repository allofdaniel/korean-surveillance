import re
import pymupdf as fitz
from .docs import CHART_RE, AMDT_RE

PAT = re.compile(r"(\d{1,3})\s+(\d{2})°\s?(\d{2})'\s?([\d.]+)\"\s?N\s+(\d{3})°\s?(\d{2})'\s?([\d.]+)\"\s?E\s+([\d.]+)\s+((?:[A-Z][a-z]+)(?: [a-z]+){0,3})")

def parse(path: str):
    doc = fitz.open(path)
    out = []
    for page in doc:
        t = page.get_text('text')
        if not PAT.search(t):
            t = page.get_text('text', sort=True)
        m = CHART_RE.search(t); a = AMDT_RE.search(t)
        chart = re.sub(r'\s+', '', m.group(2)) if m else None
        for g in PAT.finditer(t):
            n, a1, b1, c1, d1, e1, f1, el, typ = g.groups()
            lat = int(a1) + int(b1) / 60 + float(c1) / 3600
            lon = int(d1) + int(e1) / 60 + float(f1) / 3600
            out.append({'icao': m.group(1) if m else None, 'chart': chart, 'amdt': a.group(1) if a else None,
                        'no': int(n), 'lat': round(lat, 7), 'lon': round(lon, 7), 'elev_m': float(el), 'type': typ.strip()})
    # de-dup (same chart, same no)
    seen = {}
    for o in out:
        seen[(o['chart'], o['no'], round(o['lat'], 5))] = o
    return list(seen.values())
