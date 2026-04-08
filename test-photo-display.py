"""
Test clicking on aircraft and checking if photo displays
"""
from playwright.sync_api import sync_playwright
import time

def test_photo_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        network_requests = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("request", lambda req: network_requests.append(req.url) if "aircraft-photo" in req.url else None)

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        print("2. Waiting 10 seconds for aircraft to load...")
        time.sleep(10)

        # Take initial screenshot
        page.screenshot(path="photo_test_1_initial.png")

        # Get aircraft positions from the map
        print("\n3. Getting aircraft label positions...")
        aircraft_positions = page.evaluate("""
            () => {
                // Try to find aircraft labels on the map
                // Looking for text elements that contain callsigns
                const labels = document.querySelectorAll('.mapboxgl-canvas');
                return { canvasCount: labels.length };
            }
        """)
        print(f"   Canvas elements: {aircraft_positions}")

        # The aircraft icons are likely rendered on the Mapbox canvas or as custom overlays
        # Let's try clicking on specific coordinates where we saw aircraft in the screenshot

        # Based on the screenshot, there are aircraft around:
        # - Center of Korea: around 36.5, 127.5
        # Let's try clicking somewhere aircraft might be

        print("\n4. Trying to click near aircraft locations...")

        # We need to convert map coordinates to screen coordinates
        # Since we can see aircraft scattered across Korea, let's try clicking at different spots

        viewport = page.viewport_size
        print(f"   Viewport: {viewport['width']}x{viewport['height']}")

        # Try clicking at several positions to find an aircraft
        test_positions = [
            (700, 300),  # Upper right area (near ANA216)
            (750, 350),  # Near KAL711
            (650, 400),  # Center area
            (700, 450),  # Near Ulsan
        ]

        aircraft_clicked = False
        for x, y in test_positions:
            print(f"\n5. Clicking at ({x}, {y})...")
            page.mouse.click(x, y)
            time.sleep(2)

            # Check if aircraft detail panel appeared
            detail_panel = page.query_selector(".aircraft-detail-panel")
            if detail_panel and detail_panel.is_visible():
                print(f"   [OK] Aircraft detail panel appeared!")
                aircraft_clicked = True

                # Check for photo in the panel
                photo_img = page.query_selector(".aircraft-detail-panel .aircraft-photo, .aircraft-detail-panel img")
                if photo_img:
                    src = photo_img.get_attribute('src')
                    print(f"   Photo src: {src[:80] if src else 'No src'}...")
                else:
                    print("   [INFO] No photo element found in panel")

                # Take screenshot with panel open
                page.screenshot(path="photo_test_2_panel.png")
                print("   Screenshot saved to photo_test_2_panel.png")
                break

        if not aircraft_clicked:
            print("\n6. No aircraft panel opened. Checking if showAircraft is enabled...")

            # Check if aircraft toggle is enabled
            toggle_state = page.evaluate("""
                () => {
                    // Find the aircraft toggle
                    const toggles = document.querySelectorAll('.toggle-item input[type="checkbox"]');
                    const aircraftPanel = document.querySelector('.aircraft-control-panel');
                    return {
                        toggleCount: toggles.length,
                        hasPanelClass: !!aircraftPanel
                    };
                }
            """)
            print(f"   {toggle_state}")

        # Check console for photo-related logs
        print("\n7. Photo-related console logs:")
        photo_logs = [log for log in console_logs if 'photo' in log.lower()]
        for log in photo_logs[-5:]:
            print(f"   {log[:150]}")

        # Check network requests for photo API
        print("\n8. Aircraft photo API requests:")
        for req in network_requests[-5:]:
            print(f"   {req}")

        browser.close()
        print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_photo_display()
