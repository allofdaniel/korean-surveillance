#!/usr/bin/env python3
"""Analyze AF (Arc to Fix) legs in korea_airspace.json to verify arc rendering"""
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
    # Load korea_airspace.json
    with open('public/data/korea_airspace.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build navaid coordinate map
    navaids = {}
    for nav in data.get('navaids', []):
        if nav.get('ident') and nav.get('lat') and nav.get('lon'):
            navaids[nav['ident']] = (nav['lat'], nav['lon'])

    # Build terminal waypoint map
    term_wpts = {}
    for wpt in data.get('terminalWaypoints', []):
        if wpt.get('id') and wpt.get('lat') and wpt.get('lon'):
            term_wpts[wpt['id']] = (wpt['lat'], wpt['lon'])

    # Build waypoint map
    wpts = {}
    for wpt in data.get('waypoints', []):
        if wpt.get('name') and wpt.get('lat') and wpt.get('lon'):
            wpts[wpt['name']] = (wpt['lat'], wpt['lon'])

    print(f"Loaded {len(navaids)} navaids, {len(term_wpts)} terminal waypoints, {len(wpts)} waypoints")

    # Find AF legs in procedures
    procedures = data.get('procedures', {})
    af_legs = []

    for proc_type in ['iaps', 'sids', 'stars']:
        procs = procedures.get(proc_type, {})
        for airport_icao, airport_procs in procs.items():
            for proc_name, legs in airport_procs.items():
                for i, leg in enumerate(legs):
                    if leg.get('path') == 'AF':
                        af_legs.append({
                            'airport': airport_icao,
                            'proc_type': proc_type,
                            'proc_name': proc_name,
                            'leg_index': i,
                            'leg': leg,
                            'prev_leg': legs[i-1] if i > 0 else None,
                            'next_leg': legs[i+1] if i < len(legs)-1 else None
                        })

    print(f"\nFound {len(af_legs)} AF (Arc to Fix) legs")
    print("\n" + "="*80)
    print("ANALYZING AF LEGS FOR RKPU (Ulsan Airport)")
    print("="*80)

    # Filter for RKPU
    rkpu_af = [af for af in af_legs if af['airport'] == 'RKPU']
    print(f"\nRKPU has {len(rkpu_af)} AF legs")

    for af in rkpu_af[:10]:  # Show first 10
        leg = af['leg']
        prev_leg = af['prev_leg']

        print(f"\n--- {af['proc_type'].upper()}: {af['proc_name']} (leg {af['leg_index']}) ---")
        print(f"  Current leg: wpt={leg.get('wpt')}, course={leg.get('course')}, dist={leg.get('dist')}")
        if prev_leg:
            print(f"  Prev leg: wpt={prev_leg.get('wpt')}, path={prev_leg.get('path')}")

        # Try to find waypoint coordinates
        wpt_name = leg.get('wpt')
        if wpt_name:
            coord = term_wpts.get(wpt_name) or wpts.get(wpt_name)
            if coord:
                print(f"  End point coordinate: {coord}")
            else:
                print(f"  WARNING: Cannot find coordinates for {wpt_name}")

        # Try to find arc center (navaid)
        # AF leg uses DME arc - need to find which navaid
        # Check if waypoint name suggests a DME fix (e.g., D326I = 326° at navaid I)
        if wpt_name:
            # Pattern: D###X where X is navaid suffix
            import re
            dme_match = re.match(r'D(\d{3})([A-Z])', wpt_name)
            if dme_match:
                bearing = int(dme_match.group(1))
                navaid_suffix = dme_match.group(2)
                print(f"  DME fix detected: {bearing}° from navaid ending in '{navaid_suffix}'")

                # Find matching navaid (for RKPU, likely 'I' = ILS localizer or VOR)
                matching_navaids = [n for n in navaids.keys() if n.endswith(navaid_suffix)]
                if matching_navaids:
                    print(f"  Possible navaids: {matching_navaids[:5]}")

    # Check specific RKPU navaids
    print("\n" + "="*80)
    print("RKPU RELATED NAVAIDS")
    print("="*80)

    # Find navaids near RKPU (35.59°N, 129.35°E)
    rkpu_lat, rkpu_lon = 35.5936, 129.3517
    nearby_navaids = []
    for ident, (lat, lon) in navaids.items():
        dist = haversine_distance(rkpu_lat, rkpu_lon, lat, lon)
        if dist < 50:  # within 50 NM
            nearby_navaids.append((ident, lat, lon, dist))

    nearby_navaids.sort(key=lambda x: x[3])
    print(f"\nNavaids within 50nm of RKPU:")
    for ident, lat, lon, dist in nearby_navaids[:15]:
        print(f"  {ident}: ({lat:.4f}, {lon:.4f}) - {dist:.1f} NM")

    # Check terminal waypoints for RKPU region
    print("\n" + "="*80)
    print("RKPU TERMINAL WAYPOINTS (DME fixes)")
    print("="*80)

    rkpu_term_wpts = [wpt for wpt in data.get('terminalWaypoints', [])
                     if wpt.get('region') == 'RK' and 'D' in str(wpt.get('id', ''))]

    for wpt in rkpu_term_wpts[:20]:
        print(f"  {wpt.get('id')}: ({wpt.get('lat'):.4f}, {wpt.get('lon'):.4f}) type={wpt.get('type')}")

    # Mathematical verification
    print("\n" + "="*80)
    print("MATHEMATICAL VERIFICATION OF ARC RENDERING")
    print("="*80)

    # For a proper DME arc:
    # 1. All points should be equidistant from the navaid (center)
    # 2. The arc should follow a constant radius

    # Let's check if RKPU IAP waypoints form proper arcs
    # Find ILS I36 navaid for RKPU
    rkpu_ils = None
    for airport in data.get('airports', []):
        if airport.get('icao') == 'RKPU':
            if airport.get('ils'):
                for ils in airport['ils']:
                    print(f"\n  ILS: {ils.get('ident')} - LLZ: ({ils.get('llz_lat')}, {ils.get('llz_lon')})")
                    if ils.get('ident') == 'I36' or 'I36' in str(ils.get('ident', '')):
                        rkpu_ils = (ils.get('llz_lat'), ils.get('llz_lon'))
            break

    if rkpu_ils:
        print(f"\n  RKPU I36 ILS localizer at: {rkpu_ils}")

        # Check DME fix distances from ILS
        for wpt in data.get('terminalWaypoints', []):
            wpt_id = wpt.get('id', '')
            if wpt_id.startswith('D') and wpt_id.endswith('I'):
                wpt_coord = (wpt.get('lat'), wpt.get('lon'))
                dist = haversine_distance(rkpu_ils[0], rkpu_ils[1], wpt_coord[0], wpt_coord[1])
                print(f"  {wpt_id}: distance from I36 = {dist:.2f} NM")

if __name__ == '__main__':
    main()
