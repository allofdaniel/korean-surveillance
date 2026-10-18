#!/usr/bin/env python3
"""One-off / re-runnable: make pale area tints transparent in existing overlay rasters.

    python3 clear_tints.py <public_dir>
"""
import json, os, sys
import numpy as np
from PIL import Image
from build_chart_index import background_mask

public = sys.argv[1]
index = json.load(open(os.path.join(public, 'charts', 'aip_index.json')))
n = 0
for entries in index['airports'].values():
    for e in entries:
        o = e.get('overlay')
        if not o:
            continue
        path = os.path.join(public, o['file'].lstrip('/'))
        a = np.array(Image.open(path).convert('RGBA'))
        m = background_mask(a) & (a[:, :, 3] > 0)
        if m.mean() > 0.002:
            a[m, 3] = 0
            Image.fromarray(a).save(path, 'WEBP', quality=80, method=6)
            n += 1
print('updated', n)
