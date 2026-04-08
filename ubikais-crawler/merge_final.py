#!/usr/bin/env python3
"""
전체 NOTAM 데이터 병합 (국내 + 국제)
"""

import json
import os
from datetime import datetime
from typing import Dict, Set, List

OUTPUT_DIR = "./data"

# 병합할 파일들
FILES_TO_MERGE = [
    # 국내 NOTAM (병합된 파일)
    'merged_notams_20260209_154042.json',
    # 국제 NOTAM (PIB API)
    'intl_notam_pib_20260209_164612.json',
]

# 재수집 파일 (있으면 자동 포함)
RETRY_PATTERN = 'intl_notam_retry_'


def normalize_notam(rec: Dict) -> Dict:
    """NOTAM 레코드 정규화"""
    return {
        'notam_number': rec.get('notam_number', rec.get('NOTAM_NO', '')),
        'location': rec.get('location', rec.get('LOCATION', '')),
        'series': rec.get('series', rec.get('SERIES', '')),
        'qcode': rec.get('qcode', rec.get('QCODE', '')),
        'qcode_mean': rec.get('qcode_mean', rec.get('QCODE_MEAN', '')),
        'issue_time': rec.get('issue_time', rec.get('ISSUE_TIME', '')),
        'effective_start': rec.get('effective_start', rec.get('EFFECTIVESTART', '')),
        'effective_end': rec.get('effective_end', rec.get('EFFECTIVEEND', '')),
        'e_text': rec.get('e_text', rec.get('ECODE', '')),
        'full_text': rec.get('full_text', rec.get('FULL_TEXT', '')),
        'fir': rec.get('fir', rec.get('FIR', '')),
        'ais_type': rec.get('ais_type', rec.get('AIS_TYPE', '')),
        'seq': rec.get('seq', rec.get('SEQ', '')),
        'source_type': rec.get('source_type', 'unknown'),
        'data_source': rec.get('data_source', 'unknown'),
    }


def main():
    print("=" * 70)
    print("전체 NOTAM 데이터 병합")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_notams: List[Dict] = []
    seen: Set[str] = set()
    stats = {}

    # 기본 파일 병합
    for filename in FILES_TO_MERGE:
        filepath = os.path.join(OUTPUT_DIR, filename)
        if not os.path.exists(filepath):
            print(f"  [SKIP] {filename} - 파일 없음")
            continue

        print(f"\n  [로드] {filename}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            records = json.load(f)

        new_count = 0
        for rec in records:
            normalized = normalize_notam(rec)
            notam_no = normalized['notam_number']
            if notam_no and notam_no not in seen:
                seen.add(notam_no)
                all_notams.append(normalized)
                new_count += 1

        stats[filename] = {'total': len(records), 'new': new_count}
        print(f"    총 {len(records):,}건 → {new_count:,}건 신규")

    # 재수집 파일 자동 포함
    for filename in os.listdir(OUTPUT_DIR):
        if filename.startswith(RETRY_PATTERN) and filename.endswith('.json'):
            filepath = os.path.join(OUTPUT_DIR, filename)

            print(f"\n  [로드] {filename} (재수집)...")
            with open(filepath, 'r', encoding='utf-8') as f:
                records = json.load(f)

            new_count = 0
            for rec in records:
                normalized = normalize_notam(rec)
                notam_no = normalized['notam_number']
                if notam_no and notam_no not in seen:
                    seen.add(notam_no)
                    all_notams.append(normalized)
                    new_count += 1

            stats[filename] = {'total': len(records), 'new': new_count}
            print(f"    총 {len(records):,}건 → {new_count:,}건 신규")

    # ==================== 통계 ====================
    print("\n" + "=" * 70)
    print("[병합 통계]")
    print("=" * 70)

    # 국내/국제 분류
    domestic_count = sum(1 for n in all_notams if n.get('source_type') == 'domestic')
    intl_count = sum(1 for n in all_notams if n.get('source_type') == 'international')
    unknown_count = len(all_notams) - domestic_count - intl_count

    print(f"\n  국내 NOTAM: {domestic_count:,}건")
    print(f"  국제 NOTAM: {intl_count:,}건")
    if unknown_count > 0:
        print(f"  기타: {unknown_count:,}건")
    print(f"\n  총 합계: {len(all_notams):,}건")

    # ==================== 저장 ====================
    print("\n" + "=" * 70)
    print("[파일 저장]")
    print("=" * 70)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'all_notams_final_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.2f} MB")
    print(f"  총 건수: {len(all_notams):,}건")

    print("\n" + "=" * 70)
    print("병합 완료!")
    print("=" * 70)

    return output_file, len(all_notams)


if __name__ == "__main__":
    main()
