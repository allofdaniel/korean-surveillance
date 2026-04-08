/**
 * useMapContextMenu Hook
 * DO-278A 요구사항 추적: SRS-HOOK-004
 *
 * 지도 Context Menu 관리를 위한 React Hook
 * MapContainer에서 발생시키는 'map-contextmenu' 커스텀 이벤트를 수신
 */

import { useState, useEffect, useCallback } from 'react';
import type { Coordinate } from '@/types';

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  coordinate: Coordinate;
}

interface UseMapContextMenuOptions {
  enabled?: boolean;
}

interface UseMapContextMenuReturn {
  contextMenu: ContextMenuState | null;
  closeContextMenu: () => void;
}

interface MapContextMenuEventDetail {
  position: { x: number; y: number };
  coordinate: { lat: number; lon: number };
}

/**
 * 지도 Context Menu 관리 Hook
 * MapContainer에서 발생시키는 'map-contextmenu' 커스텀 이벤트를 수신
 */
export function useMapContextMenu({
  enabled = true,
}: UseMapContextMenuOptions = {}): UseMapContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  /**
   * Context Menu 닫기
   */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * 커스텀 이벤트 리스너 등록
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleMapContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent<MapContextMenuEventDetail>;
      const { position, coordinate } = customEvent.detail;

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

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('map-contextmenu', handleMapContextMenu);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('map-contextmenu', handleMapContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, [enabled]);

  return {
    contextMenu,
    closeContextMenu,
  };
}

export default useMapContextMenu;
