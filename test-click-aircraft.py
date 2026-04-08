"""
Test clicking aircraft and verifying photo display
"""
from playwright.sync_api import sync_playwright
import time

def test_click_aircraft():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        print("2. Waiting 15 seconds for map and aircraft to load...")
        time.sleep(15)

        # Take initial screenshot
        page.screenshot(path="before_click.png")
        print("   Initial screenshot saved")

        # Get aircraft count from store/state
        print("\n3. Checking for aircraft markers on map...")
        markers_info = page.evaluate("""
            () => {
                // Check for mapbox markers
                const markers = document.querySelectorAll('.mapboxgl-marker');
                const markerDetails = [];
                markers.forEach((m, i) => {
                    if (i < 5) {
                        markerDetails.push({
                            left: m.style.left,
                            top: m.style.top,
                            innerHTML: m.innerHTML.substring(0, 100)
                        });
                    }
                });

                // Check for aircraft-specific elements
                const aircraftIcons = document.querySelectorAll('[class*="aircraft"]');

                return {
                    markerCount: markers.length,
                    markerDetails: markerDetails,
                    aircraftIconCount: aircraftIcons.length
                };
            }
        """)
        print(f"   Markers: {markers_info['markerCount']}")
        print(f"   Aircraft icons: {markers_info['aircraftIconCount']}")
        if markers_info['markerDetails']:
            print(f"   Sample marker: {markers_info['markerDetails'][0]}")

        # Look for aircraft panel
        print("\n4. Checking if aircraft panel exists...")
        panel = page.query_selector(".aircraft-panel, .aircraft-detail-panel, [class*='detail-panel']")
        if panel:
            print("   Aircraft panel found")
        else:
            print("   No aircraft panel found yet")

        # Try to click on center of map (where aircraft might be)
        print("\n5. Trying to find and click an aircraft...")

        # Check if there are aircraft symbols on the canvas
        has_aircraft = page.evaluate("""
            () => {
                // Look for aircraft layer in map
                const mapDiv = document.getElementById('map');
                if (!mapDiv) return { error: 'No map div' };

                // Try to get aircraft from React state
                const panels = document.querySelectorAll('.aircraft-control-panel, [class*="aircraft"]');
                return { panelCount: panels.length };
            }
        """)
        print(f"   Aircraft-related elements: {has_aircraft}")

        # Try clicking on an aircraft by simulating a click at various positions
        viewport = page.viewport_size
        print(f"\n6. Viewport: {viewport['width']}x{viewport['height']}")

        # Try to trigger aircraft selection via JavaScript
        print("\n7. Attempting to select first aircraft via JS...")
        selection_result = page.evaluate("""
            () => {
                // This won't work directly, but let's see what's available
                // Look for any way to access aircraft data
                const scripts = Array.from(document.querySelectorAll('script'));
                const hasReact = !!document.querySelector('#root > div');
                return { hasReact: hasReact, scriptCount: scripts.length };
            }
        """)
        print(f"   {selection_result}")

        # Try clicking on the map in the middle
        print("\n8. Clicking on map center to check click handling...")
        page.mouse.click(viewport['width'] // 2, viewport['height'] // 2)
        time.sleep(1)

        # Check for aircraft detail panel
        print("\n9. Checking console logs for aircraft-related messages...")
        aircraft_logs = [log for log in console_logs if 'aircraft' in log.lower() or 'photo' in log.lower()]
        for log in aircraft_logs[-10:]:
            print(f"   {log[:150]}")

        # Check if the aircraft panel appeared
        panel = page.query_selector(".aircraft-detail-panel, [class*='AircraftDetailPanel']")
        if panel:
            print("\n10. Aircraft detail panel found!")
            is_visible = panel.is_visible()
            print(f"    Visible: {is_visible}")
        else:
            print("\n10. No aircraft detail panel found after clicking")

        # Take final screenshot
        page.screenshot(path="after_click.png")
        print("\n    Final screenshot saved to after_click.png")

        browser.close()
        print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_click_aircraft()
