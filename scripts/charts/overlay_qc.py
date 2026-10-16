#!/usr/bin/env python3
"""Quality gate for georeferenced chart overlays.

    python3 overlay_qc.py <public_dir> [--dry-run]

For every overlay in charts/aip_index.json the surveyed runway centrelines (data/korea_airspace.json)
are projected into the overlay image; the drawn runway / aerodrome symbol must sit under them.
An overlay is dropped (kept in the viewer, just not draped on the map) when
  * it is an AREA or ATC surveillance-minimum-altitude chart — small-scale sheets whose graticule
    fits leave hundreds of metres of error, which looks wrong on a live map, or
  * fewer than 95 % of centreline samples have chart ink within ~1 mm, or
  * it is on the manual list below (visually confirmed misfits the ink test cannot see).
"""
import json, math, os, sys
import numpy as np
from PIL import Image

DROP_TYPES = {'AREA', 'ATCSMAC'}
MANUAL = {'RKTU-2-11-p1', 'RKTU-2-11-p5', 'RKTU-2-14-p5'}
MIN_SCORE = 0.95


def merc(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def runway_pairs(rw):
    by = {r['id']: r for r in rw if r.get('id', '').startswith('RW')}
    out, seen = [], set()
    for k, r in by.items():
        try:
            n = int(k[2:4])
        except ValueError:
            continue
        o = f"RW{(n + 18 - 1) % 36 + 1:02d}" + {'L': 'R', 'R': 'L', 'C': 'C'}.get(k[4:5], '')
        if o in by and k not in seen:
            out.append((r, by[o])); seen |= {k, o}
    return out


def score(public, overlay, runways):
    im = np.array(Image.open(os.path.join(public, overlay['file'].lstrip('/'))).convert('RGBA'))
    H, W = im.shape[:2]
    TL, TR, _, BL = [np.array([p[0], merc(p[1])]) for p in overlay['bounds']]
    A = np.array([TR - TL, BL - TL]).T
    hits = tot = 0
    for r1, r2 in runway_pairs(runways):
        a = np.linalg.solve(A, np.array([r1['lon'], merc(r1['lat'])]) - TL) * [W, H]
        b = np.linalg.solve(A, np.array([r2['lon'], merc(r2['lat'])]) - TL) * [W, H]
        for t in np.linspace(0.1, 0.9, 17):
            x, y = a + (b - a) * t
            xi, yi = int(round(x)), int(round(y))
            tot += 1
            if 0 <= xi < W and 0 <= yi < H and (im[max(0, yi - 8):yi + 9, max(0, xi - 8):xi + 9, 3] > 0).mean() > 0.08:
                hits += 1
    return hits / tot if tot else 1.0


def main():
    public = sys.argv[1]
    dry = '--dry-run' in sys.argv
    idx_path = os.path.join(public, 'charts', 'aip_index.json')
    index = json.load(open(idx_path))
    airports = {a['icao']: a for a in json.load(open(os.path.join(public, 'data', 'korea_airspace.json')))['airports']}
    dropped = []
    for icao, entries in index['airports'].items():
        for e in entries:
            o = e.get('overlay')
            if not o:
                continue
            s = score(public, o, airports.get(icao, {}).get('runways') or [])
            why = ('type' if e['type'] in DROP_TYPES else 'manual' if e['id'] in MANUAL
                   else f'ink {s:.2f}' if s < MIN_SCORE else None)
            if why:
                dropped.append((e['id'], e['type'], why))
                if not dry:
                    path = os.path.join(public, o['file'].lstrip('/'))
                    if os.path.exists(path):
                        os.remove(path)
                    del e['overlay']
            else:
                o['qc'] = round(s, 2)
    for d in dropped:
        print('drop', *d)
    if not dry:
        with open(idx_path, 'w') as f:
            json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    print('dropped', len(dropped), 'kept', sum(1 for L in index['airports'].values() for e in L if e.get('overlay')))


if __name__ == '__main__':
    main()
