"""ENR 4.4 (name-code designators) / ENR 4.1 (navaids) text → {name: (lat, lon)}."""
import re
import pymupdf as fitz
from .coords import parse_latlon

# ENR 4.4: NAME / 5LNC / [pron] / [한글] / DDMMSSN  DDDMMSSE  (whole seconds, ~30 m)
PT = re.compile(r'(?m)^([A-Z]{5})\n(?:[^\n]*\n){0,4}?(\d{6}(?:\.\d+)?\s*[NS])\s+(\d{7}(?:\.\d+)?\s*[EW])')
# ENR 4.1: NAME / TYPE / (VAR) / ID / FREQ / (CH) / hours / lat / lon
NAV = re.compile(r'(?m)^([A-Z]{3})\n(?:[^\n]*\n){1,4}?(\d{6}(?:\.\d+)?[NS])\n(\d{7}(?:\.\d+)?[EW])')

def is_enr(path):
    try:
        t = fitz.open(path)[0].get_text()
    except Exception:
        return False
    return bool(re.search(r'ENR\s*4\.[14]', t))

def _p0(path):
    try:
        return fitz.open(path)[0].get_text()
    except Exception:
        return ''

def is_enr54(path):
    return bool(re.search(r'ENR\s*5\.4\s+AIR NAVIGATION OBSTACLES', _p0(path)))

def is_enr_other(path):
    return bool(re.search(r'\bENR\s*[0-9]\.\d+\s*-\s*\d', _p0(path)[:300]))

def parse(path):
    out = {}
    for p in fitz.open(path):
        t = p.get_text()
        for m in list(PT.finditer(t)) + list(NAV.finditer(t)):
            ll = parse_latlon(m.group(2) + ' ' + m.group(3))
            if ll:
                out[m.group(1)] = ll
    return out
