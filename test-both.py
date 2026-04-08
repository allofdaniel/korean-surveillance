"""
Test both context menu actions and aircraft photo API
"""
from playwright.sync_api import sync_playwright
import time

def test_both():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # Test 1: Check aircraft photo API directly
        print("=" * 50)
        print("TEST 1: Aircraft Photo API")
        print("=" * 50)

        # Test with a known Korean aircraft registration
        api_url = "https://tbas.vercel.app/api/aircraft-photo?hex=71BE26&reg=HL8226"
        print(f"1. Fetching: {api_url}")

        api_response = page.evaluate(f"""
            async () => {{
                try {{
                    const res = await fetch('{api_url}');
                    const data = await res.json();
                    return {{ status: res.status, data: data }};
                }} catch (e) {{
                    return {{ error: e.message }};
                }}
            }}
        """)

        print(f"   Response: {api_response}")

        # Test 2: Context menu
        print("\n" + "=" * 50)
        print("TEST 2: Context Menu Actions")
        print("=" * 50)

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        print("2. Getting bundle hash...")
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

        print("4. Adding event listener for map fly...")
        page.evaluate("""
            window.__mapFlew = false;
            window.__markerAdded = false;

            // Listen for map moveend event
            const mapDiv = document.getElementById('map');
            if (mapDiv && mapDiv.__mapbox_map) {
                mapDiv.__mapbox_map.on('moveend', () => {
                    window.__mapFlew = true;
                    console.log('[TEST] Map flew to location');
                });
            }

            // Observer for marker
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList && node.classList.contains('context-menu-marker')) {
                            window.__markerAdded = true;
                            console.log('[TEST] Marker added');
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        """)

        viewport = page.viewport_size
        center_x = viewport['width'] // 2
        center_y = viewport['height'] // 2

        print(f"5. Right-clicking at ({center_x}, {center_y})...")
        page.mouse.click(center_x, center_y, button="right")

        print("6. Waiting for context menu...")
        time.sleep(2)

        context_menu = page.query_selector(".map-context-menu")
        if context_menu:
            print("   [OK] Context menu found!")
            print(f"   Visible: {context_menu.is_visible()}")

            # Find and click "이 위치로 이동" button
            print("7. Looking for '이 위치로 이동' button...")
            move_button = page.query_selector(".map-context-menu button:has-text('이 위치로 이동')")
            if move_button:
                print("   [OK] Found '이 위치로 이동' button, clicking...")
                move_button.click()
                time.sleep(2)

                # Check if map flew
                map_flew = page.evaluate("window.__mapFlew")
                print(f"   Map flew: {map_flew}")

            # Test marker add
            print("8. Right-clicking again to add marker...")
            page.mouse.click(center_x + 50, center_y + 50, button="right")
            time.sleep(1)

            marker_button = page.query_selector(".map-context-menu button:has-text('마커 추가')")
            if marker_button:
                print("   [OK] Found '마커 추가' button, clicking...")
                marker_button.click()
                time.sleep(1)

                # Check if marker was added
                marker = page.query_selector(".context-menu-marker")
                if marker:
                    print("   [OK] Marker was added!")
                else:
                    print("   [FAIL] Marker was NOT added")
        else:
            print("   [FAIL] Context menu NOT found")

        print("\n9. Console logs (last 15):")
        for i, log in enumerate(console_logs[-15:]):
            print(f"   {i+1}. {log}")

        page.screenshot(path="test_both.png")
        print("\n   Screenshot saved to test_both.png")

        browser.close()
        print("\n=== TEST COMPLETE ===")
        return True

if __name__ == "__main__":
    result = test_both()
    print(f"\nFinal Result: {'PASS' if result else 'FAIL'}")
