/**
 * CesiumViewer - V-World 3D 텍스처 건물 + 위성 뷰어
 * Cesium 기반 3D 글로브로 포토리얼리스틱 건물 표시
 */
import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const VWORLD_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';

// 한국 주요 도시 위치
const KOREA_CENTER = {
  lon: 126.978,
  lat: 37.566,
  height: 800,
};

interface CesiumViewerProps {
  visible: boolean;
  onClose: () => void;
}

export default function CesiumViewerComponent({ visible, onClose }: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const initializedRef = useRef(false);

  const initViewer = useCallback(async () => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // Cesium Ion 토큰 (무료 OSM Buildings 사용)
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6OTYyMCwic2NvcGVzIjpbImFzbCIsImFzciIsImdjIl0sImlhdCI6MTU2Mjg2NjI3M30.93b2HY8UiCwlbGFfMoNTTbHONMz6vKQiM_RfY0sZ3U0';

    const viewer = new Cesium.Viewer(containerRef.current, {
      // UI 최소화
      animation: false,
      timeline: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      geocoder: false,
      fullscreenButton: false,
      infoBox: true,
      selectionIndicator: false,
      creditContainer: document.createElement('div'), // 크레딧 숨기기

      // V-World 위성 이미지를 기본 레이어로
      baseLayer: VWORLD_KEY
        ? new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
              url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`,
              minimumLevel: 5,
              maximumLevel: 19,
              credit: new Cesium.Credit('V-World (국토교통부)'),
            })
          )
        : undefined,

      // Cesium World Terrain (전 세계 지형)
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    viewerRef.current = viewer;

    // 다크 모드 스타일
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a1a');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a1a2e');

    // 대기/안개 효과
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0002;
    viewer.scene.globe.showGroundAtmosphere = true;

    // 그림자 활성화
    viewer.scene.globe.enableLighting = true;
    viewer.shadows = true;

    // Cesium OSM Buildings (전 세계 3D 건물 - 무료)
    try {
      const osmBuildings = await Cesium.createOsmBuildingsAsync();
      viewer.scene.primitives.add(osmBuildings);
    } catch (err) {
      console.error('OSM Buildings 로드 실패:', err);
    }

    // 한국 서울로 카메라 이동
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        KOREA_CENTER.lon,
        KOREA_CENTER.lat,
        KOREA_CENTER.height
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 0,
    });

    // 더블클릭으로 건물 정보 표시
    viewer.screenSpaceEventHandler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(movement.position);
        if (Cesium.defined(picked)) {
          const cartesian = viewer.scene.pickPosition(movement.position);
          if (cartesian) {
            const carto = Cesium.Cartographic.fromCartesian(cartesian);
            const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(6);
            const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(6);
            const alt = carto.height.toFixed(0);
            console.log(`[Cesium] Picked: ${lat}, ${lon}, alt=${alt}m`);
          }
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
  }, []);

  useEffect(() => {
    if (visible && !initializedRef.current) {
      initViewer();
    }
    return () => {
      if (viewerRef.current && !visible) {
        // visible이 false가 되면 뷰어 정리하지 않음 (재사용)
      }
    };
  }, [visible, initViewer]);

  // 뷰어 크기 조정
  useEffect(() => {
    if (!visible || !viewerRef.current) return;
    const handleResize = () => {
      viewerRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    // 초기 리사이즈
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: '#0a0a1a',
      }}
    >
      {/* Cesium 컨테이너 */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10000,
          background: 'rgba(26, 26, 46, 0.9)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 'bold',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        Mapbox로 돌아가기
      </button>

      {/* 도시 이동 버튼 */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          display: 'flex',
          gap: 8,
        }}
      >
        {[
          { name: '서울', lon: 126.978, lat: 37.566, h: 600 },
          { name: '부산', lon: 129.075, lat: 35.179, h: 500 },
          { name: '인천', lon: 126.705, lat: 37.456, h: 500 },
          { name: '대구', lon: 128.601, lat: 35.871, h: 500 },
          { name: '여의도', lon: 126.924, lat: 37.525, h: 400 },
          { name: '강남', lon: 127.028, lat: 37.498, h: 400 },
          { name: '해운대', lon: 129.160, lat: 35.163, h: 400 },
        ].map((city) => (
          <button
            key={city.name}
            onClick={() => {
              viewerRef.current?.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(city.lon, city.lat, city.h),
                orientation: {
                  heading: Cesium.Math.toRadians(0),
                  pitch: Cesium.Math.toRadians(-35),
                  roll: 0,
                },
                duration: 1.5,
              });
            }}
            style={{
              background: 'rgba(26, 26, 46, 0.85)',
              color: '#4fc3f7',
              border: '1px solid rgba(79, 195, 247, 0.3)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            {city.name}
          </button>
        ))}
      </div>

      {/* 정보 표시 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10000,
          background: 'rgba(26, 26, 46, 0.85)',
          color: '#4fc3f7',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 13,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(79, 195, 247, 0.2)',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>
          Cesium 3D 건물 뷰어
        </div>
        <div>V-World 위성 + OSM 3D 건물</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          마우스 드래그: 회전 | 스크롤: 줌 | 우클릭: 기울기
        </div>
      </div>
    </div>
  );
}
