#!/usr/bin/env python3
"""
xNotam 전체 NOTAM 수집 (국내 + 국제)
https://aim.koca.go.kr/xNotam/

수집 범위: 2023년 ~ 현재
예상 데이터: 15만건 이상
"""

import requests
import json
import os
import time
import urllib3
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================
# Configuration
# ============================================================

BASE_URL = "https://aim.koca.go.kr"
OUTPUT_DIR = "./data"
PAGE_SIZE = 100
REQUEST_DELAY = 0.3  # API rate limiting

# 수집 대상 연도 (xNotam은 2023년부터 데이터 존재)
START_YEAR = 2023
END_YEAR = 2026


# ============================================================
# xNotam Session
# ============================================================

class XNotamCrawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        })
        self._init_session()

    def _init_session(self):
        """세션 초기화"""
        r = self.session.get(
            f'{BASE_URL}/xNotam/index.do?type=search&language=ko_KR',
            timeout=30
        )
        print(f"[OK] 세션 초기화: {r.status_code}")

    def fetch_notams(self, params: Dict, max_pages: int = 1000) -> List[Dict]:
        """NOTAM 조회 (페이징 처리)"""
        all_data = []
        page = 1

        while page <= max_pages:
            params['pageNo'] = str(page)
            params['pageSize'] = str(PAGE_SIZE)
            params['language'] = 'ko_KR'

            try:
                r = self.session.post(
                    f'{BASE_URL}/xNotam/searchValidNotam.do',
                    data=params,
                    timeout=60
                )

                if r.status_code != 200:
                    print(f"      Error: Status {r.status_code}")
                    break

                data = r.json()
                records = data.get('DATA', [])
                total = data.get('Total', 0)

                all_data.extend(records)

                # 마지막 페이지 확인
                if len(records) < PAGE_SIZE or len(all_data) >= total:
                    break

                page += 1
                time.sleep(REQUEST_DELAY)

            except Exception as e:
                print(f"      Exception: {e}")
                break

        return all_data

    def collect_domestic(self, year: int) -> List[Dict]:
        """국내 NOTAM 수집 (연간)"""
        from_date = f'{year}-01-01'
        to_date = f'{year}-12-31' if year < 2026 else datetime.now().strftime('%Y-%m-%d')

        params = {
            'sch_inorout': 'D',
            'sch_from_date': from_date,
            'sch_to_date': to_date,
        }

        return self.fetch_notams(params)

    def collect_international_month(self, year: int, month: int) -> List[Dict]:
        """국제 NOTAM 수집 (월간)"""
        from_date = f'{year}-{month:02d}-01'

        # 마지막 날 계산
        if month == 12:
            to_date = f'{year}-12-31'
        else:
            next_month = datetime(year, month + 1, 1)
            last_day = next_month - timedelta(days=1)
            to_date = last_day.strftime('%Y-%m-%d')

        # 현재 날짜 이후면 스킵
        today = datetime.now()
        if datetime.strptime(from_date, '%Y-%m-%d') > today:
            return []

        if datetime.strptime(to_date, '%Y-%m-%d') > today:
            to_date = today.strftime('%Y-%m-%d')

        params = {
            'sch_inorout': 'I',
            'sch_from_date': from_date,
            'sch_to_date': to_date,
        }

        return self.fetch_notams(params)

    def transform_record(self, rec: Dict, source: str) -> Dict:
        """레코드 정규화"""
        return {
            'notam_number': rec.get('NOTAM_NO', ''),
            'location': rec.get('LOCATION', ''),
            'series': rec.get('SERIES', ''),
            'qcode': rec.get('QCODE', ''),
            'qcode_mean': rec.get('QCODE_MEAN', ''),
            'issue_time': rec.get('ISSUE_TIME', ''),
            'effective_start': rec.get('EFFECTIVESTART', ''),
            'effective_end': rec.get('EFFECTIVEEND', ''),
            'e_text': rec.get('ECODE', ''),
            'full_text': rec.get('FULL_TEXT', ''),
            'fir': rec.get('FIR', ''),
            'ais_type': rec.get('AIS_TYPE', ''),
            'seq': rec.get('SEQ', ''),
            'source_type': source,
            'data_source': 'xNotam'
        }


def main():
    print("=" * 70)
    print("xNotam 전체 NOTAM 수집")
    print(f"수집 범위: {START_YEAR}년 ~ {END_YEAR}년")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    crawler = XNotamCrawler()

    all_notams = []
    stats = {
        'domestic': {},
        'international': {}
    }

    # ==================== 국내 NOTAM ====================
    print("\n" + "=" * 50)
    print("[국내 NOTAM 수집]")
    print("=" * 50)

    for year in range(START_YEAR, END_YEAR + 1):
        print(f"\n  {year}년...", end=" ", flush=True)

        records = crawler.collect_domestic(year)
        transformed = [crawler.transform_record(r, 'domestic') for r in records]
        all_notams.extend(transformed)

        stats['domestic'][year] = len(records)
        print(f"{len(records):,}건")

        time.sleep(1)

    # ==================== 국제 NOTAM ====================
    print("\n" + "=" * 50)
    print("[국제 NOTAM 수집]")
    print("=" * 50)

    for year in range(START_YEAR, END_YEAR + 1):
        year_count = 0
        print(f"\n  {year}년:")

        for month in range(1, 13):
            # 미래 월은 스킵
            if year == END_YEAR and month > datetime.now().month:
                break

            print(f"    {month:02d}월...", end=" ", flush=True)

            records = crawler.collect_international_month(year, month)
            transformed = [crawler.transform_record(r, 'international') for r in records]
            all_notams.extend(transformed)

            year_count += len(records)
            print(f"{len(records):,}건")

            time.sleep(0.5)

        stats['international'][year] = year_count
        print(f"  → {year}년 국제 합계: {year_count:,}건")

    # ==================== 중복 제거 ====================
    print("\n" + "=" * 50)
    print("[중복 제거]")
    print("=" * 50)

    before_dedup = len(all_notams)

    # notam_number 기준 중복 제거
    seen = set()
    unique_notams = []
    for n in all_notams:
        key = n.get('notam_number', '')
        if key and key not in seen:
            seen.add(key)
            unique_notams.append(n)

    after_dedup = len(unique_notams)
    print(f"  중복 제거 전: {before_dedup:,}건")
    print(f"  중복 제거 후: {after_dedup:,}건")
    print(f"  제거된 중복: {before_dedup - after_dedup:,}건")

    # ==================== 저장 ====================
    print("\n" + "=" * 50)
    print("[파일 저장]")
    print("=" * 50)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'xnotam_all_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(unique_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.1f} MB")

    # ==================== 통계 ====================
    print("\n" + "=" * 70)
    print("수집 완료!")
    print("=" * 70)

    print("\n[연도별 통계]")
    print(f"{'연도':<8} {'국내':>10} {'국제':>10} {'합계':>12}")
    print("-" * 42)

    total_dom = 0
    total_intl = 0

    for year in range(START_YEAR, END_YEAR + 1):
        dom = stats['domestic'].get(year, 0)
        intl = stats['international'].get(year, 0)
        total_dom += dom
        total_intl += intl
        print(f"{year}년   {dom:>10,} {intl:>10,} {dom + intl:>12,}")

    print("-" * 42)
    print(f"{'합계':<8} {total_dom:>10,} {total_intl:>10,} {total_dom + total_intl:>12,}")

    print(f"\n최종 저장: {after_dedup:,}건")
    print("=" * 70)


if __name__ == "__main__":
    main()
