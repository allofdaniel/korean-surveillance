"""
Context Menu Test for tbas.vercel.app
Tests right-click functionality on the map
"""
from playwright.sync_api import sync_playwright
import time

def test_context_menu():
    with sync_playwright() as p:
        # Launch browser (headless=False to see what's happening)
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # Capture ALL console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Navigating to rkpu-viewer production...")
        page.goto("https://rkpu-viewer-1s48cc21x-keprojects.vercel.app", wait_until="load", timeout=60000)

        print("2. Waiting for map to load...")
        time.sleep(6)  # Wait for map initialization

        # Check if map canvas exists
        map_canvas = page.query_selector("canvas.mapboxgl-canvas")
        if map_canvas:
            print("   [OK] Map canvas found!")
        else:
            print("   [FAIL] Map canvas NOT found")
            browser.close()
            return False

        print("3. Adding custom event listener to detect 'map-contextmenu' event...")
        # Inject a listener for the custom event BEFORE right-clicking
        page.evaluate("""
            window.__mapContextMenuReceived = false;
            window.__mapContextMenuData = null;
            window.addEventListener('map-contextmenu', (e) => {
                window.__mapContextMenuReceived = true;
                window.__mapContextMenuData = e.detail;
                console.log('[INJECTED] map-contextmenu received!', e.detail);
            });
            console.log('[INJECTED] Listener added for map-contextmenu');
        """)

        print("4. Getting map container dimensions...")
        viewport = page.viewport_size
        center_x = viewport['width'] // 2
        center_y = viewport['height'] // 2
        print(f"   Center point: ({center_x}, {center_y})")

        print("5. Performing right-click on map center...")
        page.mouse.click(center_x, center_y, button="right")

        print("6. Waiting for event and context menu...")
        time.sleep(2)

        # Check if custom event was received
        event_received = page.evaluate("window.__mapContextMenuReceived")
        event_data = page.evaluate("window.__mapContextMenuData")
        print(f"\n7. Custom event 'map-contextmenu' received: {event_received}")
        if event_data:
            print(f"   Event data: {event_data}")

        # Check for context menu
        context_menu = page.query_selector(".map-context-menu")
        if context_menu:
            print("\n8. [OK] Context menu found!")
            # Get menu content
            menu_html = context_menu.inner_html()
            print(f"   Menu HTML: {menu_html[:300]}...")
        else:
            print("\n8. [FAIL] Context menu NOT found (.map-context-menu)")

            # List all elements with position:absolute that might be context menus
            abs_elements = page.query_selector_all("[style*='position: absolute']")
            print(f"   Found {len(abs_elements)} absolute positioned elements")

        print("\n9. Console logs from page:")
        for i, log in enumerate(console_logs[-20:]):  # Last 20 logs
            print(f"   {i+1}. {log}")

        print("\n10. Taking screenshot...")
        page.screenshot(path="context_menu_test.png")
        print("    Screenshot saved to context_menu_test.png")

        browser.close()

        print("\n=== TEST COMPLETE ===")
        success = event_received and bool(context_menu)
        return success

if __name__ == "__main__":
    result = test_context_menu()
    print(f"\nFinal Result: {'PASS' if result else 'FAIL'}")
