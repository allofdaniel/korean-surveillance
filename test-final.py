"""
Final Context Menu Test for tbas.vercel.app
"""
from playwright.sync_api import sync_playwright
import time

def test_context_menu_final():
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

        print("3. Adding custom event listener...")
        page.evaluate("""
            window.__mapContextMenuReceived = false;
            window.__mapContextMenuData = null;
            window.addEventListener('map-contextmenu', (e) => {
                window.__mapContextMenuReceived = true;
                window.__mapContextMenuData = e.detail;
                console.log('[TEST] map-contextmenu received!', e.detail);
            });
            console.log('[TEST] Listener added');
        """)

        print("4. Getting viewport dimensions...")
        viewport = page.viewport_size
        center_x = viewport['width'] // 2
        center_y = viewport['height'] // 2
        print(f"   Center: ({center_x}, {center_y})")

        print("5. Performing right-click on map center...")
        page.mouse.click(center_x, center_y, button="right")

        print("6. Waiting for event...")
        time.sleep(2)

        # Check if custom event was received
        event_received = page.evaluate("window.__mapContextMenuReceived")
        event_data = page.evaluate("window.__mapContextMenuData")

        print(f"\n7. Results:")
        print(f"   Event received: {event_received}")
        if event_data:
            print(f"   Event data: {event_data}")

        # Check for context menu element
        context_menu = page.query_selector(".map-context-menu")
        if context_menu:
            print("   [OK] Context menu element found!")
            visible = context_menu.is_visible()
            print(f"   Visible: {visible}")
        else:
            print("   [INFO] Context menu element not found (.map-context-menu)")

        print("\n8. Console logs (last 15):")
        for i, log in enumerate(console_logs[-15:]):
            print(f"   {i+1}. {log}")

        print("\n9. Taking screenshot...")
        page.screenshot(path="final_test.png")
        print("   Saved to final_test.png")

        browser.close()

        print("\n=== FINAL TEST COMPLETE ===")
        success = event_received
        return success

if __name__ == "__main__":
    result = test_context_menu_final()
    print(f"\nFinal Result: {'PASS' if result else 'FAIL'}")
