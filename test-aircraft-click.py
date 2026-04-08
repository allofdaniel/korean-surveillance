"""
Test aircraft click and photo loading on actual site
"""
from playwright.sync_api import sync_playwright
import time

def test_aircraft_click():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        network_requests = []

        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("response", lambda response: network_requests.append({
            "url": response.url,
            "status": response.status
        }) if "/api/aircraft" in response.url else None)

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        print("2. Waiting 15 seconds for map and aircraft to load...")
        time.sleep(15)

        # Find aircraft markers
        print("3. Looking for aircraft markers...")
        aircraft_markers = page.query_selector_all(".aircraft-marker, .aircraft-icon, [class*='aircraft']")
        print(f"   Found {len(aircraft_markers)} potential aircraft elements")

        # Also check for aircraft in canvas
        print("4. Checking for aircraft on map...")
        has_aircraft = page.evaluate("""
            () => {
                // Check if there are any aircraft in the store
                if (window.__ZUSTAND_DEVTOOLS_EXTENSION__) {
                    return 'zustand available';
                }
                // Look for aircraft DOM elements
                const elements = document.querySelectorAll('[class*="aircraft"]');
                return elements.length;
            }
        """)
        print(f"   Aircraft elements: {has_aircraft}")

        # Try clicking on map area where aircraft might be
        print("5. Looking for clickable aircraft...")

        # Use page.evaluate to find aircraft markers
        aircraft_found = page.evaluate("""
            () => {
                // Get all elements with aircraft-related classes
                const markers = document.querySelectorAll('.mapboxgl-marker');
                const aircraftMarkers = [];
                markers.forEach(m => {
                    if (m.querySelector('img, svg, [style*="aircraft"]') || m.style.cursor === 'pointer') {
                        aircraftMarkers.push({
                            left: m.style.left,
                            top: m.style.top,
                            transform: m.style.transform
                        });
                    }
                });
                return { markerCount: markers.length, aircraftMarkers: aircraftMarkers.slice(0, 5) };
            }
        """)
        print(f"   Mapbox markers: {aircraft_found}")

        # Check if aircraft layer exists
        print("6. Checking for aircraft source/layer...")
        has_aircraft_layer = page.evaluate("""
            () => {
                const mapDiv = document.getElementById('map');
                if (mapDiv && mapDiv._mapbox_map) {
                    const map = mapDiv._mapbox_map;
                    return {
                        sources: Object.keys(map.getStyle().sources || {}),
                        layers: (map.getStyle().layers || []).map(l => l.id).filter(id => id.includes('aircraft'))
                    };
                }
                // Try to get map from any Mapbox instance
                if (window.mapboxgl) {
                    return 'mapboxgl found';
                }
                return null;
            }
        """)
        print(f"   Aircraft layers: {has_aircraft_layer}")

        # Get any API calls for aircraft
        print("\n7. Network requests to /api/aircraft*:")
        for req in network_requests:
            print(f"   {req['status']} - {req['url']}")

        # Look in console for aircraft-related logs
        print("\n8. Aircraft-related console logs:")
        for log in console_logs:
            if 'aircraft' in log.lower() or 'photo' in log.lower() or 'image' in log.lower():
                print(f"   {log[:150]}")

        # Try to directly test the API from the page context
        print("\n9. Testing aircraft photo API from page context...")
        api_result = page.evaluate("""
            async () => {
                try {
                    const res = await fetch('/api/aircraft-photo?hex=71BE26&reg=HL8226');
                    const data = await res.json();
                    return { status: res.status, data: data };
                } catch (e) {
                    return { error: e.message };
                }
            }
        """)
        print(f"   API result: {api_result}")

        page.screenshot(path="test_aircraft_click.png")
        print("\n   Screenshot saved to test_aircraft_click.png")

        browser.close()
        print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_aircraft_click()
