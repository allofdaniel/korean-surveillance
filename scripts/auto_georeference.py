"""
자동 차트 georeferencing 스크립트
차트 이미지에서 위경도 그리드를 OCR로 읽어서 bounds 계산
"""
import os
import json
import re
from pathlib import Path

try:
    from PIL import Image
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    print("Warning: pytesseract not available, using heuristic bounds")

# 경로 설정
CHARTS_DIR = Path(r"C:\data\aip\charts")
OUTPUT_FILE = Path(r"C:\Users\allof\Desktop\251212 GIS\rkpu-viewer\public\charts\all_chart_bounds.json")
AIRPORTS_FILE = Path(r"C:\Users\allof\Desktop\251212 GIS\rkpu-viewer\scripts\korea_airports.json")

# 공항 데이터 로드
with open(AIRPORTS_FILE, 'r', encoding='utf-8') as f:
    airports_data = json.load(f)['airports']

# 차트 인덱스 로드
charts_index_file = CHARTS_DIR / "charts_index.json"
with open(charts_index_file, 'r', encoding='utf-8') as f:
    charts_index = json.load(f)

def parse_coord_from_text(text):
    """텍스트에서 위경도 좌표 파싱"""
    # 패턴: 129°10'E, 35°30'N 등
    lon_pattern = r"(\d{2,3})°(\d{1,2})'?E"
    lat_pattern = r"(\d{1,2})°(\d{1,2})'?N"

    lons = re.findall(lon_pattern, text)
    lats = re.findall(lat_pattern, text)

    lon_values = [float(d) + float(m)/60 for d, m in lons]
    lat_values = [float(d) + float(m)/60 for d, m in lats]

    return lat_values, lon_values

def get_heuristic_bounds(airport_icao, chart_type):
    """차트 유형별 휴리스틱 bounds 계산"""
    if airport_icao not in airports_data:
        return None

    arp = airports_data[airport_icao]
    lat, lon = arp['lat'], arp['lon']

    # 차트 유형별 범위 (도 단위)
    ranges = {
        'IAC': (0.25, 0.25),      # Instrument Approach Chart
        'SID': (0.5, 0.5),        # Standard Instrument Departure
        'STAR': (0.5, 0.5),       # Standard Terminal Arrival Route
        'ADC': (0.03, 0.03),      # Airport Diagram Chart
        'GMC': (0.02, 0.02),      # Ground Movement Chart
        'PDC': (0.02, 0.02),      # Parking/Docking Chart
        'VAC': (0.15, 0.15),      # Visual Approach Chart
        'AOC-A': (0.3, 0.3),      # Obstacle Chart Type A
        'AOC-B': (0.5, 0.5),      # Obstacle Chart Type B
        'OTHER': (0.2, 0.2),
        'BIRD': (0.5, 0.5),
    }

    lat_range, lon_range = ranges.get(chart_type, (0.3, 0.3))

    # Mapbox image source coordinates: [top-left, top-right, bottom-right, bottom-left]
    bounds = [
        [lon - lon_range, lat + lat_range],  # top-left (NW)
        [lon + lon_range, lat + lat_range],  # top-right (NE)
        [lon + lon_range, lat - lat_range],  # bottom-right (SE)
        [lon - lon_range, lat - lat_range],  # bottom-left (SW)
    ]

    return bounds

def extract_bounds_from_image(image_path):
    """차트 이미지에서 OCR로 bounds 추출 시도"""
    if not HAS_OCR:
        return None

    try:
        img = Image.open(image_path)
        # 상단과 우측 가장자리에서 좌표 텍스트 추출
        width, height = img.size

        # 상단 10% 영역 (경도 표시)
        top_region = img.crop((0, 0, width, int(height * 0.1)))
        top_text = pytesseract.image_to_string(top_region)

        # 우측 10% 영역 (위도 표시)
        right_region = img.crop((int(width * 0.9), 0, width, height))
        right_text = pytesseract.image_to_string(right_region)

        # 좌표 파싱
        lats_top, lons_top = parse_coord_from_text(top_text)
        lats_right, lons_right = parse_coord_from_text(right_text)

        all_lats = lats_top + lats_right
        all_lons = lons_top + lons_right

        if len(all_lats) >= 2 and len(all_lons) >= 2:
            min_lat, max_lat = min(all_lats), max(all_lats)
            min_lon, max_lon = min(all_lons), max(all_lons)

            return [
                [min_lon, max_lat],
                [max_lon, max_lat],
                [max_lon, min_lat],
                [min_lon, min_lat],
            ]
    except Exception as e:
        print(f"OCR failed for {image_path}: {e}")

    return None

def process_all_charts():
    """모든 차트 처리"""
    all_bounds = {}

    for airport_icao, airport_charts in charts_index.get('airports', {}).items():
        print(f"\nProcessing {airport_icao}...")
        all_bounds[airport_icao] = {}

        for chart in airport_charts.get('charts', []):
            local_path = chart.get('local_path')
            if not local_path:
                continue
            chart_type = chart.get('chart_type', 'OTHER')
            chart_name = chart.get('name', '')

            # PNG 파일 경로
            pdf_path = CHARTS_DIR / local_path
            png_path = pdf_path.with_suffix('.png')

            if not png_path.exists():
                continue

            # chart ID 생성
            chart_id = png_path.stem

            # bounds 추출 시도
            bounds = None

            # 1. OCR 시도
            if HAS_OCR:
                bounds = extract_bounds_from_image(png_path)

            # 2. OCR 실패 시 휴리스틱 사용
            if bounds is None:
                bounds = get_heuristic_bounds(airport_icao, chart_type)

            if bounds:
                all_bounds[airport_icao][chart_id] = {
                    'bounds': bounds,
                    'type': chart_type,
                    'name': chart_name,
                    'file': f"/charts/{airport_icao}/{png_path.parent.name}/{png_path.name}",
                    'method': 'ocr' if HAS_OCR and bounds else 'heuristic'
                }
                print(f"  - {chart_type}: {chart_name} -> bounds calculated")

    return all_bounds

def main():
    print("=== Auto Chart Georeferencing ===")
    print(f"Charts directory: {CHARTS_DIR}")
    print(f"OCR available: {HAS_OCR}")

    all_bounds = process_all_charts()

    # 출력 디렉토리 생성
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # JSON 저장
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_bounds, f, indent=2, ensure_ascii=False)

    # 통계
    total_charts = sum(len(charts) for charts in all_bounds.values())
    print(f"\n=== Complete ===")
    print(f"Airports: {len(all_bounds)}")
    print(f"Total charts: {total_charts}")
    print(f"Output: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
