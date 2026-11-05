import re

_DMS = re.compile(r"(\d{1,3})\s*[°º˚*o]\s*(\d{1,2})\s*['’`′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:\"|''|”|″|')?\s*[_\-—\s]*([NSEW])")
_CLAT = re.compile(r"(?<!\d)(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])")
_CLON = re.compile(r"(?<!\d)(\d{3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])")

def _dd(d, m, s, h):
    v = int(d) + int(m) / 60 + float(str(s).replace(',', '.')) / 3600
    return -v if h in 'SW' else v

def parse_latlon(text: str):
    """Return (lat, lon) from AIP coordinate text (DMS with symbols or compact DDMMSS.ssN), else None."""
    if not text:
        return None
    t = text.replace('lY', 'IY')
    # degree sign lost/displaced in text extraction: "35 34'59.5\"N ... ° °"
    t = re.sub(r'(?<![\d.])(\d{2,3})\s+(\d{2})\s*[\'′]', lambda m: f"{m.group(1)}°{m.group(2)}'", t)
    lat = lon = None
    for m in _DMS.finditer(t):
        d, mi, s, h = m.groups()
        if h in 'NS' and lat is None and int(d) < 90:
            lat = _dd(d, mi, s, h)
        elif h in 'EW' and lon is None:
            lon = _dd(d, mi, s, h)
    if lat is None or lon is None:
        a = _CLAT.search(t); b = _CLON.search(t)
        if a and lat is None:
            lat = _dd(*a.groups())
        if b and lon is None:
            lon = _dd(*b.groups())
    if lat is None or lon is None:
        return None
    if not (20 < lat < 45 and 115 < lon < 140):  # Korea region sanity
        return None
    return (round(lat, 9), round(lon, 9))

def dms_str(lat, lon, prec=2):
    def f(v, w, hs):
        h = hs[0] if v >= 0 else hs[1]; v = abs(v)
        d = int(v); m = int((v - d) * 60); s = (v - d - m / 60) * 3600
        return f"{d:0{w}d}{m:02d}{s:0{3+prec}.{prec}f}{h}"
    return f(lat, 2, 'NS') + ' ' + f(lon, 3, 'EW')
