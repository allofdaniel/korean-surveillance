#!/usr/bin/env python3
"""
Convert UBIKAIS NOTAM data to RKPU Viewer format
"""

import json
from datetime import datetime
from pathlib import Path

# Airport coordinates database
AIRPORT_COORDS = {
    "RKSI": (37.4601, 126.4407),  # Incheon
    "RKSS": (37.5585, 126.7906),  # Gimpo
    "RKPK": (35.1795, 128.9383),  # Gimhae
    "RKPC": (33.5113, 126.4929),  # Jeju
    "RKPU": (35.5934, 129.3518),  # Ulsan
    "RKTN": (35.8940, 128.6589),  # Daegu
    "RKJJ": (35.1264, 126.8089),  # Gwangju
    "RKJY": (34.8424, 127.6169),  # Yeosu
    "RKTH": (35.9878, 129.4203),  # Pohang
    "RKTL": (36.7166, 127.4991),  # Uljin
    "RKPS": (35.0886, 128.0703),  # Sacheon
    "RKNW": (37.4381, 127.9601),  # Wonju
    "RKSM": (37.4456, 127.1139),  # Seoul AB
    "RKTP": (35.1033, 129.0000),  # Gimhae AB
    "RKTY": (36.6319, 128.3550),  # Yecheon
    "RKTI": (36.0000, 127.0000),  # Seosan
    "RKNN": (35.8878, 127.0000),  # Gunsan
    "RKPD": (35.0000, 128.6000),  # Jinhae
    "RKRR": (35.5000, 127.0000),  # FIR center (approximate)
}

def parse_notam_date(date_str):
    """Parse NOTAM date format YYMMDDHHMM to ISO format"""
    if not date_str or len(date_str) < 10:
        return None
    try:
        year = int("20" + date_str[:2])
        month = int(date_str[2:4])
        day = int(date_str[4:6])
        hour = int(date_str[6:8])
        minute = int(date_str[8:10])
        return datetime(year, month, day, hour, minute).strftime("%Y-%m-%dT%H:%M:%SZ")
    except:
        return None

def convert_sequence_list(seq_records):
    """Convert sequence list records to viewer format"""
    notams = []

    for rec in seq_records:
        location = rec.get('ntAd', 'RKRR')
        coords = AIRPORT_COORDS.get(location, (35.5, 127.0))

        # Parse Q-line coordinates if available
        q_coord = rec.get('ntCoord', '')
        if q_coord and len(q_coord) >= 13:
            try:
                lat_deg = int(q_coord[:2])
                lat_min = int(q_coord[2:4])
                lat_dir = q_coord[4]
                lon_deg = int(q_coord[5:8])
                lon_min = int(q_coord[8:10])
                lon_dir = q_coord[10]

                lat = lat_deg + lat_min/60
                lon = lon_deg + lon_min/60
                if lat_dir == 'S': lat = -lat
                if lon_dir == 'W': lon = -lon
                coords = (lat, lon)
            except:
                pass

        notam = {
            "notam_id": f"{rec.get('ntSeries', 'C')}{rec.get('ntSndSeq', '0000')}/{rec.get('ntYear', '26')}",
            "location": location,
            "icao": location,
            "effectiveStart": parse_notam_date(rec.get('ntStartDate')) or datetime.now().strftime("%Y-%m-%dT00:00:00Z"),
            "effectiveEnd": parse_notam_date(rec.get('ntEndDate')) or "2026-12-31T23:59:00Z",
            "message": rec.get('ntText', ''),
            "type": rec.get('ntCode', 'MISC')[:2] if rec.get('ntCode') else 'AD',
            "latitude": coords[0],
            "longitude": coords[1],
            "radius": int(rec.get('ntCoord', '000')[-3:]) if rec.get('ntCoord') else 10,
            "purpose": rec.get('ntPurpose', 'N'),
            "full_text": rec.get('amsOriginal', ''),
            "qcode": rec.get('ntCode', ''),
            "qcode_desc": rec.get('ntCodeDesc', ''),
            "series": rec.get('ntSeries', 'C'),
            "fir": rec.get('ntFir', 'RKRR'),
        }
        notams.append(notam)

    return notams

def convert_prohibited_area(pa_records):
    """Convert prohibited area records"""
    notams = []

    for rec in pa_records:
        location = rec.get('ntAd', 'RKRR')
        coords = AIRPORT_COORDS.get(location, (35.5, 127.0))

        notam = {
            "notam_id": f"PA-{rec.get('ntmPk', 0)}",
            "location": location,
            "icao": location,
            "effectiveStart": parse_notam_date(rec.get('ntStartDate')) or datetime.now().strftime("%Y-%m-%dT00:00:00Z"),
            "effectiveEnd": parse_notam_date(rec.get('ntEndDate')) or "2026-12-31T23:59:00Z",
            "message": rec.get('ntText', 'Prohibited Area'),
            "type": "WARNING",
            "latitude": coords[0],
            "longitude": coords[1],
            "radius": 20,
            "purpose": "W",
            "full_text": rec.get('amsOriginal', ''),
            "qcode": rec.get('ntCode', 'QRPCA'),
        }
        notams.append(notam)

    return notams

def main():
    # Find most recent crawled data
    data_dir = Path('./data')
    json_files = sorted(data_dir.glob('all_notam_*.json'), reverse=True)

    if not json_files:
        print("No crawled data found!")
        return

    latest_file = json_files[0]
    print(f"Using: {latest_file}")

    with open(latest_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    all_notams = []
    seen_ids = set()  # Prevent duplicates

    # Convert all sequence lists (A, C, D, E, G, Z series)
    for key, value in data.items():
        if key.startswith('sequence_list_'):
            series = key.replace('sequence_list_', '')
            records = value.get('records', [])
            if records:
                notams = convert_sequence_list(records)
                # Filter duplicates
                for n in notams:
                    if n['notam_id'] not in seen_ids:
                        seen_ids.add(n['notam_id'])
                        all_notams.append(n)
                print(f"Converted {len(records)} NOTAMs from sequence list {series}")

    # Convert RK NOTAMs (FIR level)
    for key, value in data.items():
        if key.startswith('rk_notam_'):
            series = key.replace('rk_notam_', '')
            records = value.get('records', [])
            if records:
                notams = convert_sequence_list(records)
                for n in notams:
                    if n['notam_id'] not in seen_ids:
                        seen_ids.add(n['notam_id'])
                        all_notams.append(n)
                print(f"Converted {len(records)} RK NOTAMs from series {series}")

    # Convert AD NOTAMs (airport specific)
    for key, value in data.items():
        if key.startswith('ad_notam_'):
            airport = key.replace('ad_notam_', '')
            records = value.get('records', [])
            if records:
                notams = convert_sequence_list(records)
                for n in notams:
                    if n['notam_id'] not in seen_ids:
                        seen_ids.add(n['notam_id'])
                        all_notams.append(n)
                print(f"Converted {len(records)} AD NOTAMs for {airport}")

    # Convert prohibited areas
    pa_records = data.get('prohibited_area', {}).get('records', [])
    if pa_records:
        notams = convert_prohibited_area(pa_records)
        for n in notams:
            if n['notam_id'] not in seen_ids:
                seen_ids.add(n['notam_id'])
                all_notams.append(n)
        print(f"Converted {len(pa_records)} NOTAMs from prohibited areas")

    # Save to viewer format
    output_path = Path('../public/data/notams.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    print(f"\nTotal: {len(all_notams)} NOTAMs saved to {output_path}")

    # Print summary by location
    locations = {}
    for n in all_notams:
        loc = n['location']
        locations[loc] = locations.get(loc, 0) + 1

    print("\nBy location:")
    for loc, count in sorted(locations.items(), key=lambda x: -x[1]):
        print(f"  {loc}: {count}")

if __name__ == "__main__":
    main()
