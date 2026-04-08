#!/usr/bin/env python3
"""
PIB aisSearch.do API 시도
"""

import requests
import urllib3
import json
from datetime import datetime

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

session = requests.Session()
session.verify = False
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
})

# 세션 초기화
print("세션 초기화...")
r = session.get('https://aim.koca.go.kr/pib/pibMain.do?type=2&language=ko_KR', timeout=30)
print(f"  PIB 메인: {r.status_code}")

print("\n" + "=" * 70)
print("PIB aisSearch.do 테스트")
print("=" * 70)

# 다양한 파라미터 조합 시도
test_cases = [
    # 기본 파라미터
    {
        'validity_from': '2025-01-01',
        'validity_to': '2025-01-31',
        'ais_type': 'NOTAM',
        'traffic': 'I',  # International
        'fir': 'RJJJ',   # 일본 FIR
    },
    # 한국 인근 국제
    {
        'validity_from': '2025-01-01',
        'validity_to': '2025-01-31',
        'traffic': 'IFR',
        'scope': 'I',
    },
    # 공항 기반
    {
        'validity_from': '2025-01-01',
        'validity_to': '2025-01-31',
        'airport': 'RJTT',  # 도쿄 하네다
    },
    # purpose 기반
    {
        'validity_from': '2025-02-01',
        'validity_to': '2025-02-09',
        'purpose': 'BO',
        'scope': 'AEW',
    },
]

endpoints = [
    'https://aim.koca.go.kr/pib/aisSearch.do',
    'https://aim.koca.go.kr/pib/searchAis.do',
    'https://aim.koca.go.kr/pib/getNotam.do',
    'https://aim.koca.go.kr/pib/pibSearch.do',
]

for ep in endpoints:
    print(f"\n엔드포인트: {ep}")
    for i, params in enumerate(test_cases):
        try:
            r = session.post(ep, data=params, timeout=30)
            if r.status_code == 200:
                # JSON 응답 확인
                try:
                    data = r.json()
                    if isinstance(data, list):
                        print(f"  Case {i}: OK - {len(data)}건 (list)")
                    elif isinstance(data, dict):
                        total = data.get('total', data.get('Total', len(data.get('data', data.get('DATA', [])))))
                        print(f"  Case {i}: OK - Total={total}")
                except:
                    if len(r.text) > 100:
                        print(f"  Case {i}: OK - HTML ({len(r.text)} bytes)")
                    else:
                        print(f"  Case {i}: OK - {r.text[:80]}")
            else:
                print(f"  Case {i}: {r.status_code}")
        except Exception as e:
            print(f"  Case {i}: Error - {e}")

# AJAX 요청 형식으로 시도
print("\n" + "=" * 70)
print("AJAX 형식 시도")
print("=" * 70)

ajax_params = {
    'cmd': 'get-records',
    'offset': '0',
    'limit': '100',
    'validity_from': '2025-01-01',
    'validity_to': '2025-01-31',
}

for ep in endpoints:
    try:
        r = session.post(ep, data=ajax_params, timeout=30)
        print(f"  {ep}: {r.status_code}")
        if r.status_code == 200:
            try:
                data = r.json()
                print(f"    JSON: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            except:
                pass
    except:
        pass

print("\n" + "=" * 70)
print("완료")
print("=" * 70)
