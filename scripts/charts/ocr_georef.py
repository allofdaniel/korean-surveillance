#!/usr/bin/env python3
"""Georeference aerodrome sheets whose graticule labels are outlines (no text layer).

    python3 ocr_georef.py <cache_dir> <public_dir>

build_chart_index.py fits sheets from graticule labels in the PDF text layer. Some AD charts
(e.g. RKTN, RKPK) draw those labels as vector outlines, so they got no map overlay. This pass
OCRs the labels of aerodrome / parking / ground-movement / visual-approach sheets that still
have no overlay, runs the same RANSAC + runway refinement + acceptance gate, and writes the
overlay into charts/aip_index.json in place. Sheets marked NOT TO SCALE are never draped.
Run overlay_qc.py afterwards.
"""
import json, os, sys
import pymupdf
from build_chart_index import georeference

TYPES = {'ADC', 'PDC', 'GMC', 'VAC'}


def main():
    cache, public = sys.argv[1], sys.argv[2]
    idx_path = os.path.join(public, 'charts', 'aip_index.json')
    index = json.load(open(idx_path))
    man = json.load(open(os.path.join(cache, 'manifest.json')))
    pdf_of = {it['url']: it['pdf'] for items in man['airports'].values() for it in items if it.get('pdf')}
    airports = {a['icao']: a for a in json.load(open(os.path.join(public, 'data', 'korea_airspace.json')))['airports']}
    added = 0
    for icao, entries in index['airports'].items():
        a = airports.get(icao) or {}
        lat0, lon0 = a.get('lat', 36.5), a.get('lon', 127.8)
        out_dir = os.path.join(public, 'charts', 'aip', icao)
        for e in entries:
            if e['type'] not in TYPES or e.get('overlay') or not e.get('page') or e['pdf'] not in pdf_of:
                continue
            if '데이터표' in e['name']:
                continue
            page = pymupdf.open(os.path.join(cache, pdf_of[e['pdf']]))[e['page'] - 1]
            ov = georeference(page, e['type'], icao, e['id'], lat0, lon0, a.get('runways'), out_dir, ocr=True)
            print(icao, e['id'], e['type'], 'OK rms=%.1f gcps=%d %s' % (ov['rmsM'], ov['gcps'], ov.get('runwayFit', ''))
                  if ov else '-', flush=True)
            if ov:
                e['overlay'] = ov
                added += 1
    with open(idx_path, 'w') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    print('added', added)


if __name__ == '__main__':
    main()
