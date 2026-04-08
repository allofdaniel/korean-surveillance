# Navigraph Charts 렌더링 로직 추출 결과

## 1. Waypoint 심볼 렌더링

### 1.1 기술 스택
- **지도 라이브러리**: Leaflet (xK() 함수로 래핑됨)
- **데이터 형식**: GeoJSON
- **렌더링 방식**: Leaflet Marker + Tooltip

### 1.2 핵심 코드 구조 (main.bundle.js 라인 228635-228659)

```javascript
xK().geoJSON([], {
  pane: 'customWaypoints',
  pointToLayer(e, t) {
    const iconSize = calculateIconSize(); // 줌 레벨에 따라 동적 계산
    return xK()
      .marker(coordinates, {
        icon: xK().icon({
          iconUrl: PK, // PK = waypoint 아이콘 이미지 URL
          iconSize: [iconSize, iconSize],
          className: 'custom-waypoint-marker',
        }),
        pane: 'customWaypoints',
      })
      .bindTooltip(waypointName, {
        interactive: true,
        permanent: true,
        className: `custom-waypoint-marker-label ${style} ${scaleClass}`,
        direction: 'top',
        pane: 'customWaypoints',
      });
  },
})
```

### 1.3 아이콘 크기 계산 로직 (라인 228688-228696)

```javascript
// 줌 레벨에 따른 아이콘 크기
const calculateIconSize = (zoom, interfaceScale) => {
  const zoomThreshold = { normal: 7, '2x': 8, '4x': 9 }[interfaceScale];

  if (zoom < zoomThreshold) {
    return { normal: 6, '2x': 12, '4x': 24 }[interfaceScale];
  } else if (zoom === zoomThreshold) {
    return { normal: 8, '2x': 16, '4x': 32 }[interfaceScale];
  } else {
    return { normal: 12, '2x': 24, '4x': 48 }[interfaceScale];
  }
};
```

### 1.4 라벨 스케일 클래스 (라인 228682-228686)

```javascript
const getScaleClass = (zoom, interfaceScale) => {
  const threshold = { normal: 7, '2x': 8, '4x': 9 }[interfaceScale];

  if (zoom < threshold) return 'x-small-scale';
  if (zoom === threshold) return 'small-scale';
  return ''; // 기본 크기
};
```

### 1.5 CSS 스타일 (라인 12029)

```css
/* Day mode - 흰 배경에서 검은색으로 반전 */
#map.day .custom-waypoint-marker {
  filter: invert(100%);
}

/* 라벨 기본 스타일 */
.custom-waypoint-marker-label {
  background-color: transparent;
  border: none;
  box-shadow: none;
  font-family: "FiraCode-SemiBold";
  color: white;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000,
               -1px 1px 0 #000, 1px 1px 0 #000;
  font-size: 11px;
  text-transform: uppercase;
}

/* 크기 변형 */
.custom-waypoint-marker-label.large { font-size: 22px; }
.custom-waypoint-marker-label.xlarge { font-size: 44px; }
.custom-waypoint-marker-label.small-scale { font-size: 8px; }
.custom-waypoint-marker-label.x-small-scale { font-size: 6px; }

/* Day mode 라벨 */
#map.day .custom-waypoint-marker-label {
  color: black;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff,
               -1px 1px 0 #fff, 1px 1px 0 #fff;
}
```

## 2. 프로시저 마커/라벨 스타일

### 2.1 프로시저 타입별 색상

```css
.marker-label.sid { background-color: #cb4c8b !important; }  /* SID: 분홍색 */
.marker-label.star { background-color: #6ca550 !important; } /* STAR: 초록색 */
.marker-label.app { background-color: #ec7b2c !important; }  /* APP: 주황색 */
.marker-label.airport { background-color: #198080 !important; } /* 공항: 청록색 */

.route-marker.sid { border: 2px solid #cb4c8b !important; }
.route-marker.star { border: 2px solid #6ca550 !important; }
.route-marker.app { border: 2px solid #ec7b2c !important; }
```

### 2.2 Airway 라벨 스타일

```css
.airway-label {
  padding: 1px 4px 1px 4px !important;
  background-color: #7e429a !important;  /* 보라색 */
  border: 1px solid #552c68 !important;
  border-radius: 3px;
  color: white !important;
  font-weight: 600 !important;
  font-family: "FiraCode-SemiBold";
}
```

## 3. rkpu-viewer 적용 방안

### 3.1 즉시 적용 가능한 개선사항

1. **줌 레벨 기반 아이콘 크기 조정**
   - 현재 rkpu-viewer는 고정 크기 사용
   - Navigraph처럼 3단계 크기 조정 구현 필요

2. **CSS 스타일 적용**
   - `.custom-waypoint-marker-label` 스타일 복사
   - Day/Night 모드 전환 로직 구현
   - Text shadow로 가독성 향상

3. **프로시저 타입별 색상 코드**
   - SID/STAR/APP/공항 각각의 색상 적용
   - Border 색상도 일치시키기

### 3.2 추가 조사 필요 사항

1. **Leg Type 렌더링 (AF, TF, CF)**
   - main.bundle.js에서 "Arc", "Track", "Course" 키워드로 추가 검색 필요
   - Polyline/LineString 렌더링 로직 분석 필요

2. **공항 게이트/라인 렌더링**
   - Vector Tiles 레이어 분석 필요
   - Mapbox GL JS의 레이어 정의 확인 필요

3. **Sprite 이미지**
   - PK 변수가 가리키는 sprite 이미지 URL 확인
   - sprite.json/sprite.png 다운로드 (현재 CORS로 차단됨)

## 4. 다음 단계

1. ✅ Waypoint 심볼 렌더링 로직 추출 완료
2. ⏳ Arc/Track/Course 렌더링 로직 검색 중
3. ⏳ 공항 레이아웃 렌더링 로직 검색 중
4. ⏳ 추출한 로직을 rkpu-viewer에 적용

## 5. LineString/Polyline 렌더링

### 5.1 기술 스택
- **라이브러리**: Leaflet Polyline (Ln 클래스)
- **데이터 형식**: GeoJSON LineString/MultiLineString
- **렌더링 메서드**: `new Ln(coordinates, options)`

### 5.2 GeoJSON 처리 로직 (main.bundle.js 라인 80977-81006)

```javascript
// GeoJSON geometry type에 따른 처리
switch (geometry.type) {
  case 'Point':
    return createMarker(geometry.coordinates);

  case 'MultiPoint':
    return new FeatureGroup(markers);

  case 'LineString':
  case 'MultiLineString':
    // Hn 함수로 좌표 배열 변환
    const coords = Hn(
      geometry.coordinates,
      geometry.type === 'LineString' ? 0 : 1,
      coordsToLatLng
    );
    return new Ln(coords, options); // Polyline 생성

  case 'Polygon':
  case 'MultiPolygon':
    return new Nn(coords, options); // Polygon 생성
}
```

### 5.3 좌표 변환 함수 (라인 81014-81017)

```javascript
// 재귀적으로 좌표 배열 변환
function Hn(coords, depth, converter) {
  const result = [];
  for (let i = 0; i < coords.length; i++) {
    const item = depth
      ? Hn(coords[i], depth - 1, converter)  // 재귀 호출
      : (converter || Un)(coords[i]);         // [lng, lat] -> LatLng 변환
    result.push(item);
  }
  return result;
}

// [longitude, latitude] -> Leaflet LatLng 객체
function Un(coords) {
  return new N(coords[1], coords[0], coords[2]); // N = LatLng class
}
```

### 5.4 AF/TF/CF Leg 타입 구분 로직

**⚠️ 중요**: main.bundle.js에서 **AF/TF/CF 등의 leg type을 구분하는 비즈니스 로직을 직접 발견하지 못함**.

발견한 것은 Leaflet의 기본 GeoJSON 처리 로직뿐이며, 다음과 같은 가능성이 있습니다:

1. **GraphQL API 응답에서 이미 렌더링된 좌표를 받음**
   - Navigraph 서버가 AF/TF/CF 계산을 미리 수행
   - 클라이언트는 계산된 좌표를 단순히 LineString으로 렌더링

2. **별도의 프로시저 처리 모듈 존재**
   - 난독화된 다른 함수에서 leg type별 처리
   - GraphQL 데이터를 가공하여 GeoJSON으로 변환

3. **Mapbox Vector Tiles에 포함**
   - Vector tiles가 이미 렌더링된 경로 포함
   - 클라이언트는 tiles를 표시만 함

### 5.5 rkpu-viewer 개선 방향

현재 rkpu-viewer의 `interpolateArc` 함수는 수학적으로 정확하지만 (0.0032 NM 오차), 다음 항목 검증 필요:

1. **Center point 계산** (`findArcCenter` 함수)
2. **Turn direction** 해석 (R/L)
3. **Start/End point** 선택
4. **GraphQL API 직접 호출**하여 Navigraph의 정확한 데이터 구조 확인

## 6. 공항 게이트/라인 렌더링

### 6.1 Vector Tiles 기반

Navigraph는 Mapbox Vector Tiles (PBF)를 사용:
- `https://enroute.charts.api-v2.navigraph.com/{z}/{x}/{y}.pbf`
- `https://enroute.charts.api-v2.navigraph.com/base.v13/{z}/{x}/{y}.pbf`

### 6.2 레이어 구조

`style.json`에 정의된 레이어:
- Gates (gate 위치)
- Taxiways (유도로)
- Runways (활주로)
- Buildings (건물)
- Parking positions

### 6.3 필요한 작업

1. **style.json 다운로드** (현재 CORS로 차단됨)
2. **Vector tiles 파싱**하여 레이어 구조 분석
3. **Mapbox GL JS 스타일**을 Leaflet에 적용

## 7. 참고사항

- main.bundle.js는 291,294 라인으로 고도로 난독화되어 있음
- 변수명이 모두 단일 문자 (xK, PK 등)로 축약됨
- Leaflet 라이브러리를 xK()로 래핑하여 사용
- GeoJSON 형식으로 waypoint 데이터 전달
- **Ln** = Leaflet Polyline 클래스
- **Nn** = Leaflet Polygon 클래스
- **Dn** = Leaflet Marker 클래스
