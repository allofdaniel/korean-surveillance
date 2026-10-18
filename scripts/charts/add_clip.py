#!/usr/bin/env python3
"""Backfill overlay['clip'] (overlay frame as sheet fractions) for overlays built before it existed.

    python3 add_clip.py <cache_dir> <public_dir>

Re-runs the deterministic graticule fit (seeded RANSAC) to recover the crop rectangle and checks it
against the stored overlay raster size before writing.
"""
import json, os, sys
import numpy as np
import pymupdf
from PIL import Image
from build_chart_index import graticule_points, ocr_graticule_points, ransac, OVL_DPI

cache, public = sys.argv[1], sys.argv[2]
idx_path = os.path.join(public, 'charts', 'aip_index.json')
index = json.load(open(idx_path))
man = json.load(open(os.path.join(cache, 'manifest.json')))
pdf_of = {it['url']: it['pdf'] for items in man['airports'].values() for it in items if it.get('pdf')}
arp = {a['icao']: (a['lat'], a['lon']) for a in json.load(open(os.path.join(public, 'data', 'korea_airspace.json')))['airports']}
ok = bad = 0
for icao, entries in index['airports'].items():
    lat0, lon0 = arp.get(icao, (36.5, 127.8))
    for e in entries:
        o = e.get('overlay')
        if not o or o.get('clip'):
            continue
        page = pymupdf.open(os.path.join(cache, pdf_of[e['pdf']]))[e['page'] - 1]
        pts = ocr_graticule_points(page) if o.get('ocr') else graticule_points(page)
        fit = ransac(pts, lat0, lon0)
        if not fit:
            print('no fit', e['id']); bad += 1; continue
        inl = fit[1]
        W, H = page.rect.width, page.rect.height
        xs = [p[0] for p in inl]; ys = [p[1] for p in inl]
        mg = float(np.median([p[4] for p in inl]))
        x0, x1 = max(0, min(xs) + mg), min(W, max(xs) - mg)
        y0, y1 = max(0, min(ys) + mg), min(H, max(ys) - mg)
        iw, ih = Image.open(os.path.join(public, o['file'].lstrip('/'))).size
        if abs((x1 - x0) * OVL_DPI / 72 - iw) > 3 or abs((y1 - y0) * OVL_DPI / 72 - ih) > 3:
            print('size mismatch', e['id'], iw, ih, (x1 - x0) * OVL_DPI / 72, (y1 - y0) * OVL_DPI / 72); bad += 1; continue
        o['clip'] = [round(x0 / W, 5), round(y0 / H, 5), round(x1 / W, 5), round(y1 / H, 5)]
        ok += 1
with open(idx_path, 'w') as f:
    json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
print('clip added', ok, 'failed', bad)
