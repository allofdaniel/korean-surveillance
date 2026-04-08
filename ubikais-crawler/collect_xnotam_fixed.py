#!/usr/bin/env python3
"""
xNotam 전체 NOTAM 수집 (국내) - 페이지네이션 우회 버전

API가 pageSize를 무시하고 항상 100건만 반환하므로,
시리즈별 + 짧은 날짜 범위로 분할하여 수집

수집 범위: 2023년 ~ 현재
"""

import requests
import json
import os
import time
import urllib3
from datetime import datetime, timedelta
from typing import List, Dict, Set

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================
# Configuration
# ============================================================

BASE_URL = "https://aim.koca.go.kr"
OUTPUT_DIR = "./data"
REQUEST_DELAY = 0.3

# 수집 범위
START_YEAR = 2023
END_YEAR = 2026

# 시리즈별 날짜 청크 크기 (일)
# 100건 미만이 되도록 조정
SERIES_CONFIG = {
    'A': 30,  # 월간 OK (62건/월)
    'C': 7,   # 주간 (109건/월 → ~25건/주)
    'D': 5,   # 5일 (190건/월 → ~30건/5일)
    'E': 3,   # 3일 (360건/월 → ~35건/3일)
    'G': 30,  # 월간 OK (9건/월)
    'Z': 30,  # 월간 OK (97건/월)
}

# ============================================================
# xNotam Crawler
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

    def fetch_notams(self, from_date: str, to_date: str, series: str = None) -> List[Dict]:
        """NOTAM 조회 (단일 요청, 최대 100건)"""
        params = {
            'sch_inorout': 'D',  # 국내
            'sch_from_date': from_date,
            'sch_to_date': to_date,
            'pageNo': '1',
            'pageSize': '500',  # API가 무시하지만 일단 설정
            'language': 'ko_KR'
        }

        if series:
            params['sch_series'] = series

        try:
            r = self.session.post(
                f'{BASE_URL}/xNotam/searchValidNotam.do',
                data=params,
                timeout=60
            )

            if r.status_code != 200:
                return []

            data = r.json()
            return data.get('DATA', [])

        except Exception as e:
            print(f"      Error: {e}")
            return []

    def generate_date_ranges(self, year: int, chunk_days: int) -> List[tuple]:
        """연도를 청크 단위로 분할"""
        ranges = []

        if year > datetime.now().year:
            return ranges

        start = datetime(year, 1, 1)

        if year == datetime.now().year:
            end = datetime.now()
        else:
            end = datetime(year, 12, 31)

        current = start
        while current <= end:
            chunk_end = min(current + timedelta(days=chunk_days - 1), end)
            ranges.append((
                current.strftime('%Y-%m-%d'),
                chunk_end.strftime('%Y-%m-%d')
            ))
            current = chunk_end + timedelta(days=1)

        return ranges

    def collect_series(self, series: str, year: int, seen: Set[str]) -> List[Dict]:
        """시리즈별 수집"""
        chunk_days = SERIES_CONFIG.get(series, 7)
        ranges = self.generate_date_ranges(year, chunk_days)

        collected = []

        for from_date, to_date in ranges:
            records = self.fetch_notams(from_date, to_date, series)

            new_count = 0
            for rec in records:
                notam_no = rec.get('NOTAM_NO', '')
                if notam_no and notam_no not in seen:
                    seen.add(notam_no)
                    collected.append(rec)
                    new_count += 1

            if records:
                print(f"        {from_date}~{to_date}: {len(records)}건 → {new_count}건 신규")

            time.sleep(REQUEST_DELAY)

        return collected

    def transform_record(self, rec: Dict) -> Dict:
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
            'source_type': 'domestic',
            'data_source': 'xNotam'
        }


def main():
    print("=" * 70)
    print("xNotam 전체 국내 NOTAM 수집 (페이지네이션 우회)")
    print(f"수집 범위: {START_YEAR}년 ~ {END_YEAR}년")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    crawler = XNotamCrawler()

    all_notams = []
    seen = set()
    stats = {}

    for year in range(START_YEAR, END_YEAR + 1):
        if year > datetime.now().year:
            continue

        print(f"\n{'=' * 50}")
        print(f"{year}년 수집")
        print('=' * 50)

        year_count = 0
        stats[year] = {}

        for series in SERIES_CONFIG.keys():
            print(f"\n  [Series {series}]")

            records = crawler.collect_series(series, year, seen)
            transformed = [crawler.transform_record(r) for r in records]
            all_notams.extend(transformed)

            stats[year][series] = len(records)
            year_count += len(records)

            print(f"    → {len(records)}건 수집")

        print(f"\n  {year}년 합계: {year_count}건")

    # ==================== 저장 ====================
    print("\n" + "=" * 70)
    print("[파일 저장]")
    print("=" * 70)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'xnotam_domestic_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.2f} MB")

    # ==================== 통계 ====================
    print("\n" + "=" * 70)
    print("수집 완료!")
    print("=" * 70)

    print("\n[연도별/시리즈별 통계]")
    print(f"{'Year':<6}", end="")
    for s in SERIES_CONFIG.keys():
        print(f"{s:>8}", end="")
    print(f"{'합계':>10}")
    print("-" * 60)

    grand_total = 0
    for year in range(START_YEAR, END_YEAR + 1):
        if year not in stats:
            continue
        print(f"{year}  ", end="")
        year_total = 0
        for s in SERIES_CONFIG.keys():
            cnt = stats[year].get(s, 0)
            print(f"{cnt:>8}", end="")
            year_total += cnt
        print(f"{year_total:>10}")
        grand_total += year_total

    print("-" * 60)
    print(f"{'합계':<6}", end="")
    for s in SERIES_CONFIG.keys():
        s_total = sum(stats.get(y, {}).get(s, 0) for y in range(START_YEAR, END_YEAR + 1))
        print(f"{s_total:>8}", end="")
    print(f"{grand_total:>10}")

    print(f"\n최종 저장: {len(all_notams)}건")
    print("=" * 70)


if __name__ == "__main__":
    main()
