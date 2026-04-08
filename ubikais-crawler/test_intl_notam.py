#!/usr/bin/env python3
"""
국제 NOTAM API 테스트 - 500 에러 우회 방법 탐색
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
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Referer': f'{BASE_URL}/xNotam/index.do?type=search&language=ko_KR'
})

# 세션 초기화 - 국제 NOTAM 페이지로 먼저 접속
print("세션 초기화...")
r = session.get(f'{BASE_URL}/xNotam/index.do?type=search&language=ko_KR', timeout=30)
print(f"  초기화: {r.status_code}")

# 검색 페이지 접속
r = session.get(f'{BASE_URL}/xNotam/searchFrame.do?language=ko_KR', timeout=30)
print(f"  검색페이지: {r.status_code}")

def test_params(params_dict, label):
    """파라미터 테스트"""
    try:
        r = session.post(
            f'{BASE_URL}/xNotam/searchValidNotam.do',
            data=params_dict,
            timeout=60
        )
        if r.status_code == 200:
            data = r.json()
            total = data.get('Total', 0)
            records = len(data.get('DATA', []))
            print(f"  {label}: OK - Total={total}, Records={records}")
            return data.get('DATA', [])
        else:
            print(f"  {label}: Error {r.status_code}")
            return []
    except Exception as e:
        print(f"  {label}: Exception - {e}")
        return []

print("\n" + "=" * 70)
print("국제 NOTAM API 테스트")
print("=" * 70)

# 테스트 1: 기본 국제 NOTAM 조회
print("\n[테스트 1] 기본 조회 파라미터")
params_base = {
    'sch_inorout': 'I',
    'sch_from_date': '2025-01-01',
    'sch_to_date': '2025-01-07',
    'pageNo': '1',
    'pageSize': '100',
    'language': 'ko_KR'
}
test_params(params_base, "기본")

# 테스트 2: srchType 추가
print("\n[테스트 2] srchType 파라미터 추가")
for srch_type in ['AIR', 'FIR', 'AREA', 'ALL', '']:
    params = {**params_base, 'srchType': srch_type}
    test_params(params, f"srchType={srch_type}")

# 테스트 3: sch_type 대신 다른 파라미터
print("\n[테스트 3] 공항/FIR 코드 지정")
airports = ['RJTT', 'RJAA', 'VHHH', 'RCTP', 'ZSSS']
for airport in airports:
    params = {**params_base, 'sch_location': airport}
    test_params(params, f"location={airport}")

# 테스트 4: 국제 FIR 코드
print("\n[테스트 4] 국제 FIR 코드")
firs = ['RJJJ', 'VHHK', 'RCAA', 'ZSHA']
for fir in firs:
    params = {**params_base, 'sch_fir': fir}
    test_params(params, f"fir={fir}")

# 테스트 5: 전체 조회 (D+I)
print("\n[테스트 5] 국내+국제 동시 조회")
params_all = {
    'sch_inorout': '',  # 빈 값
    'sch_from_date': '2025-01-01',
    'sch_to_date': '2025-01-07',
    'pageNo': '1',
    'pageSize': '100',
    'language': 'ko_KR'
}
test_params(params_all, "inorout 빈값")

# 테스트 6: 다른 엔드포인트 시도
print("\n[테스트 6] 다른 API 엔드포인트")
endpoints = [
    '/xNotam/searchNotam.do',
    '/xNotam/selectNotam.do',
    '/xNotam/getNotamList.do'
]
for ep in endpoints:
    try:
        r = session.post(f'{BASE_URL}{ep}', data=params_base, timeout=10)
        print(f"  {ep}: {r.status_code}")
    except:
        print(f"  {ep}: Error")

# 테스트 7: 웹에서 실제 사용하는 정확한 파라미터 확인
print("\n[테스트 7] 추가 파라미터 조합")
params_full = {
    'sch_inorout': 'I',
    'sch_from_date': '2025-01-01',
    'sch_to_date': '2025-01-03',
    'sch_series': '',
    'sch_location': '',
    'sch_fir': '',
    'sch_qcode': '',
    'sch_text': '',
    'pageNo': '1',
    'pageSize': '100',
    'language': 'ko_KR',
    'downloadYn': '',
    'printYn': ''
}
test_params(params_full, "모든 파라미터")

print("\n" + "=" * 70)
print("테스트 완료")
print("=" * 70)
