# Navigraph Charts 역공학 및 적용 완료 리포트

## 개요
Navigraph Charts의 렌더링 로직을 역공학하여 rkpu-viewer (tbas)에 적용 완료했습니다.

## 수행 작업 요약

### 1. Navigraph Charts 분석 (main.bundle.js 291,294 라인)

#### 1.1 Waypoint 심볼 렌더링 분석 완료
- **기술 스택**: Leaflet + GeoJSON
- **핵심 발견사항**:
  - 줌 레벨 기반 동적 아이콘 크기 조정 (6px → 8px → 12px)
  - Day/Night 모드별 색상 반전 (`filter: invert(100%)`)
  - Text shadow로 라벨 가독성 향상
  - `FiraCode-SemiBold` 폰트 사용
  - 프로시저 타입별 색상 코드 정의

#### 1.2 Arc/Track/Course 렌더링 분석 완료
- **파일**: `ARC_TRACK_COURSE_ANALYSIS.md`
- **핵심 발견사항**:
  - Turf.js `circle()` 함수 사용하여 arc 생성
  - 설정 가능한 edge count로 smoothness 조정
  - Local planar approximation으로 빠른 geodesic 계산
  - Leaflet Polyline으로 최종 렌더링

#### 1.3 Procedure Leg 처리 분석 완료
- **파일**: `PROCEDURE_LEG_ANALYSIS.md`
- **핵심 발견사항**:
  - ARINC 424 표준 준수
  - 15+ leg types 지원 (IF, TF, CF, AF, RF, DF, FA, FC, FD, FM, VM, PI, HA, HF, HM)
  - GraphQL API (`navdata.api.navigraph.com/graphql`)로 데이터 수신
  - 클라이언트는 이미 계산된 좌표를 단순 렌더링

#### 1.4 Airport/Gate 렌더링 분석 완료
- **파일**: `AIRPORT_GATE_ANALYSIS.md`
- **핵심 발견사항**:
  - Mapbox GL JS + Vector Tiles (PBF) 사용
  - Navigraph AMDB API로 게이트/taxiway/runway 데이터 수신
  - Vector tiles: `https://enroute.charts.api-v2.navigraph.com/{z}/{x}/{y}.pbf`
  - Style.json에 레이어 정의 포함

### 2. tbas 적용 완료

#### 2.1 Waypoint 스타일 적용 (완료 ✓)

**수정된 파일**:
- `src/index.css` - Navigraph waypoint CSS 스타일 추가
- `src/utils/colors.ts` - PROCEDURE_COLORS 상수 추가
- `src/presentation/components/map/WaypointLayer.tsx` - isDayMode prop 추가, 줌 기반 크기 조정
- `src/hooks/useAirspaceLayers.ts` - isDayMode 파라미터 추가
- `src/hooks/useGlobalLayers.ts` - isDayMode 파라미터 추가
- `src/hooks/useKoreaAirspace.ts` - isDayMode 파라미터 추가
- `src/App.jsx` - !isDarkMode 플래그 전달

**적용된 스타일**:
```css
.custom-waypoint-marker-label {
  font-family: "FiraCode-SemiBold";
  color: white;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000,
               -1px 1px 0 #000, 1px 1px 0 #000;
  font-size: 11px;
  text-transform: uppercase;
}

.custom-waypoint-marker-label.large { font-size: 22px; }
.custom-waypoint-marker-label.xlarge { font-size: 44px; }
.custom-waypoint-marker-label.small-scale { font-size: 8px; }
.custom-waypoint-marker-label.x-small-scale { font-size: 6px; }

#map.day .custom-waypoint-marker { filter: invert(100%); }
#map.day .custom-waypoint-marker-label {
  color: black;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff,
               -1px 1px 0 #fff, 1px 1px 0 #fff;
}
```

#### 2.2 프로시저 색상 적용 (완료 ✓)

**수정된 파일**:
- `src/utils/colors.ts` - PROCEDURE_COLORS 상수 정의
  ```typescript
  export const PROCEDURE_COLORS = {
    SID: '#cb4c8b',      // 핑크/마젠타 (Navigraph와 동일)
    STAR: '#6ca550',     // 녹색 (Navigraph와 동일)
    APP: '#ec7b2c',      // 주황색 (Navigraph와 동일)
    APPROACH: '#ec7b2c', // APP와 동일
    AIRPORT: '#198080',  // 청록색
    AIRWAY: '#7e429a'    // 보라색
  };
  ```

- `src/hooks/useDataLoading.ts` - 프로시저 색상 생성 로직 변경
  ```typescript
  // 변경 전: 동적으로 각 프로시저마다 다른 색상 생성
  setProcColors({
    SID: Object.fromEntries(sidKeys.map((k, i) => [k, generateColor(i, sidKeys.length, 120)])),
    STAR: Object.fromEntries(starKeys.map((k, i) => [k, generateColor(i, starKeys.length, 30)])),
    APPROACH: Object.fromEntries(apchKeys.map((k, i) => [k, generateColor(i, apchKeys.length, 200)])),
  });

  // 변경 후: Navigraph 고정 색상 사용
  setProcColors({
    SID: Object.fromEntries(sidKeys.map((k) => [k, PROCEDURE_COLORS.SID])),
    STAR: Object.fromEntries(starKeys.map((k) => [k, PROCEDURE_COLORS.STAR])),
    APPROACH: Object.fromEntries(apchKeys.map((k) => [k, PROCEDURE_COLORS.APPROACH])),
  });
  ```

**실제 렌더링 적용 위치**:
- `src/hooks/useProcedureRendering.ts` - 이미 `procColors` 파라미터를 받아서 사용 중
  - Line 120: `const color = colors[key] ?? '#ffffff';` (3D 렌더링)
  - Line 277, 282, 287: `procColors.SID[k]`, `procColors.STAR[k]`, `procColors.APPROACH[k]` (waypoint 추출)
  - Line 384, 388, 392: 각 프로시저 타입에 대한 Three.js 레이어 생성
  - Line 421, 430, 439: 2D 폴백 렌더링

**결과**:
- 모든 SID는 이제 핑크색 (#cb4c8b)으로 표시
- 모든 STAR는 녹색 (#6ca550)으로 표시
- 모든 APPROACH는 주황색 (#ec7b2c)으로 표시

## 추출된 렌더링 로직

### 1. Waypoint 아이콘 크기 (Zoom 기반)

```javascript
const getIconSize = (zoom, interfaceScale = 'normal') => {
  const threshold = { normal: 7, '2x': 8, '4x': 9 }[interfaceScale];

  if (zoom < threshold) {
    return { normal: 6, '2x': 12, '4x': 24 }[interfaceScale];
  } else if (zoom === threshold) {
    return { normal: 8, '2x': 16, '4x': 32 }[interfaceScale];
  } else {
    return { normal: 12, '2x': 24, '4x': 48 }[interfaceScale];
  }
};
```

### 2. Day/Night 모드 전환

```javascript
// Day mode: 아이콘과 라벨 색상 반전
isDayMode ? { filter: 'invert(100%)' } : {}

// 라벨 색상
color: isDayMode ? 'black' : 'white'
textShadow: isDayMode
  ? '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff'
  : '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
```

### 3. 프로시저 색상 코드

| 프로시저 타입 | 색상 코드 | 색상 이름 |
|--------------|----------|----------|
| SID          | #cb4c8b  | 핑크/마젠타 |
| STAR         | #6ca550  | 녹색 |
| APPROACH     | #ec7b2c  | 주황색 |
| AIRPORT      | #198080  | 청록색 |
| AIRWAY       | #7e429a  | 보라색 |

## 기술적 세부사항

### Navigraph Charts 아키텍처

1. **Frontend**: React Native Web + Leaflet
2. **3D Rendering**: Mapbox GL JS + Three.js
3. **Data Source**:
   - GraphQL API for procedures
   - Vector Tiles (PBF) for airport layouts
   - Sprite sheets for symbols
4. **Styling**: CSS-in-JS with dynamic theme switching

### rkpu-viewer (tbas) 아키텍처

1. **Frontend**: React + TypeScript + Vite
2. **Map**: Mapbox GL JS
3. **3D Rendering**: Three.js custom layers
4. **State Management**: Zustand
5. **Data**: Static JSON files

## 남은 작업

### 즉시 구현 가능
1. ~~Waypoint 스타일 적용~~ ✓ (완료)
2. ~~프로시저 색상 적용~~ ✓ (완료)
3. ~~Day/Night 모드 전환~~ ✓ (완료)
4. ~~Zoom 기반 아이콘 크기 조정~~ ✓ (완료)

### 추가 개선 필요
1. **AF Leg 렌더링 정확도**:
   - 현재 `interpolateArc` 함수는 수학적으로는 정확 (0.0032 NM 오차)
   - `findArcCenter` 로직 재검증 필요
   - Turn direction (R/L) 해석 확인

2. **Airport Gate/Taxiway 렌더링**:
   - Navigraph Vector Tiles API 통합 고려
   - 또는 한국 공항 상세 데이터 (korea_airspace.json) 활용

3. **Sprite 이미지**:
   - Navigraph sprite.json/png 다운로드 (현재 403 에러)
   - 또는 유사한 심볼 아이콘 제작

## 파일 목록

### 분석 문서
- `RENDERING_LOGIC_EXTRACTED.md` - Waypoint 렌더링 로직
- `ARC_TRACK_COURSE_ANALYSIS.md` - Arc/Track/Course 렌더링 분석
- `PROCEDURE_LEG_ANALYSIS.md` - 프로시저 leg 처리 분석
- `AIRPORT_GATE_ANALYSIS.md` - 공항/게이트 렌더링 분석
- `ANALYSIS_REPORT.md` - 초기 분석 리포트
- `IMPLEMENTATION_SUMMARY.md` - 이 문서 (최종 통합 리포트)

### 수정된 코드 파일
- `src/index.css` - Navigraph CSS 스타일 추가
- `src/utils/colors.ts` - PROCEDURE_COLORS 추가
- `src/hooks/useDataLoading.ts` - 프로시저 색상 로직 변경
- `src/presentation/components/map/WaypointLayer.tsx` - isDayMode 적용
- `src/hooks/useAirspaceLayers.ts` - isDayMode 전달
- `src/hooks/useGlobalLayers.ts` - isDayMode 전달
- `src/hooks/useKoreaAirspace.ts` - isDayMode 전달
- `src/App.jsx` - !isDarkMode 플래그 전달

### 원본 분석 자료
- `main.bundle.js` - Navigraph Charts beautified source (291,294 lines)
- `navigraph-network-requests.log` - 네트워크 요청 로그
- `ils-y-network-requests.log` - ILS-Y 프로시저 로그
- `intercept_resources.js` - Playwright 리소스 인터셉터
- `download_resources.py` - 리소스 다운로더 스크립트

## 결론

Navigraph Charts의 핵심 렌더링 로직을 성공적으로 역공학하여 rkpu-viewer에 적용했습니다.

**적용 완료된 항목**:
- ✓ Waypoint 심볼 스타일 (줌 기반 크기, Day/Night 모드)
- ✓ 프로시저 색상 코드 (SID/STAR/APP)
- ✓ 라벨 가독성 개선 (text-shadow, font)

**개선 효과**:
- Navigraph Charts와 시각적으로 일관된 UI
- 줌 레벨에 따른 동적 아이콘 크기로 가독성 향상
- Day/Night 모드 지원으로 다양한 환경 대응
- 프로시저 타입별 명확한 색상 구분

사용자가 보고한 "심볼이나, 각 항로들도 정확하게 표현안되어있어" 문제는 이제 스타일과 색상 측면에서 해결되었습니다. 추가로 AF leg의 정확도나 공항 레이아웃 렌더링은 별도 개선이 필요합니다.
