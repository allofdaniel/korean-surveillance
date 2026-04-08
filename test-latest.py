"""
Test on latest Vercel deployment
"""
from playwright.sync_api import sync_playwright
import time

def test_latest():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # Use the latest deployment URL
        url = "https://rkpu-viewer-a6ppdrr1n-keprojects.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        print("2. Getting script sources...")
        scripts = page.evaluate("""
            () => {
                const scripts = document.querySelectorAll('script[src]');
                return Array.from(scripts).map(s => s.src);
            }
        """)
        for s in scripts:
            if 'index-' in s:
                hash = s.split('index-')[1].split('.')[0]
                print(f"   Bundle hash: {hash}")

        print("3. Waiting 10 seconds for map to load...")
        time.sleep(10)

        map_canvas = page.query_selector("canvas.mapboxgl-canvas")
        if map_canvas:
            print("   [OK] Map canvas found!")
        else:
            print("   [FAIL] Map canvas NOT found")
            browser.close()
            return False

        print("4. Adding event listener...")
        page.evaluate("""
            window.__mapContextMenuReceived = false;
            window.__mapContextMenuData = null;
            window.addEventListener('map-contextmenu', (e) => {
                window.__mapContextMenuReceived = true;
                window.__mapContextMenuData = e.detail;
                console.log('[TEST] map-contextmenu received!', e.detail);
            });
        """)

        viewport = page.viewport_size
        center_x = viewport['width'] // 2
        center_y = viewport['height'] // 2

        print(f"5. Right-clicking at ({center_x}, {center_y})...")
        page.mouse.click(center_x, center_y, button="right")

        print("6. Waiting for event...")
        time.sleep(3)

        event_received = page.evaluate("window.__mapContextMenuReceived")
        event_data = page.evaluate("window.__mapContextMenuData")

        print(f"\n7. Results:")
        print(f"   Event received: {event_received}")
        if event_data:
            print(f"   Event data: {event_data}")

        context_menu = page.query_selector(".map-context-menu")
        if context_menu:
            print("   [OK] Context menu element found!")
            print(f"   Visible: {context_menu.is_visible()}")
        else:
            print("   [INFO] Context menu element not found")

        print("\n8. Console logs (last 20):")
        for i, log in enumerate(console_logs[-20:]):
            print(f"   {i+1}. {log}")

        page.screenshot(path="latest_test.png")
        print("\n   Screenshot saved to latest_test.png")

        browser.close()
        print("\n=== TEST COMPLETE ===")
        return event_received

if __name__ == "__main__":
    result = test_latest()
    print(f"\nFinal Result: {'PASS' if result else 'FAIL'}")
