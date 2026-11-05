"""ENR 4.4 (name-code designators) / ENR 4.1 (navaids) text → {name: (lat, lon)}."""
import re
import pymupdf as fitz
from .coords import parse_latlon

PT = re.compile(r'\b([A-Z]{5})\b[^\n]{0,40}?(\d{6}(?:\.\d+)?\s*[NS])\s*(\d{7}(?:\.\d+)?\s*[EW])')

def is_enr(path):
    try:
        t = fitz.open(path)[0].get_text()
    except Exception:
        return False
    return bool(re.search(r'ENR\s*4\.[14]', t))

def parse(path):
    out = {}
    for p in fitz.open(path):
        t = p.get_text()
        for m in PT.finditer(t):
            ll = parse_latlon(m.group(2) + ' ' + m.group(3))
            if ll:
                out[m.group(1)] = ll
    return out
