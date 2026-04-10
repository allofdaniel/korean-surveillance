/**
 * Google Maps 3D Viewer - 포토리얼리스틱 3D 건물
 * Google Maps JavaScript API의 3D Map을 풀스크린 오버레이로 표시
 */
import { useEffect, useRef, useCallback } from 'react';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface Google3DViewerProps {
  visible: boolean;
  onClose: () => void;
}

export default function Google3DViewer({ visible, onClose }: Google3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const scriptLoadedRef = useRef(false);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;

    try {
      // @ts-expect-error google maps 3d
      const { Map3DElement } = await google.maps.importLibrary('maps3d');

      const map3d = new Map3DElement({
        center: { lat: 37.566, lng: 126.978, altitude: 300 },
        tilt: 60,
        heading: 0,
        range: 1000,
        defaultLabelsDisabled: false,
      });

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(map3d);
      console.log('[Google3D] Map3DElement created');
    } catch (err) {
      console.warn('[Google3D] Map3DElement failed, falling back to 3D Map:', err);
      // Fallback: 일반 Google Maps with tilt
      try {
        const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
        const map = new Map(containerRef.current!, {
          center: { lat: 37.566, lng: 126.978 },
          zoom: 17,
          tilt: 60,
          heading: 0,
          mapTypeId: 'satellite',
          mapId: 'google3d-viewer',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        console.log('[Google3D] Fallback satellite map created');
      } catch (err2) {
        console.error('[Google3D] All init failed:', err2);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible || !GOOGLE_KEY) return;

    const loadScript = () => {
      if (scriptLoadedRef.current) {
        initMap();
        return;
      }
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        scriptLoadedRef.current = true;
        initMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&v=alpha&libraries=maps3d`;
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        initMap();
      };
      script.onerror = () => console.error('[Google3D] Script load failed');
      document.head.appendChild(script);
    };

    loadScript();
  }, [visible, initMap]);

  if (!visible || !GOOGLE_KEY) return null;

  const cities = [
    { name: '서울', lat: 37.566, lng: 126.978 },
    { name: '강남', lat: 37.498, lng: 127.028 },
    { name: '여의도', lat: 37.525, lng: 126.924 },
    { name: '잠실', lat: 37.513, lng: 127.100 },
    { name: '부산', lat: 35.179, lng: 129.075 },
    { name: '해운대', lat: 35.163, lng: 129.160 },
    { name: '인천', lat: 37.456, lng: 126.705 },
    { name: '대구', lat: 35.871, lng: 128.601 },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      zIndex: 9999, background: '#0a0a1a',
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* 상단 정보 */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10000,
        background: 'rgba(26, 26, 46, 0.9)', color: '#4fc3f7',
        borderRadius: 8, padding: '10px 16px', fontSize: 13,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(79, 195, 247, 0.2)',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>
          Google 3D 텍스처 건물
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          드래그: 회전 | 스크롤: 줌 | Ctrl+드래그: 기울기
        </div>
      </div>

      {/* 닫기 */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10000,
        background: 'rgba(26, 26, 46, 0.9)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
        padding: '10px 20px', fontSize: 14, fontWeight: 'bold',
        cursor: 'pointer', backdropFilter: 'blur(8px)',
      }}>
        대한감시로 돌아가기
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
              const el = containerRef.current?.querySelector('gmp-map-3d');
              if (el) {
                // Map3DElement
                (el as HTMLElement & { center: unknown; tilt: number; range: number }).center =
                  { lat: city.lat, lng: city.lng, altitude: 300 };
                (el as HTMLElement & { range: number }).range = 1000;
                (el as HTMLElement & { tilt: number }).tilt = 60;
              } else if (mapRef.current) {
                // Fallback map
                mapRef.current.panTo({ lat: city.lat, lng: city.lng });
                mapRef.current.setZoom(17);
                mapRef.current.setTilt(60);
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
