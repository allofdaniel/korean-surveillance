"""Normalize raw table cells into coding legs / holdings / fix-point records."""
from __future__ import annotations
import re
from .coords import parse_latlon

PATHS = {'IF', 'TF', 'CF', 'DF', 'CA', 'FA', 'FC', 'FD', 'FM', 'CD', 'CI', 'CR', 'RF', 'AF', 'VA', 'VD', 'VI', 'VM', 'VR', 'PI', 'HA', 'HF', 'HM'}
COLS = ['serial', 'path', 'fix', 'flyover', 'course', 'dist', 'turn', 'alt', 'speed', 'coords', 'vpa', 'navspec', 'remarks']

def _clean(s: str) -> str:
    s = (s or '').strip().replace('—', '-').replace('–', '-')
    return '' if s in ('-', '.', '_', '•', '·', ']', '|') else s

def fix_ocr_tokens(rec: dict):
    # common OCR confusions
    if rec.get('fix'):
        rec['fix'] = rec['fix'].replace('0', 'O') if re.fullmatch(r'[A-Z0]{5}', rec['fix']) else rec['fix']
    for k in ('alt', 'speed'):
        v = rec.get(k) or ''
        v = v.replace('£', '-').replace('§', '5').replace(' ', ' ')
        rec[k] = v
    return rec

def parse_course(s):
    m = re.search(r'(\d{3})\s*\(\s*(\d{3}(?:[.,]\d)?)\s*\)', s or '')
    return (int(m.group(1)), float(m.group(2).replace(',', '.'))) if m else (None, None)

def parse_float(s):
    m = re.search(r'\d+(?:[.,]\d+)?', s or '')
    return float(m.group(0).replace(',', '.')) if m else None

def parse_alt(s):
    """'@8 000'->[['AT',8000]], '+5 000'->AT_OR_ABOVE, '-9 000'->AT_OR_BELOW, '-5 000 +4 000'->both, 'FL 140'->FL."""
    out = []
    kinds = {'@': 'AT', '+': 'AT_OR_ABOVE', '-': 'AT_OR_BELOW'}
    for sign, num in re.findall(r'(FL\s*|[@+\-])?\s*(\d{1,2}\s\d{3}|\d{3,5})', (s or '').replace(',', '')):
        v = int(num.replace(' ', ''))
        if sign and sign.strip() == 'FL':
            out.append(['FL', v]); continue
        if v < 300 or v > 60000:
            continue
        out.append([kinds.get(sign, 'AT'), v])
    return out

def coding_from_table(tb: dict):
    rows = [[_clean(c) for c in r] for r in tb['rows']]
    recs = []
    for r in rows:
        if len(r) < 10:
            continue
        if not (re.fullmatch(r'\d{3}', r[0] or '') and (r[1] or '').upper() in PATHS):
            continue
        r = (r + [''] * 13)[:13]
        rec = fix_ocr_tokens(dict(zip(COLS, r)))
        rec['path'] = rec['path'].upper()
        rec['course_mag'], rec['course_true'] = parse_course(rec['course'])
        rec['dist_nm'] = parse_float(rec['dist']) if rec['dist'] else None
        rec['alt_c'] = parse_alt(rec['alt'])
        sp = re.search(r'([+\-]?)\s*(\d{3})', rec['speed'] or '')
        rec['speed_c'] = [{'-': 'AT_OR_BELOW', '+': 'AT_OR_ABOVE'}.get(sp.group(1), 'AT'), int(sp.group(2))] if sp else None
        rec['latlon'] = parse_latlon(rec['coords'])
        rec['flyover'] = rec['flyover'].upper().startswith('Y')
        rec['turn'] = (rec['turn'] or '').upper()[:1] if (rec['turn'] or '').upper()[:1] in ('L', 'R') else None
        vpa = re.search(r'(-?\d[.,]\d{2})\s*/\s*(\d{2})', rec['vpa'] or '')
        rec['vpa_deg'], rec['rdh_ft'] = (float(vpa.group(1).replace(',', '.')), int(vpa.group(2))) if vpa else (None, None)
        recs.append(rec)
    return recs

def holdings_from_table(tb: dict):
    rows = [[_clean(c) for c in r] for r in tb['rows']]
    out, idents = [], []
    for r in rows:
        if 'HM' not in [x.upper() for x in r[:3]]:
            continue
        i = [x.upper() for x in r].index('HM')
        ident = ' '.join(r[:i]).strip() or None
        rest = (r[i:] + [''] * 12)[:12]
        rec = {'ident': ident, 'path': 'HM', 'fix': rest[1], 'flyover': rest[2].upper().startswith('Y'),
               'course': rest[3], 'time_min': parse_float(rest[4]), 'turn': (rest[5] or '').upper()[:1] or None,
               'alt': rest[6], 'speed': rest[7], 'coords': rest[8], 'navspec': rest[10]}
        rec = fix_ocr_tokens(rec)
        rec['course_mag'], rec['course_true'] = parse_course(rec['course'])
        rec['alt_c'] = parse_alt(rec['alt']); rec['latlon'] = parse_latlon(rec['coords'])
        out.append(rec)
    # fill merged identification cells
    for k, rec in enumerate(out):
        if not rec['ident']:
            near = [o['ident'] for o in out if o['ident']]
            rec['ident'] = near[0] if len(near) == 1 else (out[k - 1]['ident'] if k and out[k - 1]['ident'] else (near[0] if near else None))
    return out

FIXNAME = re.compile(r'^(?P<name>D\d+(?:\.\d+)?\s+[A-Z]{2,5}|THR\s+RWY\s*\d{2}[LRC]?|[A-Z][A-Z0-9]{1,4}(?:\s+(?:VOR/DME|VORTAC|DME|LOC|VOR|NDB|GP))?)\s*(?:\((?P<role>[^)]*)\))?\s*(?P<defn>.*)$')

def fixpoints_from_table(tb: dict):
    rows = [[_clean(c) for c in r] for r in tb['rows']]
    title = ''
    out = []
    for r in rows:
        txt = ' '.join(x for x in r if x)
        if len(r) == 1 and 'Approach' in txt or 'Approach to RWY' in txt and not parse_latlon(txt):
            title = txt; continue
        if len(r) < 2:
            continue
        ll = parse_latlon(r[-1]) or parse_latlon(txt)
        if not ll:
            continue
        name_txt = r[0].replace('lYS', 'IYS').replace('lY', 'IY')
        m = FIXNAME.match(name_txt)
        if not m:
            continue
        name = re.sub(r'\s+', ' ', m.group('name')).strip()
        role = (m.group('role') or '').strip() or None
        defn = m.group('defn').strip() or None
        out.append({'name': name, 'role': role, 'defn': defn, 'latlon': ll})
    return title or tb.get('title', ''), out

def classify(tb: dict) -> str:
    flat = ' '.join(' '.join(r) for r in tb['rows'][:3])
    if any(len(r) >= 10 and re.fullmatch(r'\d{3}', (r[0] or '').strip()) for r in tb['rows']):
        return 'coding'
    if any('HM' in [c.strip().upper() for c in r[:3]] for r in tb['rows']):
        return 'holding'
    if 'Fix/point' in flat or 'Approach to RWY' in flat or ('Coordinates' in flat and len(tb['rows'][0]) <= 3):
        return 'fixpoint'
    return 'other'
