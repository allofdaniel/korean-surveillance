# aip-pipeline — eAIP 차트 → 검증 → 대한감시 지도 데이터

AIRAC마다 받은 **AIP PDF(AD 2 TEXT, 차트, Coding Table)**를 읽어서 공항별 절차·Fix·홀딩·장애물 데이터를 만들고,
대한감시 앱이 쓰는 `public/data/korea_airspace.json`에 **공항 단위로 교체 반영**합니다. Navigraph 데이터는 사용하지 않습니다.

> aim.koca.go.kr는 자동 수집을 허용하지 않으므로 이 패키지는 **네트워크 수집을 하지 않습니다.** PDF는 사람이 받아 inbox에 넣습니다.

## 처리 흐름
1. inbox의 PDF를 공항(ICAO)별로 자동 분류 (문서 내용에서 `RKxx AD CHART 2-x` 판독)
2. 페이지별 판독
   - 텍스트 PDF → PDF 텍스트를 표 셀 단위로 추출
   - 글자가 외곽선(벡터)인 PDF → 300dpi 렌더 → 표 격자 검출(OpenCV) → **셀 단위 OCR**(tesseract, 회전 표 자동 인식)
3. 표 분류: Coding Table(SID/STAR/RNP) · Holding · Fix/point 좌표표(재래식 접근) · 장애물(Type A/B) · AD 2 TEXT(ARP/THR/NAVAID/편차/CTR)
4. 재래식 SID: 차트 서술문 OCR → 레이디얼/DME/HDG 해석 → 형상 구성(근사 표시)
5. **검증**: 모든 TF 구간을 좌표로 재계산해 게재 거리(±0.15NM)·진방위(±1°)와 비교, 같은 Fix의 출처 간 좌표 차이(>15m) 검사, OCR 소수점 누락 자동 보정
6. 출력: `public/data/aip/<AIRAC>/<ICAO>.json|.geojson|_report.md`, 그리고 `korea_airspace.json`에 병합

## 실행
```bash
pip install -r requirements.txt   # + tesseract-ocr (eng), poppler 불필요
python -m aip_pipeline build --inbox <AIRAC폴더> --airac 2026-11-25 --out ../public/data/aip --app ../public/data/korea_airspace.json
```
- ENR 4.4/4.1 PDF를 inbox에 같이 넣으면 항로 Fix 좌표도 갱신합니다 (기본값: `aip_pipeline/enr_fixes.json`).

## 공항마다 넣을 파일
AD 2 TEXT(PDF/HTML) + AD CHART 전부(SID, STAR, IAC, Type A/B 포함). 파일 이름은 아무거나 괜찮습니다.

## 한계
- CA 구간 끝점, 재래식 SID 선회부는 근사(`approx: true`)
- 보호구역·OAS·CRM은 AIP에 없으므로 생성하지 않음
- 판독 결과는 PR의 리포트로 확인 후 병합하는 것을 원칙으로 함
