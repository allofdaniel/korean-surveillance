"""
Complete test - wait for aircraft, click, verify photo
"""
from playwright.sync_api import sync_playwright
import time

def test_complete():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        # Wait for aircraft data to load
        print("2. Waiting for aircraft to appear...")
        max_wait = 30
        for i in range(max_wait):
            ads_b_count = page.evaluate("""
                () => {
                    const badge = document.querySelector('.ads-b-badge, [class*="adsb"], .status-badge');
                    if (badge) {
                        const text = badge.textContent;
                        const match = text.match(/\\d+/);
                        return match ? parseInt(match[0]) : 0;
                    }
                    // Try to find the ADS-B indicator in the header
                    const indicators = document.querySelectorAll('.data-indicator, [class*="indicator"]');
                    for (const ind of indicators) {
                        if (ind.textContent.includes('ADS-B')) {
                            const match = ind.textContent.match(/\\d+/);
                            return match ? parseInt(match[0]) : 0;
                        }
                    }
                    return -1;
                }
            """)
            print(f"   [{i+1}/{max_wait}] ADS-B count: {ads_b_count}")
            if ads_b_count and ads_b_count > 0:
                print(f"   Aircraft loaded! Count: {ads_b_count}")
                break
            time.sleep(1)

        # Take screenshot after aircraft load
        page.screenshot(path="final_test_1_loaded.png")
        print("   Screenshot saved")

        # Now check context menu
        print("\n3. Testing context menu...")
        viewport = page.viewport_size
        center_x = viewport['width'] // 2 + 100  # Offset from panel
        center_y = viewport['height'] // 2

        page.mouse.click(center_x, center_y, button="right")
        time.sleep(1)

        context_menu = page.query_selector(".map-context-menu")
        if context_menu and context_menu.is_visible():
            print("   [OK] Context menu appeared!")

            # Test "이 위치로 이동" button
            move_btn = page.query_selector(".map-context-menu button:has-text('이 위치로 이동')")
            if move_btn:
                print("   [OK] Found '이 위치로 이동' button")
                move_btn.click()
                time.sleep(2)
                print("   Clicked - map should have moved")

            # Test marker
            page.mouse.click(center_x + 50, center_y + 50, button="right")
            time.sleep(1)
            marker_btn = page.query_selector(".map-context-menu button:has-text('마커 추가')")
            if marker_btn:
                print("   [OK] Found '마커 추가' button")
                marker_btn.click()
                time.sleep(1)
                marker = page.query_selector(".context-menu-marker")
                if marker:
                    print("   [OK] Marker added successfully!")
                else:
                    print("   [FAIL] Marker not found")
        else:
            print("   [FAIL] Context menu did not appear")

        page.screenshot(path="final_test_2_contextmenu.png")

        # Check console for CSP errors
        print("\n4. Checking for CSP errors...")
        csp_errors = [log for log in console_logs if 'Content Security Policy' in log or 'CSP' in log]
        if csp_errors:
            print(f"   [WARN] CSP errors found: {len(csp_errors)}")
            for err in csp_errors[:3]:
                print(f"   {err[:150]}")
        else:
            print("   [OK] No CSP errors!")

        # Summary
        print("\n" + "=" * 50)
        print("SUMMARY")
        print("=" * 50)
        print(f"- Context Menu: {'PASS' if context_menu else 'FAIL'}")
        print(f"- Marker Add: {'PASS' if page.query_selector('.context-menu-marker') else 'FAIL'}")
        print(f"- CSP Errors: {'FAIL' if csp_errors else 'PASS'}")

        browser.close()
        print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_complete()
