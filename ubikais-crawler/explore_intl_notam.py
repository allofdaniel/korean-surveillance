#!/usr/bin/env python3
"""
국제 NOTAM 수집 방법 탐색
- xNotam API 다양한 파라미터 테스트
- 다른 엔드포인트 확인
"""

import requests
import urllib3
from datetime import datetime, timedelta
import time

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://aim.koca.go.kr"

session = requests.Session()
session.verify = False
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': BASE_URL,
    'Referer': f'{BASE_URL}/xNotam/index.do?type=search&language=ko_KR'
})

def init_session():
    """세션 초기화 - 여러 페이지 방문"""
    print("세션 초기화 중...")

    # 메인 페이지
    r = session.get(f'{BASE_URL}/xNotam/index.do?type=search&language=ko_KR', timeout=30)
    print(f"  메인: {r.status_code}")

    # 검색 프레임
    r = session.get(f'{BASE_URL}/xNotam/searchFrame.do?language=ko_KR', timeout=30)
    print(f"  검색프레임: {r.status_code}")

    # 국제 NOTAM 프레임
    r = session.get(f'{BASE_URL}/xNotam/searchFrame.do?type=I&language=ko_KR', timeout=30)
    print(f"  국제프레임: {r.status_code}")

    return True

def test_endpoint(endpoint, params, label):
    """엔드포인트 테스트"""
    try:
        r = session.post(f'{BASE_URL}{endpoint}', data=params, timeout=30)
        if r.status_code == 200:
            try:
                data = r.json()
                total = data.get('Total', len(data.get('DATA', [])))
                records = len(data.get('DATA', []))
                print(f"  {label}: OK - Total={total}, Records={records}")
                return data.get('DATA', [])
            except:
                print(f"  {label}: OK but not JSON - {r.text[:100]}")
                return []
        else:
            print(f"  {label}: Error {r.status_code}")
            return []
    except Exception as e:
        print(f"  {label}: Exception - {e}")
        return []

init_session()

print("\n" + "=" * 70)
print("국제 NOTAM API 탐색")
print("=" * 70)

# 테스트 1: 다양한 엔드포인트
print("\n[1] 다양한 엔드포인트 테스트")
endpoints = [
    '/xNotam/searchValidNotam.do',
    '/xNotam/searchNotam.do',
    '/xNotam/searchIntlNotam.do',
    '/xNotam/searchInternationalNotam.do',
    '/xNotam/getIntlNotamList.do',
    '/xNotam/selectIntlNotam.do',
]

base_params = {
    'sch_inorout': 'I',
    'sch_from_date': '2025-02-01',
    'sch_to_date': '2025-02-07',
    'pageNo': '1',
    'pageSize': '100',
    'language': 'ko_KR'
}

for ep in endpoints:
    test_endpoint(ep, base_params, ep)
    time.sleep(0.5)

# 테스트 2: 국제 NOTAM 특수 파라미터
print("\n[2] 국제 NOTAM 특수 파라미터")

# FIR 코드로 시도
firs = ['RJJJ', 'ZSHA', 'VHHK', 'RCAA', 'ZJSA']
for fir in firs:
    params = {**base_params, 'sch_fir': fir}
    test_endpoint('/xNotam/searchValidNotam.do', params, f"FIR={fir}")
    time.sleep(0.3)

# 테스트 3: 공항 코드로 시도
print("\n[3] 국제 공항 코드")
airports = ['RJTT', 'RJAA', 'VHHH', 'RCTP', 'ZSSS', 'RKSI']
for apt in airports:
    params = {
        'sch_inorout': 'I',
        'sch_location': apt,
        'sch_from_date': '2025-02-01',
        'sch_to_date': '2025-02-07',
        'pageNo': '1',
        'pageSize': '100',
        'language': 'ko_KR'
    }
    test_endpoint('/xNotam/searchValidNotam.do', params, f"Airport={apt}")
    time.sleep(0.3)

# 테스트 4: inorout 없이 + 국제 공항
print("\n[4] inorout 없이 국제 공항")
for apt in ['RJTT', 'VHHH']:
    params = {
        'sch_location': apt,
        'sch_from_date': '2025-02-01',
        'sch_to_date': '2025-02-07',
        'pageNo': '1',
        'pageSize': '100',
        'language': 'ko_KR'
    }
    test_endpoint('/xNotam/searchValidNotam.do', params, f"NoType+{apt}")
    time.sleep(0.3)

# 테스트 5: srchType 파라미터
print("\n[5] srchType 파라미터")
for stype in ['AIR', 'FIR', 'AREA', 'ROUTE', 'POINT']:
    params = {
        'sch_inorout': 'I',
        'srchType': stype,
        'sch_from_date': '2025-02-01',
        'sch_to_date': '2025-02-07',
        'pageNo': '1',
        'pageSize': '100',
        'language': 'ko_KR'
    }
    test_endpoint('/xNotam/searchValidNotam.do', params, f"srchType={stype}")
    time.sleep(0.3)

# 테스트 6: 빈 inorout + 필터
print("\n[6] 빈 inorout + 다양한 필터")
params = {
    'sch_inorout': '',
    'sch_from_date': '2025-02-01',
    'sch_to_date': '2025-02-07',
    'pageNo': '1',
    'pageSize': '100',
    'language': 'ko_KR'
}
result = test_endpoint('/xNotam/searchValidNotam.do', params, "Empty inorout")
if result:
    # 결과가 있으면 국내/국제 구분 확인
    domestic = sum(1 for r in result if r.get('LOCATION', '').startswith('RK'))
    intl = len(result) - domestic
    print(f"    → 국내: {domestic}, 국제: {intl}")

# 테스트 7: 다른 검색 방식
print("\n[7] 다른 검색 방식 (ICAO 지역 코드)")
regions = ['RJ', 'ZS', 'VH', 'RC', 'RP']  # 일본, 중국, 홍콩, 대만, 필리핀
for region in regions:
    params = {
        'sch_inorout': 'I',
        'sch_location': region,
        'sch_from_date': '2025-02-01',
        'sch_to_date': '2025-02-07',
        'pageNo': '1',
        'pageSize': '100',
        'language': 'ko_KR'
    }
    test_endpoint('/xNotam/searchValidNotam.do', params, f"Region={region}")
    time.sleep(0.3)

# 테스트 8: POST 대신 GET 시도
print("\n[8] GET 방식 시도")
try:
    params_str = '&'.join([f'{k}={v}' for k, v in base_params.items()])
    r = session.get(f'{BASE_URL}/xNotam/searchValidNotam.do?{params_str}', timeout=30)
    print(f"  GET 방식: {r.status_code}")
    if r.status_code == 200:
        try:
            data = r.json()
            print(f"    Total: {data.get('Total', 0)}")
        except:
            pass
except Exception as e:
    print(f"  GET 방식: Error - {e}")

print("\n" + "=" * 70)
print("탐색 완료")
print("=" * 70)
