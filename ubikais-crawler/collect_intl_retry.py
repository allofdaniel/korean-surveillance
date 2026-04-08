#!/usr/bin/env python3
"""
타임아웃으로 누락된 월 재수집
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

# 누락된 월 목록
MISSING_MONTHS = [
    (2023, 10), (2023, 11),
    (2024, 5), (2024, 6), (2024, 7), (2024, 9), (2024, 10), (2024, 11),
    (2025, 3), (2025, 5), (2025, 6), (2025, 7), (2025, 8), (2025, 9), (2025, 10), (2025, 11), (2025, 12),
    (2026, 1),
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

    def fetch_notams(self, from_date: str, to_date: str) -> List[Dict]:
        """NOTAM 조회"""
        params = {
            'validity_from': from_date,
            'validity_to': to_date,
            'ais_type': 'NOTAM',
            'traffic': 'I',
        }

        try:
            r = self.session.post(
                f'{BASE_URL}/pib/aisSearch.do',
                data=params,
                timeout=120  # 타임아웃 증가
            )

            if r.status_code != 200:
                return []

            data = r.json()

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
    print("누락된 월 재수집")
    print(f"대상: {len(MISSING_MONTHS)}개 월")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    crawler = PIBCrawler()

    all_notams = []
    seen: Set[str] = set()

    for year, month in MISSING_MONTHS:
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

        print(f"\n  {year}-{month:02d} ({from_date} ~ {to_date})...")

        # 2주 단위로 쪼개서 시도
        current_start = datetime.strptime(from_date, '%Y-%m-%d')
        end_date = datetime.strptime(to_date, '%Y-%m-%d')

        month_count = 0
        while current_start <= end_date:
            chunk_end = min(current_start + timedelta(days=13), end_date)
            chunk_from = current_start.strftime('%Y-%m-%d')
            chunk_to = chunk_end.strftime('%Y-%m-%d')

            records = crawler.fetch_notams(chunk_from, chunk_to)

            new_count = 0
            for rec in records:
                notam_no = rec.get('NOTAM_NO', rec.get('notam_no', ''))
                if notam_no and notam_no not in seen:
                    seen.add(notam_no)
                    transformed = crawler.transform_record(rec)
                    all_notams.append(transformed)
                    new_count += 1

            print(f"    {chunk_from} ~ {chunk_to}: {len(records)}건 → {new_count}건 신규")
            month_count += new_count

            current_start = chunk_end + timedelta(days=1)
            time.sleep(1)  # 서버 부하 줄이기

        print(f"    {year}-{month:02d} 합계: {month_count}건")

    # ==================== 저장 ====================
    print("\n" + "=" * 70)
    print("[파일 저장]")
    print("=" * 70)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'intl_notam_retry_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.2f} MB")
    print(f"  총 건수: {len(all_notams):,}건")
    print("=" * 70)


if __name__ == "__main__":
    main()
