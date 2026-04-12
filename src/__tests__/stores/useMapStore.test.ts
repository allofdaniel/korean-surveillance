/**
 * useMapStore 단위 테스트
 */
import { describe, it, expect, beforeEach } from 'vitest';
import useMapStore from '../../stores/useMapStore';

describe('useMapStore', () => {
  beforeEach(() => {
    useMapStore.getState().resetViewSettings();
  });

  describe('초기 상태', () => {
    it('기본값이 올바르게 설정됨', () => {
      const state = useMapStore.getState();
      expect(state.is3DView).toBe(false);
      expect(state.isDarkMode).toBe(true);
      expect(state.showSatellite).toBe(false);
      expect(state.showBuildings).toBe(true);
      expect(state.showTerrain).toBe(true);
      expect(state.show3DAltitude).toBe(true);
      expect(state.viewFilter).toBe('none');
      expect(state.showSatellites).toBe(false);
      expect(state.showCctv).toBe(false);
      expect(state.showShips).toBe(false);
      expect(state.showVwBuildings).toBe(false);
      expect(state.showVwSpecial).toBe(false);
      expect(state.showVwRoads).toBe(false);
    });
  });

  describe('setters', () => {
    it('setIs3DView가 3D 뷰 상태를 변경함', () => {
      useMapStore.getState().setIs3DView(true);
      expect(useMapStore.getState().is3DView).toBe(true);
    });

    it('setShowSatellite이 위성 표시 상태를 변경함', () => {
      useMapStore.getState().setShowSatellite(true);
      expect(useMapStore.getState().showSatellite).toBe(true);
    });

    it('setShowCctv가 CCTV 표시 상태를 변경함', () => {
      useMapStore.getState().setShowCctv(true);
      expect(useMapStore.getState().showCctv).toBe(true);
    });

    it('setViewFilter가 뷰 필터를 변경함', () => {
      useMapStore.getState().setViewFilter('nvg');
      expect(useMapStore.getState().viewFilter).toBe('nvg');
    });
  });

  describe('toggles', () => {
    it('toggle3DView가 3D 뷰를 토글함', () => {
      expect(useMapStore.getState().is3DView).toBe(false);
      useMapStore.getState().toggle3DView();
      expect(useMapStore.getState().is3DView).toBe(true);
      useMapStore.getState().toggle3DView();
      expect(useMapStore.getState().is3DView).toBe(false);
    });

    it('toggleDarkMode가 다크모드를 토글함', () => {
      expect(useMapStore.getState().isDarkMode).toBe(true);
      useMapStore.getState().toggleDarkMode();
      expect(useMapStore.getState().isDarkMode).toBe(false);
    });

    it('toggleSatellite이 위성 모드를 토글함', () => {
      expect(useMapStore.getState().showSatellite).toBe(false);
      useMapStore.getState().toggleSatellite();
      expect(useMapStore.getState().showSatellite).toBe(true);
    });
  });

  describe('cycleViewFilter', () => {
    it('뷰 필터를 순환함 (none → nvg → flir → crt → none)', () => {
      const store = useMapStore.getState();
      expect(store.viewFilter).toBe('none');

      store.cycleViewFilter();
      expect(useMapStore.getState().viewFilter).toBe('nvg');

      useMapStore.getState().cycleViewFilter();
      expect(useMapStore.getState().viewFilter).toBe('flir');

      useMapStore.getState().cycleViewFilter();
      expect(useMapStore.getState().viewFilter).toBe('crt');

      useMapStore.getState().cycleViewFilter();
      expect(useMapStore.getState().viewFilter).toBe('none');
    });
  });

  describe('resetViewSettings', () => {
    it('모든 설정을 기본값으로 리셋함', () => {
      const store = useMapStore.getState();
      store.setIs3DView(true);
      store.setShowSatellite(true);
      store.setShowCctv(true);
      store.setViewFilter('flir');

      store.resetViewSettings();
      const reset = useMapStore.getState();
      expect(reset.is3DView).toBe(false);
      expect(reset.showSatellite).toBe(false);
      expect(reset.showCctv).toBe(false);
      expect(reset.viewFilter).toBe('none');
    });
  });
});
