# /map 재설계 — Navigraph식 차트·지도 통합 뷰

작성: 2026-10-15 · 기반: line-b (현 프로덕션) · 범위: `/map`만 (랜딩·EFS·IFS 유지)

## 1. 왜 바꾸나
- 기능 30여 개가 좌측 한 패널(ControlPanel)에 몰려 있어 "버튼이 안 된다/어디 있는지 모른다".
- 지도 진입 시 전체 화면 로딩 오버레이 + 매번 뜨는 온보딩 투어가 화면을 가림.
- 차트(16개 공항, 246장 래스터)가 있는데 공항 단위로 찾아보는 흐름이 없음.
- 데이터 계약 불일치: `/api/weather?type=metar`가 AMOS 센서 행을 반환 → METAR 미표시 (수정됨).

## 2. 원칙
1. **공항이 출발점** — Navigraph Charts처럼 공항을 고르면 정보·기상·차트가 한 화면에.
2. **차트와 지도는 짝** — 차트를 열면 오른쪽 뷰어로, "지도에 겹치기"로 같은 차트를 지도 위에.
3. **엔진은 유지, 셸만 교체** — 기존 훅(항적·공역·절차·NOTAM·기상 레이어·차트 오버레이)과
   Zustand 스토어는 그대로 쓰고 UI만 새로 짠다. 기능 손실 없이 정리.
4. **지도는 즉시** — 로딩 오버레이로 막지 않는다. 데이터는 도착하는 대로 그린다.

## 3. 레이아웃
```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar  [대한감시]  [검색: ICAO·공항명·편명]        06:12Z │ 15:12 KST  ●ADS-B ●WX ●NOTAM │
├────┬──────────────────┬──────────────────────────────────┬───────────────┤
│Rail│ Drawer (360px)   │ Map                               │ ChartViewer   │
│ 차트│ 공항 페이지       │  · 차트 오버레이(georef)            │ (열렸을 때만)  │
│ 교통│  - 헤더/활주로    │  · 항적·궤적                        │ 팬/줌·핀·겹치기 │
│ 기상│  - METAR/TAF     │  · 공역/항로/절차                   │               │
│NOTAM│  - 차트 목록      │                                    │               │
│레이어│                  │                                    │               │
│ 도구│                  │                                    │               │
└────┴──────────────────┴──────────────────────────────────┴───────────────┘
```
- 모바일(<900px): Rail → 하단 탭바, Drawer → 바텀시트, ChartViewer → 전체화면.

## 4. 패널
| Rail | 내용 | 엔진 연결 |
|---|---|---|
| 차트 | 공항 목록(차트 수·비행범주 칩) → 공항 페이지(정보·METAR·TAF·차트 그룹) | `all_chart_bounds.json`, `chart_bounds.json`, `useChartOverlay` |
| 교통 | 항적 목록(편명 검색, 고도/속도 정렬), 클릭 시 선택·추적 | `useAircraftData`, `setSelectedAircraft` |
| 기상 | 국내 공항 METAR 그리드(VFR/MVFR/IFR/LIFR), 레이더·낙뢰·SIGMET 토글 | `/api/weather?type=metar`, `useWeatherLayers` |
| NOTAM | 기존 NotamPanel 재사용 | `useNotamData` |
| 레이어 | 베이스맵 / 항공(공역·항로·웨이포인트·항행시설·SID·STAR·IAP·홀딩) / 관제 / 기타 | `useLayerStore`, `useMapStore` |
| 도구 | API 대시보드, CCTV·선박·위성, 튜토리얼 | 기존 모달·훅 |

차트 그룹(eAIP 분류): 공항(ADC·PDC·GMC·AOC) · 출발(SID) · 도착(STAR) · 접근(IAC·VAC) · 기타(BIRD 등).

## 5. 비주얼
랜딩과 같은 계열: 거의 검정 배경, 시안-블루 강조, Pretendard + JetBrains Mono(데이터).
항공 관례색: VFR #2fbf71 · MVFR #3d8bff · IFR #ff4d4f · LIFR #c74bff.

## 6. 단계
1. 셸(TopBar·Rail·Drawer) + 레이어 패널로 기존 기능 이전 → 구 ControlPanel 제거
2. 차트 브라우저 + 공항 페이지 + ChartViewer + 지도 겹치기
3. 교통·기상 패널, 로딩/온보딩 비차단화
4. 차트 georeferencing 일괄 정밀화 (격자 텍스트 기반 affine, `tools/georef`)
