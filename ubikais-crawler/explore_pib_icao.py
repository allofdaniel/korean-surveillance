#!/usr/bin/env python3
"""
PIB 페이지와 ICAO API 탐색
"""

import requests
import urllib3
import re
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

session = requests.Session()
session.verify = False
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})

print("=" * 70)
print("PIB 및 ICAO API 탐색")
print("=" * 70)

# 1. PIB 페이지 탐색
print("\n[1] aim.koca.go.kr/pib/ 탐색")
try:
    r = session.get('https://aim.koca.go.kr/pib/', timeout=30)
    print(f"  Status: {r.status_code}")

    if r.status_code == 200:
        soup = BeautifulSoup(r.text, 'html.parser')

        # 링크 추출
        links = soup.find_all('a', href=True)
        print(f"  링크 수: {len(links)}")

        pib_links = []
        for link in links:
            href = link['href']
            text = link.get_text(strip=True)
            if 'notam' in href.lower() or 'pib' in href.lower() or 'intl' in href.lower() or '국제' in text:
                pib_links.append((href, text))
                print(f"    - {text}: {href}")

        # form 찾기
        forms = soup.find_all('form')
        print(f"  폼 수: {len(forms)}")
        for form in forms:
            action = form.get('action', 'N/A')
            method = form.get('method', 'GET')
            print(f"    Form: {method} {action}")

            # input 필드
            inputs = form.find_all(['input', 'select'])
            for inp in inputs[:10]:
                name = inp.get('name', '')
                inp_type = inp.get('type', inp.name)
                if name:
                    print(f"      - {name} ({inp_type})")
except Exception as e:
    print(f"  Error: {e}")

# 2. PIB 국제 NOTAM 검색
print("\n[2] PIB 국제 NOTAM 검색 시도")

pib_endpoints = [
    'https://aim.koca.go.kr/pib/searchNotam.do',
    'https://aim.koca.go.kr/pib/selectNotam.do',
    'https://aim.koca.go.kr/pib/intl.do',
    'https://aim.koca.go.kr/pib/international.do',
]

for ep in pib_endpoints:
    try:
        r = session.get(ep, timeout=15)
        print(f"  {ep}: {r.status_code}")
    except:
        pass

# 3. PIB POST 요청 시도
print("\n[3] PIB POST 요청 시도")
params = {
    'type': 'I',
    'inorout': 'I',
    'from_date': '2025-01-01',
    'to_date': '2025-01-31',
}

for ep in ['https://aim.koca.go.kr/pib/searchNotam.do', 'https://aim.koca.go.kr/pib/index.do']:
    try:
        r = session.post(ep, data=params, timeout=15)
        print(f"  POST {ep}: {r.status_code}")
        if r.status_code == 200 and len(r.text) > 1000:
            print(f"    Response length: {len(r.text)}")
    except Exception as e:
        print(f"  POST {ep}: Error - {e}")

# 4. xNotam의 다른 국제 NOTAM 엔드포인트
print("\n[4] xNotam 국제 NOTAM 다른 방식")

# 검색 프레임 접속
session2 = requests.Session()
session2.verify = False
session2.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
})

# 세션 초기화
r = session2.get('https://aim.koca.go.kr/xNotam/index.do?type=search&language=ko_KR', timeout=30)
print(f"  세션 초기화: {r.status_code}")

# 국제 NOTAM은 날짜 범위가 너무 넓으면 500 에러일 수 있음
# 아주 짧은 날짜로 시도
short_ranges = [
    ('2026-02-08', '2026-02-08'),  # 1일
    ('2026-02-07', '2026-02-08'),  # 2일
    ('2026-02-09', '2026-02-09'),  # 오늘
]

for from_d, to_d in short_ranges:
    params = {
        'sch_inorout': 'I',
        'sch_from_date': from_d,
        'sch_to_date': to_d,
        'pageNo': '1',
        'pageSize': '100',
        'language': 'ko_KR'
    }

    try:
        r = session2.post(
            'https://aim.koca.go.kr/xNotam/searchValidNotam.do',
            data=params,
            timeout=30
        )

        if r.status_code == 200:
            try:
                data = r.json()
                total = data.get('Total', 0)
                records = len(data.get('DATA', []))
                print(f"  {from_d}~{to_d}: Total={total}, Records={records}")
                if records > 0:
                    print(f"    첫 번째: {data['DATA'][0].get('NOTAM_NO', 'N/A')}")
            except:
                print(f"  {from_d}~{to_d}: Not JSON")
        else:
            print(f"  {from_d}~{to_d}: Error {r.status_code}")
    except Exception as e:
        print(f"  {from_d}~{to_d}: Exception - {e}")

# 5. 현재 유효한 국제 NOTAM만 조회 (날짜 없이)
print("\n[5] 날짜 없이 현재 유효한 국제 NOTAM")
params_no_date = {
    'sch_inorout': 'I',
    'pageNo': '1',
    'pageSize': '100',
    'language': 'ko_KR'
}

try:
    r = session2.post(
        'https://aim.koca.go.kr/xNotam/searchValidNotam.do',
        data=params_no_date,
        timeout=30
    )
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        try:
            data = r.json()
            total = data.get('Total', 0)
            records = len(data.get('DATA', []))
            print(f"  Total={total}, Records={records}")
        except:
            print(f"  Not JSON: {r.text[:200]}")
except Exception as e:
    print(f"  Exception: {e}")

print("\n" + "=" * 70)
print("탐색 완료")
print("=" * 70)
