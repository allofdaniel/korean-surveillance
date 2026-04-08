#!/usr/bin/env python3
"""Verify arc rendering logic mathematically"""
import math

def calc_dist_deg(a, b):
    """Calculate distance in degrees (lon, lat)"""
    return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

def calc_dist_nm(lat1, lon1, lat2, lon2):
    """Calculate distance in nautical miles"""
    R = 3440.065
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def interpolate_arc_old(start, end, center, turn_dir='R', num_points=20):
    """OLD method: Interpolates both angle AND radius (WRONG - creates spiral)"""
    points = []

    start_angle = math.atan2(start[1] - center[1], start[0] - center[0])
    end_angle = math.atan2(end[1] - center[1], end[0] - center[0])

    start_radius = math.sqrt((start[0] - center[0])**2 + (start[1] - center[1])**2)
    end_radius = math.sqrt((end[0] - center[0])**2 + (end[1] - center[1])**2)

    if turn_dir == 'R':
        while end_angle > start_angle:
            end_angle -= 2 * math.pi
    else:
        while end_angle < start_angle:
            end_angle += 2 * math.pi

    for i in range(num_points + 1):
        t = i / num_points
        angle = start_angle + (end_angle - start_angle) * t
        # OLD: Interpolate radius (WRONG)
        radius = start_radius + (end_radius - start_radius) * t
        points.append((
            center[0] + radius * math.cos(angle),
            center[1] + radius * math.sin(angle)
        ))

    return points

def interpolate_arc_new(start, end, center, turn_dir='R', num_points=20):
    """NEW method: Latitude-corrected equirectangular projection"""
    points = []

    # Latitude correction factor
    center_lat = center[1]
    cos_lat = math.cos(math.radians(center_lat))

    # Scale to equirectangular (lon scaled by cos(lat))
    def scale_x(lon):
        return (lon - center[0]) * cos_lat
    def scale_y(lat):
        return lat - center[1]

    start_scaled = (scale_x(start[0]), scale_y(start[1]))
    end_scaled = (scale_x(end[0]), scale_y(end[1]))

    start_angle = math.atan2(start_scaled[1], start_scaled[0])
    end_angle = math.atan2(end_scaled[1], end_scaled[0])

    start_radius = math.sqrt(start_scaled[0]**2 + start_scaled[1]**2)
    end_radius = math.sqrt(end_scaled[0]**2 + end_scaled[1]**2)

    # Fixed radius in scaled space
    radius = (start_radius + end_radius) / 2

    if turn_dir == 'R':
        while end_angle > start_angle:
            end_angle -= 2 * math.pi
    else:
        while end_angle < start_angle:
            end_angle += 2 * math.pi

    for i in range(num_points + 1):
        t = i / num_points
        angle = start_angle + (end_angle - start_angle) * t

        # Point in scaled space
        scaled_x = radius * math.cos(angle)
        scaled_y = radius * math.sin(angle)

        # Convert back to lon/lat
        lon = center[0] + scaled_x / cos_lat
        lat = center[1] + scaled_y

        points.append((lon, lat))

    return points

def verify_arc(points, center, expected_radius_nm, lat_center):
    """Verify all points are at the same distance from center"""
    print(f"\n  Verification (expected radius: ~{expected_radius_nm:.2f} NM):")

    # Convert degree radius to approximate NM at this latitude
    deg_per_nm_lon = 1 / (60 * math.cos(math.radians(lat_center)))
    deg_per_nm_lat = 1 / 60

    distances = []
    for i, pt in enumerate(points):
        # Calculate distance from center in degrees
        dx = pt[0] - center[0]
        dy = pt[1] - center[1]
        dist_deg = math.sqrt(dx**2 + dy**2)

        # Convert to approximate NM
        dist_nm = calc_dist_nm(center[1], center[0], pt[1], pt[0])
        distances.append(dist_nm)

    min_dist = min(distances)
    max_dist = max(distances)
    avg_dist = sum(distances) / len(distances)

    print(f"  Min distance: {min_dist:.3f} NM")
    print(f"  Max distance: {max_dist:.3f} NM")
    print(f"  Avg distance: {avg_dist:.3f} NM")
    print(f"  Variation (max-min): {max_dist - min_dist:.4f} NM")

    return max_dist - min_dist

def main():
    print("="*70)
    print("MATHEMATICAL VERIFICATION OF ARC RENDERING")
    print("="*70)

    # RKPU I36-Y.HAEGU data from analysis:
    # Start: HAEGU (35.535, 129.542) - note: (lat, lon)
    # End: D172J (35.439, 129.413)
    # Center: USN VOR (35.599, 129.353)
    # Expected radius: ~10 NM

    # Convert to (lon, lat) for rendering (Mapbox convention)
    haegu = (129.54230555555554, 35.53519444444444)  # (lon, lat)
    d172j = (129.4129111111111, 35.438852777777775)
    usn_vor = (129.3533, 35.5985)

    print("\nRKPU I36-Y.HAEGU AF leg: HAEGU -> D172J")
    print(f"  Start (HAEGU): {haegu}")
    print(f"  End (D172J): {d172j}")
    print(f"  Center (USN VOR): {usn_vor}")

    # Verify distances to center
    dist_start = calc_dist_nm(haegu[1], haegu[0], usn_vor[1], usn_vor[0])
    dist_end = calc_dist_nm(d172j[1], d172j[0], usn_vor[1], usn_vor[0])
    print(f"\n  Distance HAEGU -> USN: {dist_start:.3f} NM")
    print(f"  Distance D172J -> USN: {dist_end:.3f} NM")
    print(f"  Difference: {abs(dist_start - dist_end):.4f} NM")

    # Test OLD method (radius interpolation)
    print("\n" + "-"*70)
    print("OLD METHOD (interpolates radius = SPIRAL)")
    print("-"*70)
    old_points = interpolate_arc_old(haegu, d172j, usn_vor, 'R', 20)
    old_variation = verify_arc(old_points, usn_vor, 10.0, usn_vor[1])

    # Test NEW method (fixed radius)
    print("\n" + "-"*70)
    print("NEW METHOD (fixed radius = TRUE CIRCULAR ARC)")
    print("-"*70)
    new_points = interpolate_arc_new(haegu, d172j, usn_vor, 'R', 20)
    new_variation = verify_arc(new_points, usn_vor, 10.0, usn_vor[1])

    print("\n" + "="*70)
    print("CONCLUSION")
    print("="*70)
    print(f"\nOLD method variation: {old_variation:.4f} NM (should be ~0 for circle)")
    print(f"NEW method variation: {new_variation:.4f} NM (should be ~0 for circle)")

    if new_variation < 0.001:
        print("\nNEW METHOD: TRUE CIRCULAR ARC (variation < 0.001 NM)")
    else:
        print(f"\nNEW METHOD: Still has {new_variation:.4f} NM variation")

    if old_variation > 0.01:
        print(f"OLD METHOD: Was drawing SPIRAL with {old_variation:.4f} NM drift")

if __name__ == '__main__':
    main()
