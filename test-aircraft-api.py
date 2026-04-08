"""
Test aircraft API directly
"""
from playwright.sync_api import sync_playwright
import time

def test_aircraft_api():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        url = "https://tbas.vercel.app"
        print(f"1. Navigating to {url}...")
        page.goto(url, wait_until="load", timeout=60000)
        time.sleep(3)

        # Test aircraft API directly from page context
        print("\n2. Testing aircraft API from page context...")

        # RKPU airport coordinates
        lat = 35.5934
        lon = 129.3518

        api_result = page.evaluate(f"""
            async () => {{
                try {{
                    const res = await fetch('/api/aircraft?lat={lat}&lon={lon}&radius=100');
                    const status = res.status;
                    const text = await res.text();
                    let data;
                    try {{
                        data = JSON.parse(text);
                    }} catch (e) {{
                        data = text.substring(0, 500);
                    }}
                    return {{ status: status, data: data, aircraftCount: data?.ac?.length || 0 }};
                }} catch (e) {{
                    return {{ error: e.message }};
                }}
            }}
        """)

        print(f"   Status: {api_result.get('status', 'N/A')}")
        print(f"   Aircraft count: {api_result.get('aircraftCount', 'N/A')}")
        if 'error' in api_result:
            print(f"   Error: {api_result['error']}")
        elif api_result.get('aircraftCount', 0) > 0:
            print(f"   Sample aircraft: {api_result['data']['ac'][0] if api_result['data'].get('ac') else 'none'}")

        # Also test the aircraft-photo API
        print("\n3. Testing aircraft-photo API...")
        photo_result = page.evaluate("""
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
        print(f"   Photo API: {photo_result}")

        browser.close()
        print("\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    test_aircraft_api()
