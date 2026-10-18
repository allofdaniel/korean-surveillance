# AIP chart pipeline

Run in order after each AIRAC (needs `pymupdf`, `numpy`, `pillow`, `tesseract`):

1. `fetch_aip_charts.py <cache>` — download every AD-2 chart PDF of the effective eAIP issue.
2. `build_chart_index.py <cache> public` — rasterise sheets, georeference from the graticule
   (refined with runway edges on aerodrome charts), write `public/charts/aip_index.json`.
3. `ocr_titles.py <cache> public` — OCR the title corner of sheets whose title is vector
   outlines (names like `INSTR APCH CHART (7)` become `ILS/DME RWY 04R`).
4. `ocr_georef.py <cache> public` — aerodrome / parking / ground-movement sheets whose graticule
   labels are outlines (RKTN, RKPK, …): OCR the labels and georeference them the same way.
   Sheets marked NOT TO SCALE (RKJK, RKNW, RKPS, RKSM, RKSI 2-1) are never draped on the map.
5. `add_clip.py <cache> public` — only for indexes built before overlays carried `clip`.
   `clear_tints.py public` — re-apply the background mask to existing overlay rasters.
6. `overlay_qc.py public` — drop map overlays that fail the runway-centreline check
   (AREA / ATC surveillance minimum altitude charts are viewer-only).
