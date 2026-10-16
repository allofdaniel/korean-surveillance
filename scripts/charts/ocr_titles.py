#!/usr/bin/env python3
"""Name chart sheets whose procedure title is drawn as outlines (no text layer).

    python3 ocr_titles.py <cache_dir> <public_dir>

build_chart_index.py names sheets from the PDF text layer. On many Korean charts the title box
("ILS/DME RWY 04R", "SEOUL 1 · RWY 01/02") is vector outlines, so those sheets came out as
"INSTR APCH CHART (7)" or "SID (3)". This pass OCRs just the title corner (top-right) of those
pages with tesseract and rewrites `name` / `chartNo` in charts/aip_index.json in place.
Continuation pages that carry only the page header inherit the previous sheet's name.
"""
import json, os, re, subprocess, sys, tempfile
import pymupdf

GENERIC = re.compile(r'^(INSTR APCH CHART|SID|STAR|RNAV SID|RNAV STAR|AD CHART|VISUAL APCH CHART)( \(\d+\))?$'
                     r'|^(RNAV )?(SID|STAR) RWY [0-9LRC/ ]+( \(\d+\))?$')
NO_RE = re.compile(r'AD\s*CHART\s*([0-9]\s*-\s*[0-9]+(?:\s*-\s*[0-9]+)?)', re.I)
JUNK = re.compile(r'ELEV|ALT IN|DIST IN|BRG|TRANSITION|FREQ|\bAPP\b|\bTWR\b|\bDEP\b|NOT TO SCALE', re.I)


def ocr_corner(page, tmp):
    r = page.rect
    pix = page.get_pixmap(dpi=300, clip=pymupdf.Rect(r.width * 0.70, 0, r.width, r.height * 0.115))
    pix.save(tmp)
    out = subprocess.run(['tesseract', tmp, '-', '--psm', '6'], capture_output=True, text=True).stdout
    return [l.strip() for l in out.splitlines() if l.strip()]


def clean(s):
    s = s.replace('_', ' ')
    s = re.sub(r'^[a-z]{1,3}\s+', '', s)                  # stray lowercase OCR fragments
    s = re.sub(r'^\d{2}[LRC]?(?:/[LRC])?\s+(?=[A-Za-z])', '', s)   # runway spill-over from the line above
    s = re.sub(r'\bRWY\s*O', 'RWY 0', s)
    s = re.sub(r'(?<=\d)O\b', '0', s)
    s = re.sub(r'^[^A-Za-z]+', '', s)                      # leading frequencies / OCR noise
    s = re.sub(r'\s+[^\sA-Za-z0-9/()·,-]+$', '', s)
    s = s.upper()
    s = re.sub(r'^(?:AV|NAV)\s', 'RNAV ', s)               # clipped "RNAV"
    s = re.sub(r'RNAV(?=[A-Z]{3})', 'RNAV ', s)
    s = re.sub(r'\b[IL](?=[A-Z]\b)', '1', s)               # "POVOR IM" -> "POVOR 1M"
    s = re.sub(r'([A-Z]{4,})(\d[A-Z]\b)', r'\1 \2', s)     # "LOSTO2A" -> "LOSTO 2A"
    s = re.sub(r',(?=\S)', ', ', s)
    return re.sub(r'\s{2,}', ' ', s).strip(' .,|')


RWY_TOKEN = re.compile(r'RWY\s*([0-9]{2}[LRC]?(?:\s*/\s*(?:[0-9]{2})?[LRC]?)*)')


def valid_rwy(rwy, runways):
    """Every runway number in 'RWY 15L/R, RWY 16L' must exist at the aerodrome (OCR misreads don't)."""
    nums = re.findall(r'(\d{2})', rwy)
    return bool(nums) and all(n in runways for n in nums) and not re.search(r'RWY\s*[^\d\s]', rwy)


def parse(lines, ctype, old_name, runways):
    no = None
    for l in lines:
        m = NO_RE.search(l)
        if m:
            no = re.sub(r'\s+', '', m.group(1))
            break
    city = next((i for i, l in enumerate(lines) if re.search(r'\(RK[A-Z]{2}\)', l)), None)
    if city is None:
        return no, None
    body = []
    for l in lines[city + 1:city + 4]:
        l = clean(re.sub(r"[EN]?\s*\d{2,3}°\s*\d{1,2}'\s*[NE]?", ' ', l))   # graticule labels in the box
        m = re.match(r'(RWY\s*\S+(?:,\s*RWY\s*\S+)*)\s+(.+)$', l)
        if m:                                                             # "RWY 15L/R RADAR 5S"
            body += [m.group(1), m.group(2)]
        else:
            body.append(l)
    body = [l for l in body if len(l) >= 3 and re.search(r'[A-Za-z]', l) and not JUNK.search(l)]
    rwy = [l for l in body if l.upper().startswith('RWY')]
    other = [l for l in body if not l.upper().startswith('RWY') and not re.fullmatch(r'[A-Z]?', l)]
    # runway: the text layer is authoritative when it had one; OCR only fills gaps and must be real
    rwy = [r.rstrip(' ,') for r in rwy if valid_rwy(r, runways)]
    old = RWY_TOKEN.search(old_name or '')
    if not rwy and old:
        rwy = ['RWY ' + old.group(1).replace(' ', '')]
    if not body:
        return no, None
    if ctype in ('SID', 'STAR'):
        label = ' '.join(other[:2]) if other and len(other[0]) < 12 and len(other) > 1 and not RWY_TOKEN.search(other[1]) else ' '.join(other[:1])
        name = f"{label} · {rwy[0]}" if label and rwy else (label or (f"{ctype} {rwy[0]}" if rwy else None))
    else:
        name = ' '.join(other[:1] + rwy[:1]) if other else (f"{ctype} {rwy[0]}" if rwy else None)
    if name and not re.search(r'RWY|\d', name):
        name = None
    return no, name


def main():
    cache, public = sys.argv[1], sys.argv[2]
    idx_path = os.path.join(public, 'charts', 'aip_index.json')
    index = json.load(open(idx_path))
    man = json.load(open(os.path.join(cache, 'manifest.json')))
    pdf_of = {it['url']: it['pdf'] for items in man['airports'].values() for it in items if it.get('pdf')}
    rwys = {}
    try:
        for a in json.load(open(os.path.join(public, 'data', 'korea_airspace.json')))['airports']:
            rwys[a['icao']] = {r['id'][2:4] for r in a.get('runways') or [] if r.get('id', '').startswith('RW')}
    except Exception:
        pass
    tmp = os.path.join(tempfile.mkdtemp(), 'corner.png')
    fixed = 0
    for icao, entries in index['airports'].items():
        prev = None
        for e in entries:
            if not e.get('page') or e['pdf'] not in pdf_of:
                prev = e
                continue
            base = e['name'].replace(' · 데이터표', '')
            if not GENERIC.match(base):
                prev = e
                continue
            doc = pymupdf.open(os.path.join(cache, pdf_of[e['pdf']]))
            no, name = parse(ocr_corner(doc[e['page'] - 1], tmp), e['type'], base, rwys.get(icao, set()))
            if no:
                e['chartNo'] = no
            if name:
                e['name'] = name + (' · 데이터표' if '데이터표' in e['name'] else '')
            elif prev and prev.get('type') == e['type'] and e.get('chartNo', '').count('-') >= 2:
                # header-only continuation sheet (e.g. 2-4-1): belongs to the sheet before it
                tail = ' (계속)' if e['type'] in ('ADC', 'PDC', 'GMC') else ' · 데이터표'
                e['name'] = re.sub(r' \(\d+\)$', '', prev['name'].replace(' · 데이터표', '').replace(' (계속)', '')) + tail
            if e['name'] != base:
                fixed += 1
            prev = e
        print(icao, sum(1 for e in entries if GENERIC.match(e['name'].replace(' · 데이터표', ''))), 'still generic', flush=True)
    # data-tabulation sheets (2-14-1) take the name of their chart (2-14)
    for entries in index['airports'].values():
        by_no = {e.get('chartNo'): e for e in entries if '데이터표' not in e['name'] and '계속' not in e['name']}
        for e in entries:
            no = e.get('chartNo') or ''
            if '데이터표' in e['name'] and no.count('-') >= 2:
                parent = by_no.get(no.rsplit('-', 1)[0])
                if parent and parent['type'] == e['type']:
                    e['name'] = parent['name'] + ' · 데이터표'
    # page-index suffixes ("AD CHART (2)") are noise — the app numbers real duplicates itself
    for entries in index['airports'].values():
        for e in entries:
            e['name'] = re.sub(r' \(\d+\)(?=$| ·| \(계속\))', '', e['name'])
    with open(idx_path, 'w') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    print('renamed', fixed)


if __name__ == '__main__':
    main()
