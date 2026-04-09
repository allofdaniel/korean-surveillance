/**
 * CesiumViewer - Google Photorealistic 3D Tiles + V-World 위성
 * 실제 건물 텍스처가 적용된 포토리얼리스틱 3D 뷰어
 */
import { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const VWORLD_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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

    // Cesium Ion 토큰 (OSM Buildings fallback용)
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6OTYyMCwic2NvcGVzIjpbImFzbCIsImFzciIsImdjIl0sImlhdCI6MTU2Mjg2NjI3M30.93b2HY8UiCwlbGFfMoNTTbHONMz6vKQiM_RfY0sZ3U0';

    // Google 3D Tiles가 있으면 별도 imagery 불필요 (Google이 위성+건물+지형 모두 제공)
    const useGoogle3D = !!GOOGLE_API_KEY;

    const viewerOptions: Cesium.Viewer.ConstructorOptions = {
      animation: false,
      timeline: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      geocoder: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: document.createElement('div'),
    };

    if (useGoogle3D) {
      // Google 3D Tiles 모드: 지형/이미지 불필요 (Google이 모두 제공)
      viewerOptions.baseLayer = false as unknown as Cesium.ImageryLayer;
      viewerOptions.terrain = undefined;
    } else {
      // Fallback: V-World 위성 + Cesium World Terrain
      if (VWORLD_KEY) {
        viewerOptions.baseLayer = new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`,
            minimumLevel: 5,
            maximumLevel: 19,
            credit: new Cesium.Credit('V-World (국토교통부)'),
          })
        );
      }
      viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
    }

    const viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
    viewerRef.current = viewer;

    // 렌더링 품질 설정
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a1a');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a1a2e');
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0002;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.enableLighting = true;
    viewer.shadows = true;

    // MSAA 안티앨리어싱
    if (viewer.scene.msaaSamples !== undefined) {
      viewer.scene.msaaSamples = 4;
    }

    if (useGoogle3D) {
      // Google Photorealistic 3D Tiles (실제 건물 텍스처!)
      try {
        console.log('[Cesium] Loading Google Photorealistic 3D Tiles...');
        const tileset = await Cesium.Cesium3DTileset.fromUrl(
          `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_API_KEY}`
        );
        viewer.scene.primitives.add(tileset);
        // Google 3D에서는 globe 숨기기 (Google이 지형 제공)
        viewer.scene.globe.show = false;
        console.log('[Cesium] Google 3D Tiles loaded successfully');
      } catch (err) {
        console.error('[Cesium] Google 3D Tiles 로드 실패, OSM fallback:', err);
        // Fallback to OSM Buildings
        viewer.scene.globe.show = true;
        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync();
          viewer.scene.primitives.add(osmBuildings);
        } catch { /* skip */ }
      }
    } else {
      // OSM Buildings (무료, 텍스처 없음)
      try {
        const osmBuildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(osmBuildings);
        console.log('[Cesium] OSM Buildings loaded (no texture)');
      } catch (err) {
        console.error('[Cesium] OSM Buildings 로드 실패:', err);
      }
    }

    // 서울로 카메라 이동
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(126.978, 37.566, 800),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 0,
    });
  }, []);

  useEffect(() => {
    if (visible && !initializedRef.current) {
      initViewer();
    }
  }, [visible, initViewer]);

  useEffect(() => {
    if (!visible || !viewerRef.current) return;
    const handleResize = () => viewerRef.current?.resize();
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible]);

  if (!visible) return null;

  const cities = [
    { name: '서울', lon: 126.978, lat: 37.566, h: 800 },
    { name: '강남', lon: 127.028, lat: 37.498, h: 400 },
    { name: '여의도', lon: 126.924, lat: 37.525, h: 400 },
    { name: '부산', lon: 129.075, lat: 35.179, h: 600 },
    { name: '해운대', lon: 129.160, lat: 35.163, h: 400 },
    { name: '인천', lon: 126.705, lat: 37.456, h: 500 },
    { name: '대구', lon: 128.601, lat: 35.871, h: 500 },
    { name: '잠실', lon: 127.100, lat: 37.513, h: 400 },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      zIndex: 9999, background: '#0a0a1a',
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* 상단 UI */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10000,
        background: 'rgba(26, 26, 46, 0.9)', color: '#4fc3f7',
        borderRadius: 8, padding: '10px 16px', fontSize: 13,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(79, 195, 247, 0.2)',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>
          {GOOGLE_API_KEY ? '포토리얼리스틱 3D 뷰어' : 'Cesium 3D 건물 뷰어'}
        </div>
        <div>{GOOGLE_API_KEY ? 'Google 3D Tiles + 실제 건물 텍스처' : 'V-World 위성 + OSM 3D 건물'}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          마우스 드래그: 회전 | 스크롤: 줌 | 우클릭: 기울기
        </div>
      </div>

      {/* 닫기 */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10000,
        background: 'rgba(26, 26, 46, 0.9)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
        padding: '8px 16px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      }}>
        Mapbox로 돌아가기
      </button>

      {/* 도시 이동 */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%',
        transform: 'translateX(-50%)', zIndex: 10000,
        display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {cities.map((city) => (
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
              background: 'rgba(26, 26, 46, 0.85)', color: '#4fc3f7',
              border: '1px solid rgba(79, 195, 247, 0.3)', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, fontWeight: 'bold',
              cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}
          >
            {city.name}
          </button>
        ))}
      </div>

      {/* Google API 키 없을 때 안내 */}
      {!GOOGLE_API_KEY && (
        <div style={{
          position: 'absolute', bottom: 60, left: '50%',
          transform: 'translateX(-50%)', zIndex: 10000,
          background: 'rgba(255, 152, 0, 0.15)', color: '#ffb74d',
          borderRadius: 8, padding: '8px 16px', fontSize: 12,
          border: '1px solid rgba(255, 152, 0, 0.3)',
          textAlign: 'center', maxWidth: 400,
        }}>
          Google Maps API 키를 .env에 추가하면 실제 건물 텍스처가 표시됩니다
          <br />
          <code style={{ fontSize: 11 }}>VITE_GOOGLE_MAPS_API_KEY=your_key</code>
        </div>
      )}
    </div>
  );
}
