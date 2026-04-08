"""
Context Menu Test for localhost:5173
Tests right-click functionality on the map (local dev server)
"""
from playwright.sync_api import sync_playwright
import time

def test_context_menu_local():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # Capture ALL console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Navigating to localhost:5173...")
        page.goto("http://localhost:5173", wait_until="load", timeout=60000)

        print("2. Waiting for map to load...")
        time.sleep(15)  # Wait longer for map initialization and HMR

        # Check if map canvas exists
        map_canvas = page.query_selector("canvas.mapboxgl-canvas")
        if map_canvas:
            print("   [OK] Map canvas found!")
        else:
            print("   [FAIL] Map canvas NOT found")
            browser.close()
            return False

        print("3. Getting map container dimensions...")
        viewport = page.viewport_size
        center_x = viewport['width'] // 2
        center_y = viewport['height'] // 2
        print(f"   Center point: ({center_x}, {center_y})")

        print("4. Performing right-click on map center...")
        page.mouse.click(center_x, center_y, button="right")

        print("5. Waiting for context menu...")
        time.sleep(2)

        # Check for context menu
        context_menu = page.query_selector(".map-context-menu")
        if context_menu:
            print("\n6. [OK] Context menu found!")
            menu_html = context_menu.inner_html()
            print(f"   Menu HTML: {menu_html[:300]}...")
        else:
            print("\n6. [FAIL] Context menu NOT found (.map-context-menu)")

            # Try to find any fixed/absolute positioned elements that might be the menu
            print("   Looking for potential context menu elements...")
            elements = page.query_selector_all("[style*='position: fixed'], [style*='position: absolute']")
            print(f"   Found {len(elements)} positioned elements")

        print("\n7. Console logs from page (last 30):")
        for i, log in enumerate(console_logs[-30:]):
            print(f"   {i+1}. {log}")

        print("\n8. Taking screenshot...")
        page.screenshot(path="context_menu_test_local.png")
        print("    Screenshot saved")

        browser.close()

        print("\n=== TEST COMPLETE ===")
        success = bool(context_menu)
        return success

if __name__ == "__main__":
    result = test_context_menu_local()
    print(f"\nFinal Result: {'PASS' if result else 'FAIL'}")
