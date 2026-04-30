/**
 * MapContextMenu Component
 * DO-278A 요구사항 추적: SRS-UI-005
 *
 * 지도 우클릭 시 나타나는 컨텍스트 메뉴
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  coordinate: { lat: number; lon: number };
}

interface MapContextMenuProps {
  onCopyCoordinates?: (lat: number, lon: number) => void;
  onAddMarker?: (lat: number, lon: number) => void;
  onCenterMap?: (lat: number, lon: number) => void;
}

export function MapContextMenu({
  onCopyCoordinates,
  onAddMarker,
  onCenterMap,
}: MapContextMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 이벤트 리스너 등록
  useEffect(() => {
    const handleMapContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent<{
        position: { x: number; y: number };
        coordinate: { lat: number; lon: number };
      }>;
      const { position, coordinate } = customEvent.detail;

      console.info('[ContextMenu] Received event:', position, coordinate);

      setContextMenu({
        isOpen: true,
        position,
        coordinate,
      });
    };

    // 좌클릭 시 메뉴 닫기
    const handleClick = () => {
      setContextMenu(null);
    };

    // ESC 키로 메뉴 닫기
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('map-contextmenu', handleMapContextMenu);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('map-contextmenu', handleMapContextMenu);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 좌표 복사
  const handleCopyCoordinates = () => {
    if (!contextMenu) return;
    const { lat, lon } = contextMenu.coordinate;
    const coordString = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    navigator.clipboard.writeText(coordString);
    onCopyCoordinates?.(lat, lon);
    closeContextMenu();
  };

  // 마커 추가
  const handleAddMarker = () => {
    if (!contextMenu) return;
    const { lat, lon } = contextMenu.coordinate;
    onAddMarker?.(lat, lon);
    closeContextMenu();
  };

  // 지도 중심으로 이동
  const handleCenterMap = () => {
    if (!contextMenu) return;
    const { lat, lon } = contextMenu.coordinate;
    onCenterMap?.(lat, lon);
    closeContextMenu();
  };

  if (!contextMenu?.isOpen) {
    return null;
  }

  const { position, coordinate } = contextMenu;

  return (
    <div
      className="map-context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        backgroundColor: 'rgba(30, 30, 40, 0.95)',
        border: '1px solid rgba(100, 100, 120, 0.5)',
        borderRadius: '8px',
        padding: '4px 0',
        minWidth: '200px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 좌표 표시 헤더 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid rgba(100, 100, 120, 0.3)',
          fontSize: '11px',
          color: 'rgba(180, 180, 200, 0.8)',
          fontFamily: 'monospace',
        }}
      >
        {coordinate.lat.toFixed(6)}, {coordinate.lon.toFixed(6)}
      </div>

      {/* 메뉴 항목들 */}
      <div style={{ padding: '4px 0' }}>
        <MenuItem
          icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="7" height="9" rx="1"/><path d="M4 1V0.5M8 1V0.5"/><path d="M4 4h4M4 6.5h2.5"/></svg>}
          label="좌표 복사"
          onClick={handleCopyCoordinates}
        />
        <MenuItem
          icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1C4.343 1 3 2.343 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.657-1.343-3-3-3z"/><circle cx="6" cy="4" r="1"/></svg>}
          label="마커 추가"
          onClick={handleAddMarker}
        />
        <MenuItem
          icon={<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4"/><circle cx="6" cy="6" r="1.5"/><line x1="6" y1="1" x2="6" y2="2.5"/><line x1="6" y1="9.5" x2="6" y2="11"/><line x1="1" y1="6" x2="2.5" y2="6"/><line x1="9.5" y1="6" x2="11" y2="6"/></svg>}
          label="이 위치로 이동"
          onClick={handleCenterMap}
        />
      </div>
    </div>
  );
}

// 메뉴 아이템 컴포넌트
function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        background: 'transparent',
        color: '#fff',
        fontSize: '13px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(70, 130, 180, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default MapContextMenu;
