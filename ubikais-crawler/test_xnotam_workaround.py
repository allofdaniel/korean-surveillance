#!/usr/bin/env python3
"""
xNotam API 페이지네이션 우회 테스트
- 날짜 범위를 작게 나누어 100건 이하로 쿼리
- 국제 NOTAM 500 에러 우회
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

def fetch_notams(inorout, from_date, to_date, page_size=100):
    """NOTAM 조회"""
    params = {
        'sch_inorout': inorout,
        'sch_from_date': from_date,
        'sch_to_date': to_date,
        'pageNo': '1',
        'pageSize': str(page_size),
        'language': 'ko_KR'
    }

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
print("xNotam API 우회 테스트")
print("=" * 70)

# 테스트 1: 일별 쿼리로 100건 이하 받기
print("\n[테스트 1] 일별 국내 NOTAM 쿼리")
print("-" * 50)

test_dates = [
    ('2025-01-01', '2025-01-01'),
    ('2025-01-02', '2025-01-02'),
    ('2025-01-03', '2025-01-03'),
    ('2025-01-01', '2025-01-07'),  # 1주일
    ('2025-01-01', '2025-01-14'),  # 2주일
]

for from_d, to_d in test_dates:
    result = fetch_notams('D', from_d, to_d)
    if 'error' in result:
        print(f"  {from_d} ~ {to_d}: Error {result['error']}")
    else:
        print(f"  {from_d} ~ {to_d}: Total={result['total']}, Records={result['records']}")

# 테스트 2: 국제 NOTAM 짧은 날짜 범위
print("\n[테스트 2] 국제 NOTAM - 다양한 날짜 범위")
print("-" * 50)

intl_test_dates = [
    ('2025-01-01', '2025-01-01'),
    ('2025-01-01', '2025-01-03'),
    ('2025-01-01', '2025-01-07'),
    ('2025-01-01', '2025-01-14'),
    ('2025-01-01', '2025-01-21'),
    ('2025-01-01', '2025-01-31'),
]

for from_d, to_d in intl_test_dates:
    result = fetch_notams('I', from_d, to_d)
    if 'error' in result:
        print(f"  {from_d} ~ {to_d}: Error {result['error']}")
    else:
        print(f"  {from_d} ~ {to_d}: Total={result['total']}, Records={result['records']}")

# 테스트 3: 2주 단위로 2025년 1월 전체 조회
print("\n[테스트 3] 2주 단위로 2025년 1월 국내 NOTAM 전체 수집")
print("-" * 50)

all_notams = []
seen = set()

date_ranges = [
    ('2025-01-01', '2025-01-14'),
    ('2025-01-15', '2025-01-31'),
]

for from_d, to_d in date_ranges:
    result = fetch_notams('D', from_d, to_d)
    if 'error' not in result:
        for notam in result['data']:
            notam_no = notam.get('NOTAM_NO', '')
            if notam_no and notam_no not in seen:
                seen.add(notam_no)
                all_notams.append(notam)
        print(f"  {from_d} ~ {to_d}: Total={result['total']}, Got={result['records']}, Unique so far={len(all_notams)}")

print(f"\n  → 2025년 1월 국내 NOTAM 총 {len(all_notams)}건 수집 성공")

# 테스트 4: 페이지 크기 변경 테스트
print("\n[테스트 4] 페이지 크기 변경 테스트")
print("-" * 50)

for page_size in [50, 100, 200, 500, 1000]:
    result = fetch_notams('D', '2025-01-01', '2025-01-31', page_size)
    if 'error' not in result:
        print(f"  pageSize={page_size}: Total={result['total']}, Records={result['records']}")

print("\n" + "=" * 70)
print("테스트 완료")
print("=" * 70)
