#!/usr/bin/env python3
"""
援?궡(D) 諛?VFR(V) NOTAM ?곗씠???섏쭛
- traffic='D': 援?궡 NOTAM
- traffic='V': VFR NOTAM (鍮꾪뻾?λ퀎 ?쒓컖鍮꾪뻾 ?뺣낫)
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

# Supabase ?ㅼ젙
SUPABASE_URL, SUPABASE_SERVICE_KEY = get_supabase_config()

# ?섏쭛 ????곕룄
START_YEAR = 2018  # VFR? 2018?꾨????곗씠?곌? 留롮쓬
END_YEAR = 2026

# 泥?겕 ?ш린 (VFR? ?곗씠?곌? 留롮븘??3???⑥쐞)
CHUNK_DAYS = 3

TRAFFIC_TYPES = ['D', 'V']  # Domestic, VFR


class DomesticVFRCrawler:
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
        """?몄뀡 珥덇린??""
        try:
            r = self.session.get(
                f'{BASE_URL}/pib/pibMain.do?type=2&language=ko_KR',
                timeout=30
            )
            print(f"[OK] ?몄뀡 珥덇린?? {r.status_code}")
        except Exception as e:
            print(f"[WARN] ?몄뀡 珥덇린???ㅽ뙣: {e}")

    def fetch_notams(self, from_date: str, to_date: str, traffic: str, retry=3) -> List[Dict]:
        """NOTAM 議고쉶"""
        params = {
            'validity_from': from_date,
            'validity_to': to_date,
            'ais_type': 'NOTAM',
            'traffic': traffic,
        }

        for attempt in range(retry):
            try:
                r = self.session.post(
                    f'{BASE_URL}/pib/aisSearch.do',
                    data=params,
                    timeout=180  # VFR? ?곗씠?곌? 留롮븘 ??꾩븘??利앷?
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
                    print(f"      ?ъ떆??{attempt + 1}/{retry}: {e}")
                    time.sleep(3)
                    self._init_session()
                else:
                    print(f"      ?ㅽ뙣: {e}")
                    return []

        return []

    def transform_record(self, rec: Dict, traffic: str) -> Dict:
        """?덉퐫???뺢퇋??""
        source_type = 'domestic' if traffic == 'D' else 'vfr'
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
            'source_type': source_type,
            'data_source': f'PIB_{traffic}'
        }


def upload_to_supabase(records: List[Dict]) -> int:
    """Supabase??諛곗튂 ?낅줈??""
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

    # 諛곗튂 ?ш린濡?遺꾪븷 (500嫄댁뵫)
    batch_size = 500
    uploaded = 0

    for i in range(0, len(cleaned), batch_size):
        batch = cleaned[i:i + batch_size]
        try:
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/notams",
                headers=headers,
                json=batch,
                timeout=60
            )

            if response.status_code in [200, 201]:
                uploaded += len(batch)
            elif response.status_code == 409:
                # Duplicate key conflicts are expected due idempotent upserts
                print(f"    Upsert conflict (duplicate) for batch {i}:{i + batch_size}")
            else:
                print(f"    Upsert failed: {response.status_code} - {response.text[:200]}")
        except Exception as exc:
            print(f"    Upsert request failed: {exc}")

        time.sleep(0.1)

    return uploaded


def main():
    print("=" * 70)
    print("Domestic(D) / VFR(V) NOTAM crawl")
    print(f"湲곌컙: {START_YEAR} ~ {END_YEAR}")
    print(f"?쒖옉 ?쒓컙: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    crawler = DomesticVFRCrawler()

    all_notams: List[Dict] = []
    seen: Set[str] = set()
    stats = {'D': {}, 'V': {}}
    total_uploaded = 0

    for traffic in TRAFFIC_TYPES:
        traffic_name = '援?궡(Domestic)' if traffic == 'D' else 'VFR'
        print(f"\n{'#' * 70}")
        print(f"# {traffic_name} NOTAM ?섏쭛")
        print('#' * 70)

    for year in range(START_YEAR, END_YEAR + 1):
            print(f"\n{'=' * 50}")
            print(f"{year}??({traffic_name})")
            print('=' * 50)

            year_count = 0
            year_uploaded = 0

            for month in range(1, 13):
                # 誘몃옒 ?곗씠???ㅽ궢
                now = datetime.now()
                if year > now.year or (year == now.year and month > now.month):
                    continue

                month_start = datetime(year, month, 1)

                if month == 12:
                    month_end = datetime(year, 12, 31)
                else:
                    month_end = datetime(year, month + 1, 1) - timedelta(days=1)

                # ?꾩옱 ?좎쭨 ?댄썑 議곗젙
                if month_end > now:
                    month_end = now

                print(f"\n  {year}-{month:02d}...")

                # 泥?겕 ?⑥쐞濡?履쇨컻湲?                current = month_start
                month_count = 0

                while current <= month_end:
                    chunk_end = min(current + timedelta(days=CHUNK_DAYS - 1), month_end)

                    from_date = current.strftime('%Y-%m-%d')
                    to_date = chunk_end.strftime('%Y-%m-%d')

                    records = crawler.fetch_notams(from_date, to_date, traffic)

                    batch = []
                    for rec in records:
                        notam_no = rec.get('NOTAM_NO', rec.get('notam_no', ''))
                        if notam_no and notam_no not in seen:
                            seen.add(notam_no)
                            transformed = crawler.transform_record(rec, traffic)
                            all_notams.append(transformed)
                            batch.append(transformed)
                            month_count += 1

                    # Supabase 업로드
                    if batch:
                        uploaded = upload_to_supabase(batch)
                        year_uploaded += uploaded

                    print(f"    {from_date} ~ {to_date}: {len(records)}嫄???{len(batch)}嫄??좉퇋")

                    current = chunk_end + timedelta(days=1)
                    time.sleep(0.5)  # Rate limiting

                print(f"    {year}-{month:02d} COUNT: {month_count} records")
                year_count += month_count

            stats[traffic][year] = year_count
            total_uploaded += year_uploaded
            print(f"\n  {year} summary: {year_count:,} records, uploaded: {year_uploaded:,}")

    # ==================== 濡쒖뺄 ???====================
    print("\n" + "=" * 70)
    print("[濡쒖뺄 ?뚯씪 ???")
    print("=" * 70)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(OUTPUT_DIR, f'domestic_vfr_notams_{timestamp}.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  ?뚯씪: {output_file}")
    print(f"  ?ш린: {file_size:.2f} MB")

    # ==================== ?듦퀎 ====================
    print("\n" + "=" * 70)
    print("[?곕룄蹂??듦퀎]")
    print("=" * 70)

    for traffic in TRAFFIC_TYPES:
        traffic_name = '援?궡(Domestic)' if traffic == 'D' else 'VFR'
        print(f"\n  {traffic_name}:")
        for year in range(START_YEAR, END_YEAR + 1):
            if year in stats[traffic]:
                print(f"    {year} {stats[traffic][year]:,} records")

    print(f"\nTotal: {len(all_notams):,} records")
    print(f"Uploaded: {total_uploaded:,} records")
    print("=" * 70)


if __name__ == "__main__":
    main()


