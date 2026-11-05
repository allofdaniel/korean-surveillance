# aip-pipeline — eAIP 차트 → 검증 → 대한감시 지도 데이터

AIRAC마다 받은 **AIP PDF(AD 2 TEXT, 차트, Coding Table)**를 읽어서 공항별 절차·Fix·홀딩·장애물 데이터를 만들고,
대한감시 앱이 쓰는 `public/data/korea_airspace.json`에 **공항 단위로 교체 반영**합니다.
좌표·거리·방위는 전부 AIP에서 가져오고, Navigraph는 `reference/navigraph_ref.json`에 둔 **참고용**(재래식 절차의 레그 구조, 대조 검증)으로만 씁니다.

> aim.koca.go.kr는 자동 수집을 허용하지 않으므로 이 패키지는 **네트워크 수집을 하지 않습니다.** PDF는 사람이 받아 inbox에 넣습니다.

## 처리 흐름
1. inbox의 PDF를 공항(ICAO)별로 자동 분류 (문서 내용에서 `RKxx AD CHART 2-x` 판독)
2. 페이지별 판독
   - 텍스트 PDF → PDF 텍스트를 표 셀 단위로 추출
   - 글자가 외곽선(벡터)인 PDF → 300dpi 렌더 → 표 격자 검출(OpenCV) → **셀 단위 OCR**(tesseract, 회전 표 자동 인식)
3. 표 분류: Coding Table(SID/STAR/RNP) · Holding · Fix/point 좌표표(재래식 접근) · 장애물(Type A/B) · AD 2 TEXT(ARP/THR/NAVAID/편차/CTR)
4. 재래식 절차(DME arc·HDG·레이디얼): `template.py`
   - 기준 DB의 ARINC-424 레그 구조(CA/CF/AF/VI/VD…)를 가져오되 **모든 점을 AIP로 다시 계산**:
     AIP Fix 표·ENR 4.4 → AIP 항행안전시설 위치 + 방위/DME(D-fix, arc 끝점) → AIP 활주로 시단 기준(최종접근 fix)
   - VOR 편차는 AIP 안에서 보정: 차트의 `R ddd NAV/Dnn` 정의와 AIP Fix 좌표로 시설별 유효 편차 산출
   - DME arc는 AIP 시설 위치 중심, arc 끝은 차트의 `NAV Dnn arc … R ddd NAV2` 교차점으로 계산
   - SID 선회는 반경 1.5NM(210kt/25°)로 모델링, 차트에 적힌 선회 방향 사용
   - **차트 대조**: 현재 AIP 차트(텍스트 또는 이미지 OCR)에 fix 이름·코스가 실려 있어야 반영 → 구판 절차는 자동 제외
   - AIP 차트 이름으로 재명명 (예: SOORO2.RW36B + SOORO2.KALOD → KALOD 1S)
5. **검증**: 모든 TF 구간을 좌표로 재계산해 게재 거리(±0.15NM)·진방위(±1°)와 비교, 같은 Fix의 출처 간 좌표 차이(>15m) 검사, OCR 소수점 누락 자동 보정
6. 출력: `public/data/aip/<AIRAC>/<ICAO>.json|.geojson|_report.md`, 그리고 `korea_airspace.json`에 병합

## 실행
```bash
pip install -r requirements.txt   # + tesseract-ocr (eng), poppler 불필요
python -m aip_pipeline build --inbox <AIRAC폴더> --airac 2026-11-25 --out ../public/data/aip --app ../public/data/korea_airspace.json
```
- ENR 4.4/4.1 PDF를 inbox에 같이 넣으면 항로 Fix 좌표도 갱신합니다 (기본값: `aip_pipeline/enr_fixes.json`).
- OCR/표 판독 결과는 파일 해시로 캐시(`~/.cache/aip_pipeline`) → 파서 수정 후 재실행 1~2분.

## 공항마다 넣을 파일
AD 2 TEXT(PDF/HTML) + AD CHART 전부(SID, STAR, IAC, Type A/B 포함). 파일 이름은 아무거나 괜찮습니다.

## 한계
- CA 구간 끝점(상승률 가정), 선회 반경은 근사
- 기준 DB에도 없는 재래식 절차(서술문만 있는 것)는 서술문 해석으로만 그림
- 장애물: AD 2.10(TEXT) + Type A + Type B 장애물 표를 합쳐 공항별로 정리(같은 장애물은 15 m·2 m 이내면 하나로, 출처 모두 기록)
  → `public/aviation_data.json`의 `obstacles`(앱 장애물 레이어)로 내보냄
- ENR 5.4(국가 항행장애물, 100 m AGL 이상) → `ENR54_obstacles.json` + 앱 레이어
- 지형: Copernicus DEM GLO-30(30 m, 공개데이터)으로 장애물 지반고 산출 → 높이만 있는 장애물의 표고 보완,
  AIP 표고가 지형+높이와 40 m 넘게 어긋나면 보수적 값(지형+높이)을 쓰고 원래 값·사유를 `qa`에 기록
- Supabase 적재: `supabase/001_aip_tables.sql`(테이블) + `scripts/load_supabase.py`(AIRAC 단위 업로드)
- 보호구역·OAS·CRM은 AIP에 없으므로 생성하지 않음
- 판독 결과는 PR의 리포트로 확인 후 병합하는 것을 원칙으로 함
