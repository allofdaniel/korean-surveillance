from pyproj import Geod
import math
G = Geod(ellps='WGS84')
NM = 1852.0

def inv(a, b):
    """a,b = (lat,lon) -> (true_course_deg, dist_nm)"""
    az, _, d = G.inv(a[1], a[0], b[1], b[0])
    return az % 360, d / NM

def fwd(p, brg, nm):
    lo, la, _ = G.fwd(p[1], p[0], brg, nm * NM)
    return (la, lo)

def angdiff(a, b):
    return abs((a - b + 180) % 360 - 180)

def intersect(p1, brg1, p2, brg2):
    """Intersection of two great-circle-ish rays (local planar approximation, fine < 50 NM)."""
    lat0 = math.radians((p1[0] + p2[0]) / 2)
    def xy(p): return ((p[1] - p1[1]) * math.cos(lat0) * 60, (p[0] - p1[0]) * 60)
    x1, y1 = 0.0, 0.0; x2, y2 = xy(p2)
    d1 = (math.sin(math.radians(brg1)), math.cos(math.radians(brg1)))
    d2 = (math.sin(math.radians(brg2)), math.cos(math.radians(brg2)))
    den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-9:
        return None
    t = ((x2 - x1) * d2[1] - (y2 - y1) * d2[0]) / den
    if t < 0:
        return None
    x, y = x1 + t * d1[0], y1 + t * d1[1]
    return (p1[0] + y / 60, p1[1] + x / (60 * math.cos(lat0)))

def point_at_dme(start, brg, nav, dme_nm, max_nm=40):
    """Walk from start along brg until geodesic distance to nav == dme_nm."""
    step = 0.02; s = 0.0; prev = None
    while s < max_nm:
        p = fwd(start, brg, s); d = inv(p, nav)[1]
        if prev is not None and (prev - dme_nm) * (d - dme_nm) <= 0:
            return p
        prev = d; s += step
    return None
