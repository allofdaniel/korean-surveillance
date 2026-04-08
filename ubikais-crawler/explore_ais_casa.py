#!/usr/bin/env python3
"""
ais.casa.go.kr 포털 탐색
국제 NOTAM 데이터 소스 확인
"""

import requests
import urllib3
from datetime import datetime

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

session = requests.Session()
session.verify = False
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
})

print("=" * 70)
print("ais.casa.go.kr 포털 탐색")
print("=" * 70)

# 1. 메인 페이지 접속
urls_to_check = [
    'http://ais.casa.go.kr/',
    'https://ais.casa.go.kr/',
    'http://ais.casa.go.kr/notam',
    'http://ais.casa.go.kr/international',
    'http://ais.casa.go.kr/pib',
]

for url in urls_to_check:
    try:
        r = session.get(url, timeout=15, allow_redirects=True)
        print(f"\n{url}")
        print(f"  Status: {r.status_code}")
        print(f"  Final URL: {r.url}")
        if r.status_code == 200:
            # 페이지에서 NOTAM 관련 링크 찾기
            if 'notam' in r.text.lower() or 'NOTAM' in r.text:
                print(f"  NOTAM 키워드 발견!")
            if 'international' in r.text.lower() or '국제' in r.text:
                print(f"  국제 키워드 발견!")
    except Exception as e:
        print(f"\n{url}")
        print(f"  Error: {e}")

# 2. aim.koca.go.kr 추가 탐색
print("\n" + "=" * 70)
print("aim.koca.go.kr 추가 탐색")
print("=" * 70)

aim_urls = [
    'https://aim.koca.go.kr/',
    'https://aim.koca.go.kr/ais/index.do',
    'https://aim.koca.go.kr/pib/',
    'https://aim.koca.go.kr/notam/',
    'https://aim.koca.go.kr/intl/',
]

for url in aim_urls:
    try:
        r = session.get(url, timeout=15, allow_redirects=True)
        print(f"\n{url}")
        print(f"  Status: {r.status_code}")
        print(f"  Final URL: {r.url}")
    except Exception as e:
        print(f"\n{url}")
        print(f"  Error: {e}")

# 3. ICAO API 확인
print("\n" + "=" * 70)
print("ICAO API 확인")
print("=" * 70)

icao_urls = [
    'https://applications.icao.int/dataservices/default.aspx',
    'https://www.icao.int/api-data-samples',
]

for url in icao_urls:
    try:
        r = session.get(url, timeout=15, allow_redirects=True)
        print(f"\n{url}")
        print(f"  Status: {r.status_code}")
        if 'notam' in r.text.lower():
            print(f"  NOTAM API 발견!")
    except Exception as e:
        print(f"\n{url}")
        print(f"  Error: {e}")

print("\n" + "=" * 70)
print("탐색 완료")
print("=" * 70)
