import re
import pymupdf as fitz
from .docs import CHART_RE, AMDT_RE

PAT = re.compile(r"(\d{1,3})\s+(\d{2})°\s?(\d{2})'\s?([\d.]+)\"\s?N\s+(\d{3})°\s?(\d{2})'\s?([\d.]+)\"\s?E\s+([\d.]+)\s+((?:[A-Z][a-z]+)(?: [a-z]+){0,3})")

# one field per line, hemisphere letters optional: "1 / 34°56'56.71" / 126°23'29.49" / 87.5 / Natural high point"
PAT2 = re.compile(r"(?m)^([A-Z]?\d{1,3})\n\s*(\d{2})°\s?(\d{2})'\s?([\d.]+)\"\s?N?\s*\s*(\d{3})°\s?(\d{2})'\s?([\d.]+)\"\s?E?\s*\n\s*([\d.]+)\s*\n\s*([A-Za-z][A-Za-z ,/()-]{2,40})")

def parse(path: str):
    doc = fitz.open(path)
    out = []
    for page in doc:
        raw = page.get_text('text')
        hits = list(PAT.finditer(raw)) or list(PAT2.finditer(raw))
        if not hits:
            raw = page.get_text('text', sort=True)
            hits = list(PAT.finditer(raw))
        m = CHART_RE.search(raw); a = AMDT_RE.search(raw)
        chart = re.sub(r'\s+', '', m.group(2)) if m else None
        for g in hits:
            n, a1, b1, c1, d1, e1, f1, el, typ = g.groups()
            lat = int(a1) + int(b1) / 60 + float(c1) / 3600
            lon = int(d1) + int(e1) / 60 + float(f1) / 3600
            if not (33 <= lat <= 39 and 124 <= lon <= 132):
                continue
            out.append({'icao': m.group(1) if m else None, 'chart': chart, 'amdt': a.group(1) if a else None,
                        'no': n, 'lat': round(lat, 7), 'lon': round(lon, 7), 'elev_m': float(el), 'type': typ.strip()})
    seen = {}
    for o in out:
        seen[(o['chart'], o['no'], round(o['lat'], 5))] = o
    return list(seen.values())
