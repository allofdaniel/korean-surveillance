#!/usr/bin/env python3
"""Deep analysis of AF legs - verify arc center and radius"""
import json
import math

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in nautical miles"""
    R = 3440.065  # Earth radius in NM
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def main():
    with open('public/data/korea_airspace.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build coordinate maps
    navaids = {}
    for nav in data.get('navaids', []):
        if nav.get('ident') and nav.get('lat') and nav.get('lon'):
            navaids[nav['ident']] = (nav['lat'], nav['lon'], nav.get('type', ''))

    term_wpts = {}
    for wpt in data.get('terminalWaypoints', []):
        if wpt.get('id') and wpt.get('lat') and wpt.get('lon'):
            term_wpts[wpt['id']] = (wpt['lat'], wpt['lon'])

    wpts = {}
    for wpt in data.get('waypoints', []):
        if wpt.get('name') and wpt.get('lat') and wpt.get('lon'):
            wpts[wpt['name']] = (wpt['lat'], wpt['lon'])

    # Get airports with ILS
    airport_ils = {}
    for airport in data.get('airports', []):
        icao = airport.get('icao')
        if airport.get('ils'):
            airport_ils[icao] = []
            for ils in airport['ils']:
                airport_ils[icao].append({
                    'ident': ils.get('ident'),
                    'llz_lat': ils.get('llz_lat'),
                    'llz_lon': ils.get('llz_lon'),
                    'freq': ils.get('freq')
                })

    procedures = data.get('procedures', {})

    print("="*80)
    print("DETAILED ANALYSIS: How to properly draw AF (Arc to Fix) legs")
    print("="*80)

    # Analyze RKPU I36-Y.HAEGU procedure in detail
    print("\n### RKPU I36-Y.HAEGU Procedure ###")
    iaps = procedures.get('iaps', {}).get('RKPU', {})
    proc = iaps.get('I36-Y.HAEGU', [])

    print(f"\nAll legs in I36-Y.HAEGU:")
    for i, leg in enumerate(proc):
        print(f"  {i}: path={leg.get('path')}, wpt={leg.get('wpt')}, course={leg.get('course')}, dist={leg.get('dist')}, turn={leg.get('turn')}")

    # Find coordinates for each waypoint
    print("\n\nWaypoint coordinates:")
    wpt_coords = {}
    for leg in proc:
        wpt = leg.get('wpt')
        if wpt:
            coord = term_wpts.get(wpt) or wpts.get(wpt)
            wpt_coords[wpt] = coord
            print(f"  {wpt}: {coord}")

    # HAEGU → D172J is the AF leg
    print("\n\n### AF leg analysis: HAEGU → D172J ###")
    haegu = wpt_coords.get('HAEGU')
    d172j = wpt_coords.get('D172J')

    if haegu and d172j:
        print(f"Start point (HAEGU): {haegu}")
        print(f"End point (D172J): {d172j}")

        # D172J = 172° radial from J navaid
        # Find J navaid near RKPU
        print("\n\nSearching for navaid 'J' (or ending in J):")
        j_navaids = [(k, v) for k, v in navaids.items() if 'J' in k]
        for ident, (lat, lon, typ) in j_navaids:
            dist_to_rkpu = haversine_distance(35.5936, 129.3517, lat, lon)
            if dist_to_rkpu < 100:
                dist_to_haegu = haversine_distance(haegu[0], haegu[1], lat, lon)
                dist_to_d172j = haversine_distance(d172j[0], d172j[1], lat, lon)
                print(f"  {ident} ({typ}): ({lat:.4f}, {lon:.4f})")
                print(f"    Distance to HAEGU: {dist_to_haegu:.2f} NM")
                print(f"    Distance to D172J: {dist_to_d172j:.2f} NM")
                print(f"    Difference: {abs(dist_to_haegu - dist_to_d172j):.2f} NM")

        # Check USN VOR (closest to RKPU)
        print("\n\nChecking USN VOR as potential arc center:")
        usn = navaids.get('USN')
        if usn:
            usn_lat, usn_lon, usn_type = usn
            dist_to_haegu = haversine_distance(usn_lat, usn_lon, haegu[0], haegu[1])
            dist_to_d172j = haversine_distance(usn_lat, usn_lon, d172j[0], d172j[1])
            print(f"  USN ({usn_type}): ({usn_lat:.4f}, {usn_lon:.4f})")
            print(f"  Distance to HAEGU: {dist_to_haegu:.2f} NM")
            print(f"  Distance to D172J: {dist_to_d172j:.2f} NM")
            print(f"  Difference: {abs(dist_to_haegu - dist_to_d172j):.2f} NM")

            if abs(dist_to_haegu - dist_to_d172j) < 0.5:
                print(f"  ✓ USN is a valid arc center! Radius ≈ {(dist_to_haegu + dist_to_d172j)/2:.2f} NM")
            else:
                print(f"  ✗ USN is NOT a valid arc center (distances don't match)")

    # Check airports with more AF legs
    print("\n\n" + "="*80)
    print("OTHER AIRPORTS WITH AF LEGS")
    print("="*80)

    af_count = {}
    for proc_type in ['iaps', 'sids', 'stars']:
        procs = procedures.get(proc_type, {})
        for airport_icao, airport_procs in procs.items():
            for proc_name, legs in airport_procs.items():
                for leg in legs:
                    if leg.get('path') == 'AF':
                        af_count[airport_icao] = af_count.get(airport_icao, 0) + 1

    af_sorted = sorted(af_count.items(), key=lambda x: -x[1])[:10]
    print("\nTop 10 airports by AF leg count:")
    for icao, count in af_sorted:
        print(f"  {icao}: {count} AF legs")

    # Analyze RKSI (Incheon) which has many AF legs
    print("\n\n### RKSI (Incheon) AF leg analysis ###")
    rksi_iaps = procedures.get('iaps', {}).get('RKSI', {})
    for proc_name, legs in list(rksi_iaps.items())[:3]:
        af_legs = [l for l in legs if l.get('path') == 'AF']
        if af_legs:
            print(f"\n{proc_name}:")
            for i, leg in enumerate(legs):
                if leg.get('path') == 'AF':
                    # Find prev leg
                    prev_idx = i - 1
                    prev_wpt = legs[prev_idx].get('wpt') if prev_idx >= 0 else None
                    curr_wpt = leg.get('wpt')
                    print(f"  AF: {prev_wpt} → {curr_wpt}, turn={leg.get('turn')}")

                    # Get coordinates
                    prev_coord = term_wpts.get(prev_wpt) or wpts.get(prev_wpt)
                    curr_coord = term_wpts.get(curr_wpt) or wpts.get(curr_wpt)

                    if prev_coord and curr_coord:
                        # Try to find center
                        # Check RKSI navaids
                        rksi_navaids = ['ILS', 'ISL', 'ICI']
                        for nav_id in navaids:
                            nav_lat, nav_lon, nav_type = navaids[nav_id]
                            d1 = haversine_distance(nav_lat, nav_lon, prev_coord[0], prev_coord[1])
                            d2 = haversine_distance(nav_lat, nav_lon, curr_coord[0], curr_coord[1])
                            if abs(d1 - d2) < 0.5 and d1 < 30:  # Close enough and within reasonable range
                                print(f"    Possible center: {nav_id} (d1={d1:.2f}, d2={d2:.2f}, diff={abs(d1-d2):.3f})")

    print("\n\n" + "="*80)
    print("CONCLUSION: What the code needs")
    print("="*80)
    print("""
For proper AF (Arc to Fix) rendering:

1. IDENTIFY ARC CENTER:
   - Parse waypoint name for navaid reference (D###X → X is navaid suffix)
   - Or find the navaid where: dist(navaid, start) ≈ dist(navaid, end)

2. CALCULATE RADIUS:
   - Radius = average of (dist to start, dist to end)
   - Or parse from waypoint name if it contains DME distance

3. DRAW ARC:
   - Use FIXED radius (not interpolating radius!)
   - Interpolate ONLY the angle from start_angle to end_angle
   - Turn direction from 'turn' field ('L' or 'R')

4. CURRENT CODE PROBLEM:
   - Interpolating both angle AND radius = SPIRAL, not ARC
   - Need to use CONSTANT radius for true circular arc
""")

if __name__ == '__main__':
    main()
