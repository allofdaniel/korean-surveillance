#!/usr/bin/env python3
"""
PIB aisSearch.do API를 통한 국제 NOTAM 수집
"""

import requests
import urllib3
import json
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Set

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

OUTPUT_DIR = "./data"
BASE_URL = "https://aim.koca.go.kr"

# 수집 대상 연도
START_YEAR = 2023
END_YEAR = 2026

# 주요 FIR 코드 (한국 인근 국제 공역)
FIR_LIST = [
    'RJJJ',  # 일본 (후쿠오카 FIR)
    'ZSHA',  # 중국 (상해 FIR)
    'VHHK',  # 홍콩
    'RCAA',  # 대만
    'RPHI',  # 필리핀
    'ZJSA',  # 중국 (삼아 FIR)
    'UHPP',  # 러시아 (페트로파블로프스크)
]

class PIBCrawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        })
        self._init_session()

    def _init_session(self):
        """세션 초기화"""
        r = self.session.get(
            f'{BASE_URL}/pib/pibMain.do?type=2&language=ko_KR',
            timeout=30
        )
        print(f"[OK] 세션 초기화: {r.status_code}")

    def fetch_notams(self, from_date: str, to_date: str, fir: str = None) -> List[Dict]:
        """NOTAM 조회"""
        params = {
            'validity_from': from_date,
            'validity_to': to_date,
            'ais_type': 'NOTAM',
            'traffic': 'I',
        }

        if fir:
            params['fir'] = fir

        try:
            r = self.session.post(
                f'{BASE_URL}/pib/aisSearch.do',
                data=params,
                timeout=60
            )

            if r.status_code != 200:
                return []

            data = r.json()

            # 응답 구조 확인
            if isinstance(data, dict):
                if 'DATA' in data:
                    return data['DATA']
                elif 'data' in data:
                    return data['data']
            elif isinstance(data, list):
                return data

            return []

        except Exception as e:
            print(f"      Error: {e}")
            return []

    def transform_record(self, rec: Dict) -> Dict:
        """레코드 정규화"""
        return {
            'notam_number': rec.get('NOTAM_NO', rec.get('notam_no', '')),
            'location': rec.get('LOCATION', rec.get('location', '')),
            'series': rec.get('SERIES', rec.get('series', '')),
            'qcode': rec.get('QCODE', rec.get('qcode', '')),
            'qcode_mean': rec.get('QCODE_MEAN', rec.get('qcode_mean', '')),
            'issue_time': rec.get('ISSUE_TIME', rec.get('issue_time', '')),
            'effective_start': rec.get('EFFECTIVESTART', rec.get('effective_start', '')),
            'effective_end': rec.get('EFFECTIVEEND', rec.get('effective_end', '')),
            'e_text': rec.get('ECODE', rec.get('e_text', '')),
            'full_text': rec.get('FULL_TEXT', rec.get('full_text', '')),
            'fir': rec.get('FIR', rec.get('fir', '')),
            'ais_type': rec.get('AIS_TYPE', rec.get('ais_type', '')),
            'seq': rec.get('SEQ', rec.get('seq', '')),
            'source_type': 'international',
            'data_source': 'PIB'
        }


def main():
    print("=" * 70)
    print("국제 NOTAM 수집 (PIB aisSearch.do)")
    print(f"수집 범위: {START_YEAR}년 ~ {END_YEAR}년")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    crawler = PIBCrawler()

    all_notams = []
    seen: Set[str] = set()
    stats = {}

    # 먼저 FIR 없이 전체 국제 NOTAM 조회 테스트
    print("\n[테스트] 전체 국제 NOTAM 조회...")
    test_records = crawler.fetch_notams('2025-01-01', '2025-01-31')
    print(f"  2025-01 전체: {len(test_records)}건")

    if test_records:
        # 응답 구조 확인
        print(f"  첫 번째 레코드 키: {list(test_records[0].keys())[:10]}")

    # 연도별 + 월별 수집
    for year in range(START_YEAR, END_YEAR + 1):
        if year > datetime.now().year:
            continue

        print(f"\n{'=' * 50}")
        print(f"{year}년 수집")
        print('=' * 50)

        year_count = 0
        stats[year] = 0

        # 월별 수집
        for month in range(1, 13):
            # 미래 월 스킵
            if year == datetime.now().year and month > datetime.now().month:
                break

            from_date = f'{year}-{month:02d}-01'

            # 마지막 날 계산
            if month == 12:
                to_date = f'{year}-12-31'
            else:
                next_month = datetime(year, month + 1, 1)
                last_day = next_month - timedelta(days=1)
                to_date = last_day.strftime('%Y-%m-%d')

            # 현재 날짜 이후 조정
            today = datetime.now()
            if datetime.strptime(to_date, '%Y-%m-%d') > today:
                to_date = today.strftime('%Y-%m-%d')

            print(f"\n  {year}-{month:02d}...")

            records = crawler.fetch_notams(from_date, to_date)

            new_count = 0
            for rec in records:
                notam_no = rec.get('NOTAM_NO', rec.get('notam_no', ''))
                if notam_no and notam_no not in seen:
                    seen.add(notam_no)
                    transformed = crawler.transform_record(rec)
                    all_notams.append(transformed)
                    new_count += 1

            print(f"    {from_date} ~ {to_date}: {len(records)}건 → {new_count}건 신규")

            year_count += new_count
            time.sleep(0.5)

        stats[year] = year_count
        print(f"\n  {year}년 합계: {year_count}건")

    # ==================== 저장 ====================
    print("\n" + "=" * 70)
    print("[파일 저장]")
    print("=" * 70)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'intl_notam_pib_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.2f} MB")

    # ==================== 통계 ====================
    print("\n" + "=" * 70)
    print("수집 완료!")
    print("=" * 70)

    print("\n[연도별 통계]")
    for year in range(START_YEAR, END_YEAR + 1):
        if year in stats:
            print(f"  {year}년: {stats[year]:,}건")

    print(f"\n최종 저장: {len(all_notams):,}건")
    print("=" * 70)


if __name__ == "__main__":
    main()
