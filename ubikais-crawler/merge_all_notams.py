#!/usr/bin/env python3
"""
모든 수집된 NOTAM 데이터 병합

소스:
1. xNotam 국내 NOTAM (30,357건)
2. UBIKAIS 과거 NOTAM (33,856건)
"""

import json
import os
from datetime import datetime

OUTPUT_DIR = "./data"

def load_json(filepath):
    """JSON 파일 로드"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"  Error loading {filepath}: {e}")
        return []

def normalize_record(rec, source):
    """레코드 정규화"""
    return {
        'notam_number': rec.get('notam_number', ''),
        'location': rec.get('location', ''),
        'series': rec.get('series', ''),
        'qcode': rec.get('qcode', ''),
        'qcode_mean': rec.get('qcode_mean', ''),
        'issue_time': rec.get('issue_time', ''),
        'effective_start': rec.get('effective_start', ''),
        'effective_end': rec.get('effective_end', ''),
        'e_text': rec.get('e_text', ''),
        'full_text': rec.get('full_text', ''),
        'fir': rec.get('fir', ''),
        'ais_type': rec.get('ais_type', ''),
        'seq': rec.get('seq', ''),
        'source_type': rec.get('source_type', source),
        'data_source': rec.get('data_source', source),
        'q_lat': rec.get('q_lat'),
        'q_lon': rec.get('q_lon'),
        'q_radius_nm': rec.get('q_radius_nm'),
        'q_lower_alt': rec.get('q_lower_alt'),
        'q_upper_alt': rec.get('q_upper_alt'),
    }

def main():
    print("=" * 70)
    print("NOTAM 데이터 병합")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_notams = []
    seen = set()

    # 1. xNotam 국내 데이터
    print("\n[1] xNotam 국내 NOTAM 로드...")
    xnotam_file = os.path.join(OUTPUT_DIR, "xnotam_domestic_20260209_153541.json")
    xnotam_data = load_json(xnotam_file)
    print(f"    로드: {len(xnotam_data)}건")

    for rec in xnotam_data:
        notam_no = rec.get('notam_number', '')
        if notam_no and notam_no not in seen:
            seen.add(notam_no)
            all_notams.append(normalize_record(rec, 'xNotam'))

    print(f"    병합 후: {len(all_notams)}건")

    # 2. UBIKAIS 과거 데이터
    print("\n[2] UBIKAIS 과거 NOTAM 로드...")
    ubikais_file = os.path.join(OUTPUT_DIR, "historical_notams_20260209_140823.json")
    ubikais_data = load_json(ubikais_file)
    print(f"    로드: {len(ubikais_data)}건")

    new_count = 0
    for rec in ubikais_data:
        notam_no = rec.get('notam_number', '')
        if notam_no and notam_no not in seen:
            seen.add(notam_no)
            all_notams.append(normalize_record(rec, 'UBIKAIS'))
            new_count += 1

    print(f"    신규 추가: {new_count}건")
    print(f"    병합 후 총: {len(all_notams)}건")

    # 시리즈별 통계
    print("\n[시리즈별 통계]")
    series_counts = {}
    for n in all_notams:
        s = n.get('series', 'UNKNOWN')
        series_counts[s] = series_counts.get(s, 0) + 1

    for s, cnt in sorted(series_counts.items()):
        print(f"  {s}: {cnt:,}건")

    # 연도별 통계
    print("\n[연도별 통계]")
    year_counts = {}
    for n in all_notams:
        notam_no = n.get('notam_number', '')
        if '/' in notam_no:
            year = notam_no.split('/')[-1]
            if len(year) == 2:
                year = '20' + year
            year_counts[year] = year_counts.get(year, 0) + 1

    for y, cnt in sorted(year_counts.items()):
        print(f"  {y}: {cnt:,}건")

    # 저장
    print("\n[저장]")
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'merged_notams_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.2f} MB")
    print(f"  총 레코드: {len(all_notams):,}건")

    print("\n" + "=" * 70)
    print("병합 완료!")
    print("=" * 70)

if __name__ == "__main__":
    main()
