import { create } from 'zustand';

/**
 * MapStore - 지도 뷰 관련 상태 관리
 * - 3D/2D 뷰
 * - 다크모드/위성
 * - 지형/건물 표시
 */

type ViewFilter = 'none' | 'nvg' | 'flir' | 'crt';

interface MapState {
  // View mode
  is3DView: boolean;
  isDarkMode: boolean;
  showSatellite: boolean;

  // 3D features
  showBuildings: boolean;
  showTerrain: boolean;
  show3DAltitude: boolean;

  // Visual filters (NVG/FLIR/CRT)
  viewFilter: ViewFilter;

  // Satellite tracking
  showSatellites: boolean;

  // CCTV
  showCctv: boolean;

  // Ships
  showShips: boolean;

  // V-World layers
  showVwBuildings: boolean;
  showVwSpecial: boolean;
  showVwRoads: boolean;

  // Cesium 3D viewer
  showCesium: boolean;
}

interface MapActions {
  // Setters
  setIs3DView: (value: boolean) => void;
  setIsDarkMode: (value: boolean) => void;
  setShowSatellite: (value: boolean) => void;
  setShowBuildings: (value: boolean) => void;
  setShowTerrain: (value: boolean) => void;
  setShow3DAltitude: (value: boolean) => void;
  setViewFilter: (value: ViewFilter) => void;
  cycleViewFilter: () => void;
  setShowSatellites: (value: boolean) => void;
  setShowCctv: (value: boolean) => void;
  setShowShips: (value: boolean) => void;
  setShowVwBuildings: (value: boolean) => void;
  setShowVwSpecial: (value: boolean) => void;
  setShowVwRoads: (value: boolean) => void;
  setShowCesium: (value: boolean) => void;

  // Toggles
  toggle3DView: () => void;
  toggleDarkMode: () => void;
  toggleSatellite: () => void;

  // Reset
  resetViewSettings: () => void;
}

export type MapStore = MapState & MapActions;

const useMapStore = create<MapStore>((set) => ({
  // View mode
  is3DView: false,
  isDarkMode: true,
  showSatellite: false,

  // 3D features
  showBuildings: true,
  showTerrain: true,
  show3DAltitude: true,

  // Visual filters
  viewFilter: 'none' as ViewFilter,

  // Satellite tracking
  showSatellites: false,

  // CCTV
  showCctv: false,

  // Ships
  showShips: false,

  // V-World layers
  showVwBuildings: false,
  showVwSpecial: false,
  showVwRoads: false,

  // Cesium
  showCesium: false,

  // Actions
  setIs3DView: (value) => set({ is3DView: value }),
  setIsDarkMode: (value) => set({ isDarkMode: value }),
  setShowSatellite: (value) => set({ showSatellite: value }),
  setShowBuildings: (value) => set({ showBuildings: value }),
  setShowTerrain: (value) => set({ showTerrain: value }),
  setShow3DAltitude: (value) => set({ show3DAltitude: value }),
  setViewFilter: (value) => set({ viewFilter: value }),
  cycleViewFilter: () => set((state) => {
    const order: ViewFilter[] = ['none', 'nvg', 'flir', 'crt'];
    const idx = order.indexOf(state.viewFilter);
    return { viewFilter: order[(idx + 1) % order.length] };
  }),
  setShowSatellites: (value) => set({ showSatellites: value }),
  setShowCctv: (value) => set({ showCctv: value }),
  setShowShips: (value) => set({ showShips: value }),
  setShowVwBuildings: (value) => set({ showVwBuildings: value }),
  setShowVwSpecial: (value) => set({ showVwSpecial: value }),
  setShowVwRoads: (value) => set({ showVwRoads: value }),
  setShowCesium: (value) => set({ showCesium: value }),

  // Toggle helpers
  toggle3DView: () => set((state) => ({ is3DView: !state.is3DView })),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  toggleSatellite: () => set((state) => ({ showSatellite: !state.showSatellite })),

  // Reset to defaults
  resetViewSettings: () => set({
    is3DView: false,
    isDarkMode: true,
    showSatellite: false,
    showBuildings: true,
    showTerrain: true,
    show3DAltitude: true,
    viewFilter: 'none' as ViewFilter,
    showSatellites: false,
    showCctv: false,
    showShips: false,
    showVwBuildings: false,
    showVwSpecial: false,
    showVwRoads: false,
    showCesium: false,
  }),
}));

export default useMapStore;
