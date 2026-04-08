#!/usr/bin/env python3
"""
xNotam API - 시리즈별 필터링 테스트
"""

import requests
import urllib3
from datetime import datetime, timedelta

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://aim.koca.go.kr"

session = requests.Session()
session.verify = False
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
})

# 세션 초기화
session.get(f'{BASE_URL}/xNotam/index.do?type=search&language=ko_KR', timeout=30)

def fetch_notams(inorout, from_date, to_date, series=None, location=None):
    """NOTAM 조회"""
    params = {
        'sch_inorout': inorout,
        'sch_from_date': from_date,
        'sch_to_date': to_date,
        'pageNo': '1',
        'pageSize': '500',
        'language': 'ko_KR'
    }

    if series:
        params['sch_series'] = series
    if location:
        params['sch_location'] = location

    try:
        r = session.post(
            f'{BASE_URL}/xNotam/searchValidNotam.do',
            data=params,
            timeout=60
        )
        if r.status_code == 200:
            data = r.json()
            return {
                'total': data.get('Total', 0),
                'records': len(data.get('DATA', [])),
                'data': data.get('DATA', [])
            }
        else:
            return {'error': r.status_code, 'total': 0, 'records': 0}
    except Exception as e:
        return {'error': str(e), 'total': 0, 'records': 0}

print("=" * 70)
print("xNotam 시리즈별 필터링 테스트")
print("=" * 70)

# 테스트 1: 시리즈별 필터링
print("\n[테스트 1] 2025년 1월 시리즈별 국내 NOTAM")
print("-" * 50)

series_list = ['A', 'B', 'C', 'D', 'E', 'G', 'S', 'Z']

for series in series_list:
    result = fetch_notams('D', '2025-01-01', '2025-01-31', series=series)
    if 'error' not in result:
        print(f"  Series {series}: Total={result['total']}, Records={result['records']}")
    else:
        print(f"  Series {series}: Error {result['error']}")

# 테스트 2: 시리즈 + 짧은 날짜 범위 조합
print("\n[테스트 2] Series A + 1주 단위 (2025년 1월)")
print("-" * 50)

all_series_a = []
seen = set()

# 1주 단위로 나누기
weeks = [
    ('2025-01-01', '2025-01-07'),
    ('2025-01-08', '2025-01-14'),
    ('2025-01-15', '2025-01-21'),
    ('2025-01-22', '2025-01-31'),
]

for from_d, to_d in weeks:
    result = fetch_notams('D', from_d, to_d, series='A')
    if 'error' not in result:
        for notam in result['data']:
            notam_no = notam.get('NOTAM_NO', '')
            if notam_no and notam_no not in seen:
                seen.add(notam_no)
                all_series_a.append(notam)
        print(f"  {from_d} ~ {to_d}: Total={result['total']}, Got={result['records']}, Unique={len(all_series_a)}")

print(f"\n  → Series A 총 {len(all_series_a)}건")

# 테스트 3: 공항별 필터링 시도
print("\n[테스트 3] 공항별 필터링 (2025년 1월)")
print("-" * 50)

airports = ['RKSI', 'RKSS', 'RKPC', 'RKPK', 'RKJJ', 'RKTN', 'RKTU', 'RKNY']

for airport in airports:
    result = fetch_notams('D', '2025-01-01', '2025-01-31', location=airport)
    if 'error' not in result:
        print(f"  {airport}: Total={result['total']}, Records={result['records']}")
    else:
        print(f"  {airport}: Error {result['error']}")

# 테스트 4: 1일 + 시리즈 조합
print("\n[테스트 4] 1일 + Series A 조합")
print("-" * 50)

result = fetch_notams('D', '2025-01-15', '2025-01-15', series='A')
if 'error' not in result:
    print(f"  2025-01-15 Series A: Total={result['total']}, Records={result['records']}")
    if result['records'] < 100:
        print(f"  → 100건 미만! 페이지네이션 우회 가능!")

print("\n" + "=" * 70)
print("테스트 완료")
print("=" * 70)
