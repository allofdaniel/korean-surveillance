#!/usr/bin/env python3
"""
1. Supabase DB 현황 확인
2. UBIKAIS Sequence List로 과거 NOTAM 조회 테스트
"""

import requests
import json
from datetime import datetime

# SSL warning disable
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================
# Part 1: Supabase DB 현황 확인
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

def check_supabase_status():
    print("=" * 70)
    print("Part 1: Supabase DB 현황")
    print("=" * 70)

    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json"
    }

    # 1. get_notam_status RPC 호출
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/get_notam_status",
            headers=headers,
            json={}
        )
        if response.status_code == 200:
            status = response.json()
            print("\n[NOTAM Status]")
            print(json.dumps(status, indent=2, ensure_ascii=False))
        else:
            print(f"RPC 호출 실패: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"RPC 오류: {e}")

    # 2. notams 테이블 레코드 수
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=notam_number&limit=1",
            headers={**headers, "Prefer": "count=exact"}
        )
        content_range = response.headers.get("Content-Range", "")
        print(f"\n[notams 테이블]")
        print(f"Content-Range: {content_range}")
        if "/" in content_range:
            total = content_range.split("/")[1]
            print(f"총 레코드 수: {total}")
    except Exception as e:
        print(f"Count 조회 오류: {e}")

    # 3. 최근 크롤링 로그
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notam_crawl_logs?select=*&order=crawled_at.desc&limit=5",
            headers=headers
        )
        if response.status_code == 200:
            logs = response.json()
            print(f"\n[최근 크롤링 로그 5개]")
            for log in logs:
                print(f"  - {log.get('crawled_at', 'N/A')}: {log.get('total_upserted', 0)}건 upsert ({log.get('status', 'N/A')})")
        else:
            print(f"로그 조회 실패: {response.status_code}")
    except Exception as e:
        print(f"로그 조회 오류: {e}")

    # 4. 시리즈별 통계
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=series",
            headers={**headers, "Prefer": "count=exact"}
        )
        if response.status_code == 200:
            data = response.json()
            series_counts = {}
            for item in data:
                s = item.get('series', 'UNKNOWN')
                series_counts[s] = series_counts.get(s, 0) + 1
            print(f"\n[시리즈별 통계]")
            for s, cnt in sorted(series_counts.items()):
                print(f"  {s}: {cnt}건")
    except Exception as e:
        print(f"시리즈 통계 오류: {e}")

    # 5. 가장 오래된 / 최신 NOTAM
    try:
        # 가장 오래된
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=notam_number,crawled_at&order=crawled_at.asc&limit=1",
            headers=headers
        )
        if response.status_code == 200 and response.json():
            oldest = response.json()[0]
            print(f"\n[가장 오래된 데이터]")
            print(f"  {oldest.get('notam_number')} - {oldest.get('crawled_at')}")

        # 최신
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=notam_number,crawled_at&order=crawled_at.desc&limit=1",
            headers=headers
        )
        if response.status_code == 200 and response.json():
            newest = response.json()[0]
            print(f"\n[가장 최신 데이터]")
            print(f"  {newest.get('notam_number')} - {newest.get('crawled_at')}")
    except Exception as e:
        print(f"날짜 조회 오류: {e}")


# ============================================================
# Part 2: UBIKAIS Sequence List로 과거 NOTAM 조회
# ============================================================

BASE_URL = "https://ubikais.fois.go.kr:8030"
USERNAME = "allofdanie"
PASSWORD = "pr12pr34!!"

def login_ubikais():
    """UBIKAIS 로그인"""
    session = requests.Session()
    session.verify = False

    # 1. 로그인 페이지
    session.get(
        f"{BASE_URL}/common/login",
        params={"systemId": "sysUbikais"},
        headers={"User-Agent": "Mozilla/5.0"}
    )

    # 2. 로그인 POST
    session.post(
        f"{BASE_URL}/common/loginProc",
        data={
            "userId": USERNAME,
            "userPw": PASSWORD,
            "systemId": "sysUbikais"
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0"
        }
    )

    return session


def test_sequence_list_history(session):
    """Sequence List API로 과거 연도 NOTAM 조회 테스트"""
    print("\n" + "=" * 70)
    print("Part 2: UBIKAIS Sequence List 과거 데이터 테스트")
    print("=" * 70)

    url = f"{BASE_URL}/sysUbikais/biz/nps/selectNotamRecSeq.fois"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{BASE_URL}/sysUbikais/biz/nps/notamRecSeq"
    }

    # 다양한 연도 테스트 (2020~2026)
    years_to_test = ["20", "21", "22", "23", "24", "25", "26"]
    series_to_test = ["A", "C", "D"]

    results = {}

    for year in years_to_test:
        results[year] = {}
        for series in series_to_test:
            params = {
                "downloadYn": "1",
                "printYn": "",
                "srchFir": "RKRR",
                "srchSeries": series,
                "srchSeq": "",
                "srchYear": year,
                "cmd": "get-records",
                "limit": "1000",
                "offset": "0"
            }

            try:
                response = session.get(url, params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    count = data.get('total', len(data.get('records', [])))
                    results[year][series] = count
                else:
                    results[year][series] = f"Error {response.status_code}"
            except Exception as e:
                results[year][series] = f"Exception: {e}"

    # 결과 출력
    print("\n[연도별/시리즈별 NOTAM 수]")
    print(f"{'Year':<6} {'A':<10} {'C':<10} {'D':<10}")
    print("-" * 40)
    for year in years_to_test:
        a = results[year].get('A', 'N/A')
        c = results[year].get('C', 'N/A')
        d = results[year].get('D', 'N/A')
        print(f"20{year}  {str(a):<10} {str(c):<10} {str(d):<10}")

    # 2024년 Series A 샘플 데이터 확인
    print("\n[2024년 Series A 샘플 NOTAM]")
    params = {
        "downloadYn": "1",
        "printYn": "",
        "srchFir": "RKRR",
        "srchSeries": "A",
        "srchSeq": "",
        "srchYear": "24",
        "cmd": "get-records",
        "limit": "5",
        "offset": "0"
    }

    try:
        response = session.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            records = data.get('records', [])
            for rec in records[:3]:
                notam_num = f"{rec.get('ntSeries', '')}{rec.get('ntSndSeq', '')}/{rec.get('ntYear', '')}"
                print(f"  - {notam_num}: {rec.get('ntAd', '')} / {rec.get('ntCode', '')} / {rec.get('ntStatus', '')}")
    except Exception as e:
        print(f"  샘플 조회 오류: {e}")

    return results


def main():
    print("=" * 70)
    print("NOTAM 히스토리 데이터 확인")
    print(f"실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Part 1: Supabase DB 현황
    check_supabase_status()

    # Part 2: UBIKAIS 과거 데이터 테스트
    print("\nUBIKAIS 로그인 중...")
    session = login_ubikais()
    test_sequence_list_history(session)

    print("\n" + "=" * 70)
    print("완료!")
    print("=" * 70)


if __name__ == "__main__":
    main()
