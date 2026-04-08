#!/usr/bin/env python3
"""
Playwright를 사용한 국제 NOTAM 수집
xNotam 웹사이트에서 브라우저 자동화로 데이터 추출
"""

import asyncio
import json
import os
from datetime import datetime, timedelta
from playwright.async_api import async_playwright

OUTPUT_DIR = "./data"
BASE_URL = "https://aim.koca.go.kr/xNotam"

async def collect_international_notams():
    print("=" * 70)
    print("국제 NOTAM 수집 (Playwright)")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    async with async_playwright() as p:
        # 브라우저 시작
        browser = await p.chromium.launch(headless=False)  # headless=False로 디버깅
        context = await browser.new_context(
            ignore_https_errors=True,
            locale='ko-KR'
        )
        page = await context.new_page()

        # 네트워크 요청 모니터링
        captured_data = []

        async def handle_response(response):
            if 'searchValidNotam' in response.url:
                try:
                    data = await response.json()
                    if 'DATA' in data:
                        captured_data.extend(data['DATA'])
                        print(f"  캡처: {len(data['DATA'])}건")
                except:
                    pass

        page.on('response', handle_response)

        # xNotam 페이지 접속
        print("\n[1] xNotam 페이지 접속...")
        await page.goto(f'{BASE_URL}/index.do?type=search&language=ko_KR', wait_until='networkidle')
        await asyncio.sleep(2)

        print(f"  페이지 제목: {await page.title()}")

        # 국제 NOTAM 탭/버튼 찾기
        print("\n[2] 국제 NOTAM 검색...")

        # 검색 프레임 찾기
        frames = page.frames
        print(f"  프레임 수: {len(frames)}")
        for i, frame in enumerate(frames):
            print(f"    [{i}] {frame.name}: {frame.url[:80] if frame.url else 'N/A'}")

        # 국내/국제 선택 라디오 버튼 찾기
        try:
            # 국제 라디오 버튼 클릭
            intl_radio = await page.query_selector('input[value="I"]')
            if intl_radio:
                await intl_radio.click()
                print("  국제 라디오 버튼 클릭!")
                await asyncio.sleep(1)
        except Exception as e:
            print(f"  라디오 버튼 오류: {e}")

        # 날짜 설정
        try:
            from_date = await page.query_selector('#sch_from_date, input[name="sch_from_date"]')
            to_date = await page.query_selector('#sch_to_date, input[name="sch_to_date"]')

            if from_date:
                await from_date.fill('2025-01-01')
            if to_date:
                await to_date.fill('2025-01-31')
            print("  날짜 설정 완료")
        except Exception as e:
            print(f"  날짜 설정 오류: {e}")

        # 검색 버튼 클릭
        try:
            search_btn = await page.query_selector('button[type="submit"], input[type="submit"], .btn-search, #searchBtn')
            if search_btn:
                await search_btn.click()
                print("  검색 버튼 클릭!")
                await asyncio.sleep(5)
        except Exception as e:
            print(f"  검색 버튼 오류: {e}")

        # 결과 대기
        print("\n[3] 결과 대기 중...")
        await asyncio.sleep(5)

        # 페이지 HTML 저장 (디버깅용)
        html = await page.content()
        with open(os.path.join(OUTPUT_DIR, 'xnotam_page.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  HTML 저장: xnotam_page.html")

        # 스크린샷 저장
        await page.screenshot(path=os.path.join(OUTPUT_DIR, 'xnotam_screenshot.png'))
        print(f"  스크린샷 저장: xnotam_screenshot.png")

        # 캡처된 데이터 확인
        print(f"\n[4] 캡처된 데이터: {len(captured_data)}건")

        if captured_data:
            output_file = os.path.join(OUTPUT_DIR, f'intl_notam_playwright_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(captured_data, f, ensure_ascii=False, indent=2)
            print(f"  저장: {output_file}")

        # 브라우저 유지 (디버깅)
        print("\n브라우저를 30초간 유지합니다...")
        await asyncio.sleep(30)

        await browser.close()

    print("\n" + "=" * 70)
    print("완료!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(collect_international_notams())
