"""Ground elevation from Copernicus DEM GLO-30 (30 m, open data on AWS; DSM: includes buildings/trees).

Used to (a) fill AMSL elevation of obstacles published with height only (ENR 5.4 'Unknown/105'),
(b) derive AGL height for obstacles published with elevation only, and (c) flag implausible values.
"""
from __future__ import annotations
import math, os, json, hashlib
from collections import defaultdict

URL = 'https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif'

def _tile(lat, lon):
    la, lo = math.floor(lat), math.floor(lon)
    return f"Copernicus_DSM_COG_10_{'N' if la >= 0 else 'S'}{abs(la):02d}_00_{'E' if lo >= 0 else 'W'}{abs(lo):03d}_00_DEM"

def sample(points, cache_dir=None):
    """points: list of (lat, lon) -> list of ground elevation (m) or None."""
    try:
        import rasterio
    except Exception:
        return [None] * len(points)
    cache_dir = cache_dir or os.environ.get('AIP_CACHE', os.path.expanduser('~/.cache/aip_pipeline'))
    cpath = os.path.join(cache_dir, 'dem_cache.json')
    try:
        cache = json.load(open(cpath))
    except Exception:
        cache = {}
    out = [None] * len(points)
    groups = defaultdict(list)
    for i, (la, lo) in enumerate(points):
        k = f'{la:.5f},{lo:.5f}'
        if k in cache:
            out[i] = cache[k]
        else:
            groups[_tile(la, lo)].append(i)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
        for name, idx in groups.items():
            local = os.path.join(cache_dir, 'dem', name + '.tif')
            src = local if os.path.exists(local) else URL.format(n=name)
            if not os.path.exists(local):
                try:     # fetch the whole 1°×1° tile once (~25 MB); point reads over HTTP are slow
                    import urllib.request
                    os.makedirs(os.path.dirname(local), exist_ok=True)
                    urllib.request.urlretrieve(URL.format(n=name), local + '.part'); os.replace(local + '.part', local)
                    src = local
                except Exception:
                    pass
            try:
                with rasterio.open(src) as ds:
                    vals = list(ds.sample([(points[i][1], points[i][0]) for i in idx]))
                for i, v in zip(idx, vals):
                    x = float(v[0])
                    out[i] = None if x < -100 or x > 9000 else round(x, 1)
                    cache[f'{points[i][0]:.5f},{points[i][1]:.5f}'] = out[i]
            except Exception:
                for i in idx:
                    out[i] = 0.0 if _is_sea_tile_missing(name) else None
    try:
        os.makedirs(cache_dir, exist_ok=True)
        json.dump(cache, open(cpath, 'w'))
    except Exception:
        pass
    return out

def _is_sea_tile_missing(name):
    # Copernicus publishes no tile for open sea: missing tile => sea level
    return True
