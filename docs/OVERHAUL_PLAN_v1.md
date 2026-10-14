# 대한감시(Korean Surveillance) 전면 개편 설계서 v1

작성일: 2026-10-14
대상: koreansurveillance.com (현 koreasurveillance.com User-Agent 혼용 — §9 확인 필요)
근거: Navigraph Charts 역공학 분석(main.bundle.js) + 현행 korean-surveillance 소스 직접 분석

---

## 0. 이 문서의 목적

현행 서비스를 (A) **항적/오류 정상화**와 (B) **AIP 차트 뷰어(Navigraph식)** 두 축으로
전면 개편하기 위한 아키텍처·데이터·단계 계획을 정의한다. 코드 수정은 로컬 레포에서 직접 진행한다.

---

## 1. 현행 진단 요약

### 1.1 항적(trail)이 안 나오는 3대 원인 (코드 확인 완료)

| ID | 원인 | 위치 | 상세 |
|----|------|------|------|
| TR-1 | trace 이력 시딩이 근본적으로 깨짐 | `api/aircraft-trace.js`, `hooks/useAircraftData.ts` | 프런트는 `result.ac[0].trace` 배열을 기대하나, 프록시 대상 `adsb.lol/v2/hex/{hex}`는 **현재 위치 1점만 반환**하고 `trace` 배열이 없음 → 모든 항공기에서 `ac.trace === undefined` → 이력 0 |
| TR-2 | 실시간 폴링 간격이 성김 | `constants/config.ts` `AIRCRAFT_UPDATE_INTERVAL=5000` | 5초 간격이라 제트기 기준 점 간격 ~0.6NM. `i % 3 === 2 continue`(점선) 겹쳐 더 듬성 |
| TR-3 | 항적을 3D 리본으로만 그림 | `hooks/useAircraftVisualization.ts` Effect B | `aircraft-trails-3d`(fill-extrusion)만 채우고 `aircraft-trails-2d`/`-arrows`는 **빈 소스만 생성**. → 2D 뷰·낮은 pitch에서 항적 미표시 |

### 1.2 그 외

- **인코딩 깨짐**: `aircraft.js`, `useAircraftData.ts`, `config.ts` 등 BOM + 한글 주석 모지바케(CP949↔UTF-8). `config.ts`의 `console.error` 사용자 문자열은 실제로 깨져 출력됨. → UTF-8(no BOM) 통일 필요.
- **데이터 소스 혼선**: 코드 주석/문서가 airplanes.live / adsb.lol / OpenSky를 혼용. 현재 실동작은 `adsb.lol`(primary) + OpenSky(merge, circuit breaker). airplanes.live는 2026-05 이후 anonymous 403.
- **구조**: 과거 모놀리식 App.jsx(5,641줄)은 이미 TS + hooks/stores/components로 리팩토링됨(양호). 단 테스트 커버리지/타입 안전성은 미흡.

---

## 2. Navigraph에서 채택할 설계 원칙

REA로 추출한 `main.bundle.js`(291,294줄) 분석에서 확인된, 우리가 가져올 핵심:

1. **좌표는 서버/빌드 단계에서 미리 계산, 클라이언트는 렌더만.**
   Navigraph는 AF/TF/CF 등 ARINC 424 leg를 GraphQL 서버가 미리 좌표로 풀어 내려줌.
   → 우리도 절차/항로 geometry를 **빌드 타임에 정적 GeoJSON으로 굽는다.** 클라이언트 `interpolateArc` 실시간 계산 지양.
2. **벡터 타일(PBF) 기반 레이어링.** 공항 레이아웃(활주로/유도로/게이트)은 AMDB식 피처 타입 enum으로 구조화.
3. **래스터 차트 = georeference overlay.** 각 차트에 (픽셀 bbox ↔ 지리 bbox) 두 쌍 → affine 변환으로 지도 위 정합. **AIP 1:1 매칭의 해법.**
4. **UI**: 다크 테마, 좌측 접이식 패널, 프로시저 고정 색상(SID `#cb4c8b`/STAR `#6ca550`/APP `#ec7b2c`/공항 `#198080`/airway `#7e429a`), 줌 기반 심볼 3단계 크기, Day/Night 반전. (상당수 이미 `colors.ts`/`index.css`에 반영됨)

---

## 3. 목표 아키텍처

```
Presentation (React/TS)
  ├─ MapCanvas (Mapbox GL)         지도 + 레이어 오케스트레이션
  ├─ layers/  AircraftLayer, TrailLayer(2D+3D), AipChartLayer, ProcedureLayer, AirspaceLayer
  ├─ panels/  Aircraft, Weather, NOTAM, Procedure, LayerToggle
  └─ hooks/   데이터 훅 (아래 Domain 호출)
Domain
  ├─ entities  Aircraft, Trail, Chart(georef), Procedure, Airspace
  └─ usecases  TrackAircraft, BuildTrail, RenderAipChart, LoadProcedure
Infrastructure
  ├─ api/ (Vercel functions)  aircraft, aircraft-trace(교체), weather, notam, chart-meta
  ├─ clients  AdsbClient, OpenSkyClient, EaipClient
  └─ data/    정적 GeoJSON(절차/항로/공역), 차트 georef 메타 JSON
```

핵심 원칙: 외부 API는 Infra 레이어 뒤로 숨기고, 레이어 컴포넌트는 "소스+레이어 upsert" 한 가지 패턴(현 `setOrCreateSource`)으로 통일.

---

## 4. 항적(Trail) 재설계 — 최우선

### 4.1 데이터 소스: 두 경로를 분리

항적은 두 종류가 필요하고, 서로 다른 소스로 채운다.

- **실시간 누적 trail (live)**: `/api/aircraft` 폴링 결과를 프런트에서 hex별로 누적. (현행 유지하되 §4.2 보강)
- **과거 이력 trail (history/seed)**: 새 항공기를 처음 봤을 때 과거 경로를 한 번에 채우는 용도.
  현행 TR-1의 근본 수정 — 아래 중 택1:
  - **(권장) adsb.lol 트레이스 전용 엔드포인트 사용.** adsb.lol/tar1090 계열은 `/v2/hex/`가 아니라 별도 trace JSON(`/data/traces/{xx}/trace_full_{hex}.json` 형태, tar1090)을 제공. 가용 여부·CORS를 확인하고 `/api/aircraft-trace`가 이 경로를 프록시하도록 교체.
  - **(대안) OpenSky `/tracks/all?icao24=&time=0`**: 인증 필요하나 안정적. 분해능은 거침.
  - **(최후) 자체 이력 축적**: Upstash Redis/Supabase에 폴링 좌표를 hex+timestamp로 적재해 자체 trace API 구성. (이미 `@upstash/redis`, `pg`, `supabase/` 존재 → 실현 가능)
  → trace 응답 스키마가 바뀌므로 `loadAircraftTrace()` 파서를 소스에 맞게 재작성.

### 4.2 live 누적 품질 개선

- 폴링 간격은 5s 유지(상류 부하), 단 **프런트 보간(Kalman, 이미 `utils/kalman.ts` 존재)으로 표시 위치는 매끄럽게**, trail 점은 실측만 적재(현 구조 유지).
- "최소 2점 전까지 미표시" 체감을 줄이려 history seed(§4.1)로 초기 공백 제거.

### 4.3 렌더링: 2D/3D 모두 지원 (TR-3 수정)

- `TrailLayer`를 뷰 모드로 분기:
  - **2D 뷰**: `line` 레이어(`aircraft-trails-2d`)를 실제로 채움. 고도→색(altitude ramp) + age→opacity.
  - **3D 뷰**: 기존 `fill-extrusion` 리본 유지.
- 점선 효과(`i%3===2`)는 2D에서는 `line-dasharray`로 대체(세그먼트 누락 방식 제거).
- 색: 현 `rgba(0,255,136,·)` 고정 대신 `TRAIL_COLOR`(#39FF14) 또는 고도 램프로 통일.

---

## 5. AIP 차트 Georeferencing 서브시스템 (목표 핵심)

### 5.1 문제

국내 AIP 차트(aim.koca.go.kr eAIP)는 PDF/래스터이고 지리 메타데이터가 없어 지도에 1:1로 안 맞음.
Navigraph는 차트마다 (픽셀 bbox ↔ 지리 bbox)를 들고 affine 변환으로 정합한다. 우리는 그 메타를 **직접 만들어야** 한다.

### 5.2 파이프라인 (기존 `scripts/auto_georeference.py`, `eaip-crawler/` 확장)

```
1) eAIP 크롤 → 공항별 차트 PDF 수집            (eaip-crawler/)
2) PDF→PNG 래스터화 (해상도 고정)
3) GCP(지상기준점) 추출:
   - 1차: 차트 내 알려진 좌표 피처 — 활주로 threshold, VOR/DME/NDB, 주요 waypoint
          (좌표는 우리 navdata: korea_airspace.json / nav_airports_kr.json 보유)
   - 2차: 차트에 격자/눈금(lat/lon tick)이 있으면 OCR로 보정
4) 변환 추정:
   - 최소 GCP 3점 → affine(6-DOF). 권장 4점+ → 과결정 최소제곱.
   - 정합 품질(residual RMS) 기록. 임계 초과 차트는 '정합 불가'로 플래그.
5) 산출: 차트별 georef 메타 JSON
   { chart_id, image_url, width_px, height_px,
     transform: affine[6] 또는 corner GCP 4쌍,
     bbox_geo:[w,s,e,n], residual_rms, status }
```

### 5.3 지도 표시

- Mapbox `image` source(코너 4좌표) 또는 `raster` source로 오버레이.
- affine가 순수 scale/translate가 아니면(회전·스큐 포함) 코너 4점을 affine로 투영해 `image` source 좌표로 사용.
- 투명도 슬라이더 + on/off. 차트 종류(SID/STAR/APCH/공항도) 필터.

### 5.4 한계 (명시)

- AIP 차트는 정확한 축척 투영이 아닌 경우가 많아(개념도) **완벽한 1:1은 불가**한 차트가 존재. residual 기반으로 "정합/근사/불가" 3등급 표기.
- 그래서 Navigraph식 벡터 절차 오버레이(정확)와 AIP 래스터(참고)를 **겹쳐** 쓰는 하이브리드가 현실적 — 벡터가 정확도, 래스터가 가독성/공신력 담당.

---

## 6. 벡터 절차/항로/공역 레이어

- 절차(SID/STAR/APCH) geometry는 **빌드 타임 생성 정적 GeoJSON**으로. (§2 원칙1)
- AF(arc) leg는 과거 `interpolateArc` 수학은 검증됨(0.0032NM) — 유지하되 **생성은 스크립트에서 1회**, 런타임 계산 금지.
- 색상/심볼은 Navigraph 상수(§2.4) 사용. 심볼은 sprite 시트 도입 검토(현재 직접 그림 → 부정확).
- 공역/항로는 `public/data/korea_airspace.json` 기반, 레이어 토글은 `useLayerStore`로 일원화.

---

## 7. UI/UX 개편

- 좌측 접이식 패널 체계 유지, 패널 그룹: 항공기 / 기상 / NOTAM / 절차·차트 / 레이어.
- 2D·3D 뷰 토글, Day/Night, 차트 투명도, trail 지속시간(이미 `TRAIL_DURATION_OPTIONS`).
- 모바일(Capacitor) 반응형 유지.
- 접근성: 현 `AccessibleAircraftList` 확장.

---

## 8. 단계별 실행 계획 (Phase)

| Phase | 내용 | 산출물 | 선행 |
|-------|------|--------|------|
| P0 | 인코딩 UTF-8 통일 + lint/type 베이스라인 | 깨진 파일 정정 | - |
| P1 | **항적 정상화** (TR-1 소스교체, TR-3 2D 레이어, TR-2 보간) | `aircraft-trace.js`, `TrailLayer`, 파서 | P0 |
| P2 | 항적 이력 소스 확정(§4.1 택1) + 필요시 자체 축적 | trace API, (opt) Redis/Supabase 적재 | P1 |
| P3 | AIP georeference 파이프라인 MVP (공항 1곳: RKPU 등) | georef 메타 JSON, `AipChartLayer` | P0 |
| P4 | 벡터 절차 정적 GeoJSON 빌드 + 레이어 | build 스크립트, `ProcedureLayer` | P3 |
| P5 | AIP 전국 확대 + 품질 등급 UI | 전 공항 메타, 필터 UI | P3 |
| P6 | 테스트(단위/통합/E2E) 커버리지 상향, 성능 점검 | vitest/playwright | 각 P |

권장 착수 순서: **P0 → P1**(현 사이트 체감 복구) 후 **P3**(목표 기능) 병행.

---

## 9. 확인·결정 필요 (OPEN)

1. **도메인 확정**: `koreansurveillance.com`(메모리) vs `koreasurveillance.com`(코드 UA). 실제 운영 도메인?
2. **항적 이력 소스**: §4.1 (a)adsb.lol trace / (b)OpenSky tracks / (c)자체 축적 중 선호?
3. **OpenSky 자격증명** 보유 여부(OAuth2 client or basic) — 현 circuit breaker가 자주 열리는지 로그 확인 필요.
4. **AIP 저작권/이용범위**: 공개 eAIP 재게시 범위(절차 완료했다 하셨으니 근거 문서 위치만 공유).
5. **지도 엔진**: Mapbox 유지 vs V-World 전환 비중(메모리상 V-World 키 보유). 베이스맵 정책 결정.

---

## 10. 다음 액션

P0(인코딩/lint)와 P1(항적) 착수를 기본으로 제안. 본 설계서 승인/수정 후 로컬 레포에서 직접 작업 시작.

---

## 11. 확정 사항 및 추가 발견 (v1.1, 2026-10-14)

### 11.1 §9 OPEN 항목 결정
1. **운영 도메인 = `koreasurveillance.com`** (n 없음). 코드 UA·메모리의 `koreansurveillance` 표기는 오타 → 전 코드/문서 `koreasurveillance.com`으로 통일 (P0에 포함).
2. **항적 이력 소스 = 자체 Supabase** (NAS 피딩). §4.1 (c) 채택.
3. **OpenSky 자격증명 보유** (아이디/비번). 단 §11.3 주의.

### 11.2 현행 데이터 파이프라인 (실측)
- NAS(Synology)의 ADS-B 안테나 컨테이너가 수신 → **AWS S3에 1초 간격 저장** (항적 원천).
- Supabase는 현재 **NOTAM 전용**(`api/notam.js`, `supabase/migrations`에 NOTAM 테이블만). **항공기 위치/항적 테이블은 아직 없음.**
- `/api/opensky-history.js`가 OpenSky `tracks/all`(OAuth2)로 항적을 받도록 이미 구현돼 있으나 **프런트가 호출하지 않음**. 프런트는 깨진 `/api/aircraft-trace`만 사용 (TR-1).

### 11.3 즉시 조치가 필요한 적신호 (크리덴셜 저장소 점검 결과)
- **Supabase 키/프로젝트 불일치**: 저장된 URL은 `lxbdegbsriisiekvnpbk` 프로젝트인데 anon/service JWT의 `ref`는 `ugzsuswrazaimvpyloqw`. 서로 다른 프로젝트의 키 → 연결 실패 위험. **올바른 프로젝트의 anon/service 키 재확인 필요.** (또한 신형 `sb_secret_...` 키와 구형 JWT 혼재)
- **OpenSky Basic 인증 폐지**: 보유 자격은 아이디/비번(Basic)뿐인데 OpenSky는 2025년부터 OAuth2 client credentials만 허용. → OpenSky 계정에서 **API client(client_id/secret) 발급** 후 `OPENSKY_CLIENT_ID`/`OPENSKY_CLIENT_SECRET` 설정 필요. (코드는 이미 OAuth2 우선 지원)

### 11.4 항적 이력 아키텍처 확정 (P2 상세)
```
NAS ADS-B 컨테이너 ──1s──▶ AWS S3 (원천 보관, 기존)
                      └──▶ Supabase 테이블 aircraft_positions (신규)
   스키마(안): hex, ts(timestamptz), lat, lon, alt_ft, gs, track, callsign, on_ground
   인덱스: (hex, ts), 지리/시간 범위 쿼리용 brin(ts) + btree(hex)
   보존: 최근 N시간 롤링(파티션 또는 TTL job)

프런트 trail seed:
   /api/aircraft-trace?hex= 를 Supabase 조회로 교체
   (service_role는 서버 함수에서만, 브라우저엔 anon/도메인 제한 키만)
```
- 비밀값은 **Vercel 환경변수 + 로컬 `.env.local`(gitignore)** 에만. 코드/문서/커밋에 평문 금지.
- `.env.example`에 변수 자리만 추가: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `ADSB_S3_BUCKET` 등.

### 11.5 P1 "빠른 복구" 범위 재정의
TR-1의 최소 수정: 프런트 `useAircraftData.loadAircraftTrace()`가 `/api/aircraft-trace`(adsb.lol hex, trace 없음) 대신 **항적 이력 API**(P2의 Supabase 조회, 준비 전이면 임시로 `/api/opensky-history`)를 호출하도록 배선 + 응답 파서를 `path[]` 스키마로 교체. TR-3(2D 레이어) 동시 수정 시 체감 즉시 개선.
