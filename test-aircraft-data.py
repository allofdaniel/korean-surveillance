"""
Test aircraft data loading and visualization
"""
from playwright.sync_api import sync_playwright
import time

def test_aircraft_data():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        console_logs = []
        network_responses = []

        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("response", lambda res: network_responses.append({
            "url": res.url,
            "status": res.status
        }) if "adsb" in res.url.lower() or "opensky" in res.url.lower() or "aircraft" in res.url.lower() else None)

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)

        print("2. Waiting 20 seconds for aircraft data to load...")
        time.sleep(20)

        # Check aircraft API calls
        print("\n3. Network requests for aircraft data:")
        for res in network_responses:
            print(f"   {res['status']} - {res['url'][:100]}")

        # Check console for aircraft-related logs
        print("\n4. Console logs (all):")
        for i, log in enumerate(console_logs[:50]):
            print(f"   {i+1}. {log[:200]}")

        # Check if aircraft are loaded
        print("\n5. Checking aircraft store state...")
        aircraft_state = page.evaluate("""
            () => {
                // Try to access React state or Zustand store
                const aircraftDiv = document.querySelector('.aircraft-count, [class*="aircraft"]');
                if (aircraftDiv) {
                    return { text: aircraftDiv.textContent, className: aircraftDiv.className };
                }

                // Look for aircraft on the map
                const mapDiv = document.getElementById('map');
                if (mapDiv) {
                    const aircraftSymbols = mapDiv.querySelectorAll('[class*="aircraft"]');
                    return { aircraftSymbolsCount: aircraftSymbols.length };
                }

                return null;
            }
        """)
        print(f"   Aircraft state: {aircraft_state}")

        # Try to call the aircraft API directly
        print("\n6. Testing aircraft API...")
        api_result = page.evaluate("""
            async () => {
                try {
                    // Try OpenSky
                    const res = await fetch('https://opensky-network.org/api/states/all?lamin=35&lamax=37&lomin=127&lomax=131');
                    if (res.ok) {
                        const data = await res.json();
                        return { source: 'opensky', count: data.states?.length || 0 };
                    }
                    return { error: 'OpenSky failed', status: res.status };
                } catch (e) {
                    return { error: e.message };
                }
            }
        """)
        print(f"   API result: {api_result}")

        # Take screenshot
        page.screenshot(path="test_aircraft_data.png")
        print("\n   Screenshot saved to test_aircraft_data.png")

        browser.close()
        print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_aircraft_data()
