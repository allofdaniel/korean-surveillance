"""
Right-click context menu test for tbas.vercel.app
"""
from playwright.sync_api import sync_playwright
import time

def test_rightclick():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Navigating to tbas.vercel.app...")
        page.goto("https://tbas.vercel.app", wait_until="load", timeout=60000)

        print("2. Waiting 10 seconds for map to load...")
        time.sleep(10)

        # Check if map canvas exists
        map_canvas = page.query_selector("canvas.mapboxgl-canvas")
        if map_canvas:
            print("   [OK] Map canvas found!")
        else:
            print("   [FAIL] Map canvas NOT found")
            browser.close()
            return False

        print("3. Injecting event listener for 'map-contextmenu'...")
        page.evaluate("""
            window.__mapContextMenuReceived = false;
            window.__mapContextMenuData = null;
            window.addEventListener('map-contextmenu', (e) => {
                window.__mapContextMenuReceived = true;
                window.__mapContextMenuData = e.detail;
                console.log('[TEST] map-contextmenu received!', e.detail);
            });
            console.log('[TEST] Listener added for map-contextmenu');
        """)

        print("4. Getting viewport dimensions...")
        viewport = page.viewport_size
        center_x = viewport['width'] // 2
        center_y = viewport['height'] // 2
        print(f"   Center point: ({center_x}, {center_y})")

        print("5. Performing right-click on map center...")
        page.mouse.click(center_x, center_y, button="right")

        print("6. Waiting 3 seconds for event...")
        time.sleep(3)

        # Check if custom event was received
        event_received = page.evaluate("window.__mapContextMenuReceived")
        event_data = page.evaluate("window.__mapContextMenuData")
        print(f"\n7. Custom event 'map-contextmenu' received: {event_received}")
        if event_data:
            print(f"   Event data: {event_data}")

        # Check for context menu element
        context_menu = page.query_selector(".map-context-menu")
        if context_menu:
            print("\n8. [OK] Context menu element found!")
            visible = context_menu.is_visible()
            print(f"   Visible: {visible}")
        else:
            print("\n8. [FAIL] Context menu element NOT found (.map-context-menu)")

        print("\n9. Console logs (last 10):")
        for i, log in enumerate(console_logs[-10:]):
            print(f"   {i+1}. {log}")

        print("\n10. Taking screenshot...")
        page.screenshot(path="rightclick_screenshot.png")
        print("    Screenshot saved")

        browser.close()

        print("\n=== TEST COMPLETE ===")
        success = event_received and bool(context_menu)
        return success

if __name__ == "__main__":
    result = test_rightclick()
    print(f"\nFinal Result: {'PASS' if result else 'FAIL'}")
