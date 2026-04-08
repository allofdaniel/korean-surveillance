#!/usr/bin/env python3
"""
2000-2014년 NOTAM 데이터 수집
- 월 단위로 수집 (데이터량이 적어서 가능)
- Supabase에 직접 업로드
"""

import requests
import urllib3
import json
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Set

from _secrets import get_supabase_config

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

OUTPUT_DIR = "./data"
BASE_URL = "https://aim.koca.go.kr"

# Supabase 설정
SUPABASE_URL, SUPABASE_SERVICE_KEY = get_supabase_config()

# 수집 대상 연도
START_YEAR = 2000
END_YEAR = 2014


class EarlyCrawler:
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
        try:
            r = self.session.get(
                f'{BASE_URL}/pib/pibMain.do?type=2&language=ko_KR',
                timeout=30
            )
            print(f"[OK] 세션 초기화: {r.status_code}")
        except Exception as e:
            print(f"[WARN] 세션 초기화 실패: {e}")

    def fetch_notams(self, from_date: str, to_date: str, retry=3) -> List[Dict]:
        """NOTAM 조회"""
        params = {
            'validity_from': from_date,
            'validity_to': to_date,
            'ais_type': 'NOTAM',
            'traffic': 'I',
        }

        for attempt in range(retry):
            try:
                r = self.session.post(
                    f'{BASE_URL}/pib/aisSearch.do',
                    data=params,
                    timeout=120
                )

                if r.status_code != 200:
                    continue

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
                if attempt < retry - 1:
                    print(f"      재시도 {attempt + 1}/{retry}: {e}")
                    time.sleep(2)
                    self._init_session()
                else:
                    return []

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
            'data_source': 'PIB_2000s'
        }


def upload_to_supabase(records: List[Dict]) -> int:
    """Supabase에 배치 업로드"""
    if not records:
        return 0

    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    }

    cleaned = []
    for rec in records:
        clean_rec = {
            'notam_number': rec.get('notam_number', ''),
            'location': rec.get('location', ''),
            'full_text': rec.get('full_text', ''),
            'e_text': rec.get('e_text', ''),
            'qcode': rec.get('qcode', ''),
            'qcode_mean': rec.get('qcode_mean', ''),
            'effective_start': rec.get('effective_start', ''),
            'effective_end': rec.get('effective_end', ''),
            'series': rec.get('series', ''),
            'fir': rec.get('fir', ''),
            'issue_time': rec.get('issue_time', ''),
            'crawled_at': datetime.utcnow().isoformat() + 'Z'
        }
        cleaned.append(clean_rec)

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/notams",
            headers=headers,
            json=cleaned,
            timeout=60
        )

        if response.status_code in [200, 201]:
            return len(cleaned)
        else:
            return 0
    except Exception as exc:
        print(f"    Upsert failed: {exc}")
        return 0


def main():
    print("=" * 70)
    print("2000년대 NOTAM 데이터 수집 (2000-2014)")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    crawler = EarlyCrawler()

    all_notams: List[Dict] = []
    seen: Set[str] = set()
    stats = {}
    total_uploaded = 0

    for year in range(START_YEAR, END_YEAR + 1):
        print(f"\n{'=' * 50}")
        print(f"{year}년 수집")
        print('=' * 50)

        year_count = 0
        year_uploaded = 0

        for month in range(1, 13):
            month_start = datetime(year, month, 1)

            if month == 12:
                month_end = datetime(year, 12, 31)
            else:
                month_end = datetime(year, month + 1, 1) - timedelta(days=1)

            from_date = month_start.strftime('%Y-%m-%d')
            to_date = month_end.strftime('%Y-%m-%d')

            print(f"  {year}-{month:02d} ({from_date} ~ {to_date})...", end=" ")

            records = crawler.fetch_notams(from_date, to_date)

            batch = []
            for rec in records:
                notam_no = rec.get('NOTAM_NO', rec.get('notam_no', ''))
                if notam_no and notam_no not in seen:
                    seen.add(notam_no)
                    transformed = crawler.transform_record(rec)
                    all_notams.append(transformed)
                    batch.append(transformed)

            # Supabase 업로드
            if batch:
                uploaded = upload_to_supabase(batch)
                year_uploaded += uploaded

            print(f"{len(records)}건 → {len(batch)}건 신규")
            year_count += len(batch)

            time.sleep(0.3)

        stats[year] = year_count
        total_uploaded += year_uploaded
        print(f"\n  {year}년 총계: {year_count}건")

    # ==================== 로컬 저장 ====================
    print("\n" + "=" * 70)
    print("[로컬 파일 저장]")
    print("=" * 70)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'notams_2000s_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  파일: {output_file}")
    print(f"  크기: {file_size:.2f} MB")

    # ==================== 통계 ====================
    print("\n" + "=" * 70)
    print("[연도별 통계]")
    print("=" * 70)

    for year in range(START_YEAR, END_YEAR + 1):
        if year in stats:
            print(f"  {year}년: {stats[year]:,}건")

    print(f"\n총 수집: {len(all_notams):,}건")
    print(f"총 업로드: {total_uploaded:,}건")
    print("=" * 70)


if __name__ == "__main__":
    main()
