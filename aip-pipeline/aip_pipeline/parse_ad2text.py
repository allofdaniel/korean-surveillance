"""Parse 'RKxx AD 2' text section (PDF with real text, or saved HTML text)."""
from __future__ import annotations
import re
import pymupdf as fitz
from .coords import parse_latlon

def load_text(path: str) -> str:
    if path.lower().endswith(('.html', '.htm')):
        from bs4 import BeautifulSoup
        return BeautifulSoup(open(path, encoding='utf-8', errors='replace').read(), 'html.parser').get_text('\n')
    doc = fitz.open(path)
    return '\n'.join(p.get_text('text', sort=True) for p in doc)

def _section(t, num):
    m = re.search(rf'AD\s*2\.{num}\b(.*?)(?=AD\s*2\.{num + 1}\b|$)', t, re.S)
    return m.group(1) if m else ''

def parse(path: str) -> dict:
    t = load_text(path)
    icao = re.search(r'\b(RK[A-Z]{2})\s+AD\s+2\.1\b', t)
    out = {'icao': icao.group(1) if icao else None, 'issues': []}
    s2 = _section(t, 2)
    arp = re.search(r'ARP coordinates.*?(\d{6}(?:\.\d+)?\s*[NS])\s*(\d{7}(?:\.\d+)?\s*[EW])', s2, re.S)
    out['arp'] = parse_latlon(arp.group(1) + ' ' + arp.group(2)) if arp else None
    el = re.search(r'Elevation.*?(\d+(?:\.\d+)?)\s*m', s2, re.S)
    out['elev_m'] = float(el.group(1)) if el else None
    mv = re.search(r'MAG VAR.*?(\d+(?:\.\d+)?)\s*°\s*([EW])\s*\((\d{4})\)(?:\s*/\s*([\d.]+)\s*°\s*(\w+))?', s2, re.S)
    if mv:
        out['magvar'] = {'deg': float(mv.group(1)) * (-1 if mv.group(2) == 'W' else 1), 'year': int(mv.group(3)),
                         'annual': float(mv.group(4)) if mv.group(4) else None}
    # AD 2.12 runways
    s12 = _section(t, 12)
    rwys = []
    for m in re.finditer(r'(?m)^\s*(\d{2}[LRC]?)\s+(\d{3}\.\d{1,2})°\s+([\d\s]+?)\s*[×x]\s*(\d+)', s12):
        rid, tb, ln, wd = m.groups()
        seg = s12[m.start(): m.start() + 600]
        ll = parse_latlon(seg)
        e = re.search(r'THR\s+(\d+(?:\.\d+)?)\s*m', seg)
        rwys.append({'id': rid, 'true_brg': float(tb), 'len_m': int(ln.replace(' ', '')), 'width_m': int(wd),
                     'thr': ll, 'thr_elev_m': float(e.group(1)) if e else None})
    out['runways'] = rwys
    # AD 2.17 CTR
    s17 = _section(t, 17)
    c = re.search(r'circle,\s*radius\s*(\d+(?:\.\d+)?)\s*NM\s*centered\s*at\s*(\w+)', s17, re.I)
    out['ctr'] = {'radius_nm': float(c.group(1)), 'center': c.group(2)} if c else None
    # AD 2.19 navaids
    s19 = _section(t, 19)
    navs = []
    pat = re.compile(r'(?m)^\s*(VOR/DME|VORTAC|VOR|DME|NDB|LOC|GP|ILS/DME|LLZ|TACAN)\s*([0-9]{2}[LRC]?)?\s+([A-Z]{2,4}|-)?\s+([\d.]+\s*(?:MHz|KHz|kHz))')
    for m in pat.finditer(s19):
        seg = s19[m.start(): m.start() + 400]
        ll = parse_latlon(seg)
        decl = re.search(r'\((\d+(?:\.\d+)?)°\s*([EW])', s19[max(0, m.start() - 10): m.start() + 200])
        navs.append({'type': m.group(1) + (f' {m.group(2)}' if m.group(2) else ''), 'ident': None if m.group(3) in (None, '-') else m.group(3),
                     'freq': m.group(4), 'latlon': ll,
                     'decl': (float(decl.group(1)) * (-1 if decl.group(2) == 'W' else 1)) if decl else None})
    out['navaids'] = navs
    # AD 2.10 obstacles
    s10 = _section(t, 10)
    obs = []
    for m in re.finditer(r'(\d{6}(?:\.\d+)?N)\s*\n?\s*(\d{7}(?:\.\d+)?E)', s10):
        obs.append({'latlon': parse_latlon(m.group(1) + ' ' + m.group(2))})
    out['ad210_obstacles'] = obs
    amdt = re.findall(r'(?:AIRAC\s+)?AIP\s+AMDT\s+\d+/\d+', t)
    out['amdt'] = sorted(set(amdt))
    return out
