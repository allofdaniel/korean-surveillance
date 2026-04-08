#!/usr/bin/env python3
"""Download Navigraph resources (sprites, style, charts)"""
import requests
import os
from pathlib import Path

OUTPUT_DIR = Path("C:/Users/allof/Desktop/251212 GIS/rkpu-viewer/navigraph-analysis")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def download_file(url, filename):
    """Download a file from URL"""
    try:
        print(f"Downloading {filename}...", end=" ")
        response = requests.get(url, timeout=30)

        if response.status_code == 200:
            output_path = OUTPUT_DIR / filename
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"OK ({len(response.content)} bytes)")
            return True
        else:
            print(f"ERROR {response.status_code}")
            return False
    except Exception as e:
        print(f"EXCEPTION: {e}")
        return False

def main():
    print("="*60)
    print("NAVIGRAPH RESOURCE DOWNLOADER")
    print("="*60)
    print()

    # Download sprite.json
    download_file(
        'https://enroute.charts.api-v2.navigraph.com/sprites/sprite.json',
        'sprite.json'
    )

    # Download sprite.png
    download_file(
        'https://enroute.charts.api-v2.navigraph.com/sprites/sprite.png',
        'sprite.png'
    )

    # Download style.json
    download_file(
        'https://enroute.charts.api-v2.navigraph.com/style.json',
        'style.json'
    )

    print()
    print("="*60)
    print("Download complete!")
    print("="*60)

if __name__ == '__main__':
    main()
