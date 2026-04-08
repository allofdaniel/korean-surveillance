# Navigraph Charts 역공학 분석 리포트

## 개요
이 문서는 Navigraph Charts의 렌더링 로직을 분석하여 rkpu-viewer의 부정확한 렌더링 문제를 해결하기 위한 방안을 제시합니다.

## 현재 문제점
사용자 피드백에 따르면:
- **심볼 렌더링**: Waypoint, Navaid 아이콘이 부정확
- **항로/Leg 렌더링**: AF, TF, CF 등 leg type들이 정확하게 표현되지 않음
- **공항 렌더링**: 공항 확대 시 게이트, 라인 등이 부정확하게 표시됨

## 수집된 정보

### 1. GraphQL API 엔드포인트
- **URL**: `https://navdata.api.navigraph.com/graphql`
- 프로시저 데이터, waypoint 정보, navaid 정보 등을 제공
- 인증 필요 (사용자 세션 쿠키 기반)

### 2. Vector Tile API
- **URL**: `https://enroute.charts.api-v2.navigraph.com/{z}/{x}/{y}.pbf`
- Mapbox Vector Tiles (PBF format)
- Base layers: `https://enroute.charts.api-v2.navigraph.com/base.v13/{z}/{x}/{y}.pbf`

### 3. 차트 이미지 API
- **URL**: `https://api.navigraph.com/v2/charts/RKPU/{chart_code}_d.png`
- 예시: `rkpu102b_d.png`, `rkpu112_d.png`
- 인증 필요

### 4. 심볼 스프라이트
- **JSON**: `https://enroute.charts.api-v2.navigraph.com/sprites/sprite.json`
- **PNG**: `https://enroute.charts.api-v2.navigraph.com/sprites/sprite.png`
- Waypoint, Navaid 아이콘 정의

### 5. 스타일 정의
- **URL**: `https://enroute.charts.api-v2.navigraph.com/style.json`
- Mapbox GL Style Specification
- 레이어 정의, 렌더링 규칙 포함

## 핵심 발견사항

### Arc 렌더링 (AF Leg)
현재 `useKoreaAirspace.ts`의 `interpolateArc` 함수는 이미 latitude-corrected equirectangular projection을 사용하고 있습니다:

```typescript
const cosLat = Math.cos(centerLat * Math.PI / 180);
const scaleX = (lon: number) => (lon - center[0]) * cosLat;
const radius = (startRadius + endRadius) / 2; // Fixed radius
```

이 로직은 수학적으로 정확합니다 (verify_arc.py로 검증 완료 - 0.0032 NM variation).

**그러나 사용자는 여전히 부정확하다고 보고했습니다.**

가능한 원인:
1. **Center point가 잘못 계산되고 있음** (`findArcCenter` 함수 문제)
2. **Turn direction** (R/L)이 반대로 해석됨
3. **Start/End point**가 잘못 선택됨
4. **Mapbox rendering**에서 실제 표시 시 왜곡 발생

### Symbol Rendering
Navigraph는 sprite sheet를 사용:
- Waypoint 타입별 아이콘 (compulsory, fly-by, fly-over, etc.)
- Navaid 타입별 아이콘 (VOR, DME, NDB, etc.)
- 각 심볼의 정확한 위치, 크기, 스타일이 sprite.json에 정의됨

**rkpu-viewer는 아마도 이 sprite를 사용하지 않고 직접 그리고 있어서 부정확할 가능성**

### Airport Gates/Lines
Navigraph는 세밀한 공항 레이아웃 데이터를 vector tiles로 제공:
- Taxiways
- Runways
- Gates/Parking positions
- Buildings

**rkpu-viewer는 이 데이터를 제대로 파싱하지 못하고 있을 가능성**

## 해결 방안

### 단기 해결책 (즉시 적용 가능)

#### 1. GraphQL API 직접 사용
```typescript
const query = `
  query GetProcedure($icao: String!, $runwayIdentifier: String!) {
    airport(icao: $icao) {
      procedures {
        approaches(runwayIdentifier: $runwayIdentifier) {
          procedureLegs {
            legType
            waypointIdentifier
            turnDirection
            centerFix
            rho
            theta
            ... // 모든 필드
          }
        }
      }
    }
  }
`;
```

정확한 프로시저 데이터를 받아서 렌더링

#### 2. Navigraph Sprite 직접 사용
```typescript
// sprite.json과 sprite.png 다운로드
fetch('https://enroute.charts.api-v2.navigraph.com/sprites/sprite.json')
fetch('https://enroute.charts.api-v2.navigraph.com/sprites/sprite.png')

// Mapbox에 sprite 추가
map.loadImage(spriteUrl, (error, image) => {
  map.addImage('waypoint-compulsory', image);
});
```

#### 3. Vector Tiles 직접 로드
```typescript
map.addSource('navigraph-enroute', {
  type: 'vector',
  tiles: ['https://enroute.charts.api-v2.navigraph.com/{z}/{x}/{y}.pbf'],
  minzoom: 0,
  maxzoom: 14
});

map.addLayer({
  id: 'airport-gates',
  type: 'symbol',
  source: 'navigraph-enroute',
  'source-layer': 'gates', // 실제 레이어 이름 확인 필요
  layout: { ... }
});
```

### 중기 해결책 (추가 분석 필요)

#### 1. Style.json 완전 파싱
Navigraph의 `style.json`을 다운로드하고 모든 레이어 정의를 rkpu-viewer에 적용

#### 2. AF Leg 렌더링 재검증
- `findArcCenter` 로직 점검
- Actual ARINC 424 spec과 비교
- Turn direction 해석 확인

#### 3. 심볼 크기/위치 정확도 개선
- Zoom level에 따른 심볼 크기 조정
- Collision detection
- Text placement

### 장기 해결책 (대규모 리팩토링)

#### 1. Mapbox GL Style Spec 완전 준수
전체 렌더링 파이프라인을 Mapbox GL JS Specification에 맞춰 재작성

#### 2. Navigraph SDK 통합
Navigraph가 공식 SDK를 제공한다면 직접 통합

#### 3. 차트 이미지 오버레이
정확한 렌더링이 어려운 부분은 Navigraph 차트 이미지를 geo-referenced overlay로 표시

## 다음 단계

1. **GraphQL API 응답 캡처 및 분석**
   - RKPU I36-Y 프로시저의 실제 데이터 구조 확인
   - AF leg의 정확한 파라미터 값 확인

2. **style.json 다운로드 및 파싱**
   - 모든 레이어 정의 추출
   - 심볼 스타일 규칙 파악

3. **sprite.json/png 통합**
   - rkpu-viewer에 Navigraph sprite 직접 로드
   - 심볼 렌더링 개선

4. **Vector Tiles 테스트**
   - RKPU 공항 주변 타일 다운로드
   - 레이어 구조 분석
   - 게이트/라인 렌더링 개선

5. **비교 테스트**
   - Navigraph Charts와 rkpu-viewer를 side-by-side 비교
   - 차이점 식별 및 수정

## 파일 목록

- `main.bundle.js` (291,294 lines, beautified)
- Network logs: `navigraph-network-requests.log`, `ils-y-network-requests.log`
- Screenshot: `navigraph-map-overlay.png`
- Verification script: `verify_arc.py`

## 참고사항

- Navigraph API는 모두 인증 필요
- Chart 이미지는 직접 다운로드 불가 (401 Unauthorized)
- main.bundle.js는 React Native Web 기반, 고도로 난독화됨
- Vector tiles는 PBF (Protocol Buffer) 형식
