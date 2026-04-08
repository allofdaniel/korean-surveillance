#!/usr/bin/env python3
"""Download all RKPU charts from Navigraph API"""
import requests
import os
from pathlib import Path

# Known RKPU chart codes from observation
CHART_CODES = [
    # STAR (10-x)
    "102", "102a", "102b",
    # APP (11-x)
    "111", "112", "113", "114", "115", "116",
    # TAXI (22-x)
    "221", "222", "223",
    # REF (20-x)
    "201", "202",
    # Try additional codes
    "101", "103", "104",
    "117", "118", "119",
    "224", "225",
]

def download_chart(code):
    """Download a single chart"""
    url = f"https://api.navigraph.com/v2/charts/RKPU/rkpu{code}_d.png"
    output_dir = Path("C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/tbas/charts")
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / f"rkpu{code}_d.png"

    try:
        print(f"Downloading {code}...", end=" ")
        response = requests.get(url, timeout=30)

        if response.status_code == 200:
            with open(output_file, 'wb') as f:
                f.write(response.content)
            print(f"OK Saved ({len(response.content)} bytes)")
            return True
        elif response.status_code == 404:
            print("NOT FOUND")
            return False
        else:
            print(f"ERROR {response.status_code}")
            return False
    except Exception as e:
        print(f"EXCEPTION: {e}")
        return False

def main():
    print("="*60)
    print("RKPU CHART DOWNLOADER")
    print("="*60)
    print()

    downloaded = []
    not_found = []

    for code in CHART_CODES:
        if download_chart(code):
            downloaded.append(code)
        else:
            not_found.append(code)

    print()
    print("="*60)
    print(f"Downloaded: {len(downloaded)} charts")
    print(f"Not found: {len(not_found)} charts")
    print("="*60)

    if downloaded:
        print("\nDownloaded charts:")
        for code in downloaded:
            print(f"  - rkpu{code}_d.png")

if __name__ == '__main__':
    main()
