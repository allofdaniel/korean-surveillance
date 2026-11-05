"""Conventional (radial/DME) procedure descriptions → construction steps → geometry."""
from __future__ import annotations
import re
from .geo import fwd, inv, intersect, point_at_dme

NUM = {'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4', 'FIVE': '5', 'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9'}

def split_departures(text: str):
    """Return {procedure_name: description_text} from OCR'd SID chart text."""
    t = re.sub(r'[ \t]+', ' ', text)
    heads = list(re.finditer(r'\b([A-Z]{5})\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)\s+([A-Z]+)\s+DEPAR?TURE', t))
    out = {}
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(t)
        body = t[h.end(): end]
        body = body.split('* Restrictions')[0] if '* Restrictions' in body else body
        # keep only the sentences of the description
        sent = ' '.join(re.findall(r'(?:Climb|then|Then|proceed|turn|Turn)[^.]*\.', body.replace('\n', ' ')))
        name = f"{h.group(1)} {NUM[h.group(2)]}{h.group(3)[0]}"
        out[name] = {'text': sent.strip(), 'restrictions': re.findall(r'\d\.\s*([^\n]+)', body)[:5]}
    return out

def build(desc: str, der, rwy_true_brg: float, navs: dict, fixes: dict, var_deg: float):
    """Returns (points, approx_flag, steps). var_deg: east positive (W = negative). true = mag + var."""
    pts = [der]; approx = False; steps = []
    def T(mag): return (mag + var_deg) % 360
    cur = der; cur_brg = rwy_true_brg
    s = re.sub(r'\s+', ' ', desc)
    for clause in re.split(r',\s*then\s+|\.\s*Then\s+|\.\s*then\s+', s):
        c = clause.strip().rstrip('.')
        m = re.search(r'Climb on R\s*(\d{3})\s*([A-Z]{3})\s*until\s*\2\s*D\s*(\d+(?:\.\d+)?)', c)
        if m:
            nav = navs[m.group(2)]; p = fwd(nav, T(int(m.group(1))), float(m.group(3)))
            pts.append(p); cur = p; cur_brg = T(int(m.group(1))); steps.append(c); continue
        m = re.search(r'Climb on RWY HDG until ([A-Z]{3})\s*D\s*(\d+(?:\.\d+)?)', c)
        if m:
            p = point_at_dme(cur, rwy_true_brg, navs[m.group(1)], float(m.group(2)))
            if p: pts.append(p); cur = p; steps.append(c)
            approx = True; continue
        m = re.search(r'turn (?:Left|Right|left|right)\s+direct to ([A-Z]{3})(?:\s+via R\s*(\d{3}))?', c)
        if m:
            nav = navs[m.group(1)]
            if m.group(2):  # arc of the turn is not defined → add a mid-point on the radial at 1/2 distance
                d = inv(nav, cur)[1]; pts.append(fwd(nav, T(int(m.group(2))), d * 0.6)); approx = True
            pts.append(nav); cur = nav; steps.append(c); continue
        m = re.search(r'turn (?:Left|Right|left|right)\s+HDG\s*(\d{3})°?\s*to intercept(?: and)?(?: proceed)? on R\s*(\d{3})\s*([A-Z]{3})\s*to\s*([A-Z]{5})', c)
        if m:
            hdg = T(int(m.group(1))); nav = navs[m.group(3)]; rad = T(int(m.group(2)))
            ip = intersect(cur, hdg, nav, rad)
            if ip: pts.append(ip)
            approx = True
            f = fixes.get(m.group(4))
            if f: pts.append(f)
            steps.append(c); continue
        m = re.search(r'proceed on R\s*(\d{3})\s*([A-Z]{3})\s*to\s*([A-Z]{5})', c)
        if m:
            f = fixes.get(m.group(3))
            if f: pts.append(f)
            steps.append(c); continue
        if c:
            steps.append('UNPARSED: ' + c); approx = True
    return pts, approx, steps
