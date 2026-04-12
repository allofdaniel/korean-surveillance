/**
 * useUIStore 단위 테스트
 */
import { describe, it, expect, beforeEach } from 'vitest';
import useUIStore from '../../stores/useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset to known state
    const store = useUIStore.getState();
    store.setIsPanelOpen(true);
    store.setLayersExpanded(true);
  });

  describe('패널 토글', () => {
    it('setIsPanelOpen이 패널 열림/닫힘 상태를 설정함', () => {
      useUIStore.getState().setIsPanelOpen(false);
      expect(useUIStore.getState().isPanelOpen).toBe(false);
    });

    it('togglePanel이 패널 상태를 토글함', () => {
      useUIStore.getState().setIsPanelOpen(true);
      useUIStore.getState().togglePanel();
      expect(useUIStore.getState().isPanelOpen).toBe(false);
      useUIStore.getState().togglePanel();
      expect(useUIStore.getState().isPanelOpen).toBe(true);
    });
  });

  describe('아코디언 상태', () => {
    it('setLayersExpanded가 레이어 확장 상태를 설정함', () => {
      useUIStore.getState().setLayersExpanded(false);
      expect(useUIStore.getState().layersExpanded).toBe(false);
    });

    it('setAircraftExpanded가 항공기 확장 상태를 설정함', () => {
      useUIStore.getState().setAircraftExpanded(true);
      expect(useUIStore.getState().aircraftExpanded).toBe(true);
    });
  });
});
