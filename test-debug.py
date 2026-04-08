"""
Debug test for Vercel deployment
"""
from playwright.sync_api import sync_playwright
import time

def test_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        print("1. Navigating...")
        page.goto("https://tbas.vercel.app", wait_until="load", timeout=60000)

        print("2. Waiting 15 seconds for map to initialize...")
        time.sleep(15)

        print("3. Taking screenshot...")
        page.screenshot(path="debug_screenshot.png")

        print("\n4. Console logs:")
        for i, log in enumerate(console_logs[:30]):
            print(f"   {i+1}. {log}")

        print("\n5. Looking for map canvas...")
        canvas = page.query_selector("canvas.mapboxgl-canvas")
        if canvas:
            print("   [OK] Canvas found!")
        else:
            print("   [FAIL] Canvas not found")

        # Check for error messages in the page
        error_divs = page.query_selector_all("div:has-text('오류'), div:has-text('error'), div:has-text('Error')")
        print(f"\n6. Found {len(error_divs)} potential error elements")

        browser.close()
        print("\n=== DONE ===")

if __name__ == "__main__":
    test_debug()
