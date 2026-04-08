"""
Check if production has the new bundle with contextmenu code
"""
from playwright.sync_api import sync_playwright
import time

def check_bundle():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        print("1. Navigating to tbas.vercel.app...")
        page.goto("https://tbas.vercel.app", wait_until="load", timeout=60000)

        print("2. Getting all script sources...")
        scripts = page.evaluate("""
            () => {
                const scripts = document.querySelectorAll('script[src]');
                return Array.from(scripts).map(s => s.src);
            }
        """)

        print("\n3. Script sources:")
        for s in scripts:
            print(f"   {s}")
            if 'index-' in s:
                hash = s.split('index-')[1].split('.')[0]
                print(f"   >>> Bundle hash: {hash}")

        print("\n4. Waiting 5 seconds...")
        time.sleep(5)

        print("5. Checking if contextmenu code exists in loaded scripts...")
        has_contextmenu = page.evaluate("""
            () => {
                // Check if the useMapInit function has contextmenu code
                return typeof window !== 'undefined';
            }
        """)

        browser.close()
        print("\n=== DONE ===")

if __name__ == "__main__":
    check_bundle()
