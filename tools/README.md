# AIP Chart Georeferencer (`georef.html`)

로컬에서 여는 단일 HTML 도구. AIP AD 차트(PDF/PNG)를 위성 지도 위에 **기준점(GCP) 기반 affine 변환**으로 정확히 맞추고,
`useChartOverlay.ts`에 바로 넣을 수 있는 **4-corner `bounds`** 를 뽑아냅니다. 미리보기는 프로덕션과 동일한
Mapbox `image` 소스(4-corner)로 렌더되므로, 여기서 맞으면 앱에서도 똑같이 맞습니다.

## 왜 자동이 아니라 GCP 방식인가
스캔된 항공차트는 Lambert 등 투영 + 회전/축척이 섞여 있어 ARP 중심 고정박스(기존 `auto_georeference.py` 휴리스틱)로는
지도와 1:1이 안 맞습니다. 차트의 실제 지상 지점 3~4개(활주로 끝, VOR/DME, 교차점)를 실제 좌표에 대응시키면
최소제곱 affine으로 정확한 코너 좌표가 나옵니다. QGIS·MapTiler가 쓰는 정석 방식입니다.

## 실행
1. 브라우저에서 `tools/georef.html`를 그냥 엽니다(더블클릭). 
2. 우상단 **token** 칸에 Mapbox `pk.*` 토큰을 붙여넣습니다.
   - 프로덕션 토큰은 도메인 제한이 걸려 있어 로컬에서 막힐 수 있습니다. **URL 제한 없는 토큰**(또는 허용 URL에
     `http://localhost/*`, `file://*` 추가)을 쓰세요. Mapbox 계정 → Access tokens에서 발급/수정.
3. **차트 열기**로 AD 차트 PDF를 로드(`tools/charts/RKPU/`에 RKPU 샘플 3종 받아둠).

## RKPU 프루프 (3분)
1. 공항 = `RKPU`, 차트 열기 → `RKPU_AD_CHART.pdf`.
2. **GCP 추가** → 차트에서 **활주로 36 끝(남쪽 threshold)** 클릭 → 위성 지도에서 같은 활주로 끝 클릭.
   - 지도의 파란 점(기준점)은 AIP에서 뽑은 실제 좌표라, 근처 파란 점을 클릭하면 정확히 스냅됩니다.
3. **활주로 18 끝(북쪽)**, **VOR/DME 또는 유도로 교차점** 등으로 3~4개 반복.
4. 3개째부터 오버레이가 지도에 맞춰지고 **RMS 오차(m)** 가 뜹니다. 정밀(<40m)이 목표.
5. **bounds 복사** → `src/hooks/useChartOverlay.ts`의 해당 차트 bounds에 붙여넣기(순서: TL, TR, BR, BL).

## 출력 형식
```json
{ "id":"RKPU/(2-1) AD CHART", "icao":"RKPU", "model":"affine",
  "coordinates":[[lonTL,latTL],[lonTR,latTR],[lonBR,latBR],[lonBL,latBL]] }
```
`coordinates`가 Mapbox image-source / `ChartBounds` 순서와 동일합니다.

## 좌표 입력
GCP 원장의 각 행에서 좌표를 직접 수정 가능. 10진수(`35.5933, 129.3522`) 또는
DMS(`353536N 1292108E`) 모두 인식합니다.
