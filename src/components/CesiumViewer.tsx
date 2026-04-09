/**
 * VWorld3DViewer - V-World 웹지엘 3D지도 API
 * 텍스처가 적용된 실제 3D 건물 + 위성 + 지형
 * V-World API 키만으로 동작 (Google 불필요)
 */
import { useEffect, useRef } from 'react';

const VWORLD_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';
const VWORLD_3D_SCRIPT = `https://map.vworld.kr/js/webglMapInit.js.do?version=3.0&apiKey=${VWORLD_KEY}`;

interface VWorld3DViewerProps {
  visible: boolean;
  onClose: () => void;
}

// V-World 3D API 타입 (글로벌)
declare global {
  interface Window {
    vw: {
      Map3D: new (container: string, options: unknown) => VWMap3D;
      CameraPosition: new (lon: number, lat: number, alt: number) => unknown;
      Direction: new (heading: number, pitch: number, roll: number) => unknown;
      BasemapType: { PHOTO: string; HYBRID: string; DEFAULT: string };
      DensityType: { BASIC: string; FULL: string; NONE: string };
    };
  }
}

interface VWMap3D {
  moveTo: (position: unknown, direction: unknown, duration?: number) => void;
  destroy?: () => void;
}

export default function CesiumViewerComponent({ visible, onClose }: VWorld3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<VWMap3D | null>(null);
  const scriptLoadedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!visible || initializedRef.current || !VWORLD_KEY) return;

    const loadScript = (): Promise<void> => {
      if (scriptLoadedRef.current && window.vw) return Promise.resolve();
      return new Promise((resolve, reject) => {
        // 이미 로드된 스크립트 있는지 확인
        if (document.querySelector(`script[src*="webglMapInit"]`)) {
          const check = setInterval(() => {
            if (window.vw) { clearInterval(check); scriptLoadedRef.current = true; resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); reject(new Error('V-World 3D script timeout')); }, 10000);
          return;
        }
        const script = document.createElement('script');
        script.src = VWORLD_3D_SCRIPT;
        script.async = true;
        script.onload = () => {
          // vw 객체가 준비될 때까지 대기
          const check = setInterval(() => {
            if (window.vw) { clearInterval(check); scriptLoadedRef.current = true; resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); reject(new Error('vw object not ready')); }, 10000);
        };
        script.onerror = () => reject(new Error('V-World 3D script load failed'));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        await loadScript();
        if (!containerRef.current || !window.vw) return;

        const { vw } = window;
        initializedRef.current = true;

        const map3d = new vw.Map3D('vworld-3d-container', {
          basemapType: vw.BasemapType.PHOTO,
          controlDensity: vw.DensityType.BASIC,
          camera: {
            center: new vw.CameraPosition(126.978, 37.566, 800),
            direction: new vw.Direction(0, -45, 0),
          },
        });

        mapRef.current = map3d;
        console.log('[VWorld3D] 3D Map initialized with textured buildings');
      } catch (err) {
        console.error('[VWorld3D] Init failed:', err);
      }
    };

    // DOM이 준비된 후 초기화
    setTimeout(init, 200);
  }, [visible]);

  if (!visible) return null;

  const cities = [
    { name: '서울', lon: 126.978, lat: 37.566, h: 800 },
    { name: '강남', lon: 127.028, lat: 37.498, h: 400 },
    { name: '여의도', lon: 126.924, lat: 37.525, h: 400 },
    { name: '잠실', lon: 127.100, lat: 37.513, h: 400 },
    { name: '부산', lon: 129.075, lat: 35.179, h: 600 },
    { name: '해운대', lon: 129.160, lat: 35.163, h: 400 },
    { name: '인천', lon: 126.705, lat: 37.456, h: 500 },
    { name: '대구', lon: 128.601, lat: 35.871, h: 500 },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      zIndex: 9999, background: '#0a0a1a',
    }}>
      {/* V-World 3D 컨테이너 */}
      <div
        ref={containerRef}
        id="vworld-3d-container"
        style={{ width: '100%', height: '100%' }}
      />

      {/* 상단 정보 */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10000,
        background: 'rgba(26, 26, 46, 0.9)', color: '#4fc3f7',
        borderRadius: 8, padding: '10px 16px', fontSize: 13,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(79, 195, 247, 0.2)',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>
          V-World 3D 건물 뷰어
        </div>
        <div>텍스처 3D 건물 + 위성 + 지형</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          마우스 드래그: 회전 | 스크롤: 줌 | 우클릭+드래그: 기울기
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
              if (mapRef.current && window.vw) {
                const { vw } = window;
                mapRef.current.moveTo(
                  new vw.CameraPosition(city.lon, city.lat, city.h),
                  new vw.Direction(0, -45, 0),
                  1.5
                );
              }
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
    </div>
  );
}
