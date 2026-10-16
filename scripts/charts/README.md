# AIP chart pipeline

Run in order after each AIRAC (needs `pymupdf`, `numpy`, `pillow`, `tesseract`):

1. `fetch_aip_charts.py <cache>` — download every AD-2 chart PDF of the effective eAIP issue.
2. `build_chart_index.py <cache> public` — rasterise sheets, georeference from the graticule
   (refined with runway edges on aerodrome charts), write `public/charts/aip_index.json`.
3. `ocr_titles.py <cache> public` — OCR the title corner of sheets whose title is vector
   outlines (names like `INSTR APCH CHART (7)` become `ILS/DME RWY 04R`).
4. `overlay_qc.py public` — drop map overlays that fail the runway-centreline check
   (AREA / ATC surveillance minimum altitude charts are viewer-only).
