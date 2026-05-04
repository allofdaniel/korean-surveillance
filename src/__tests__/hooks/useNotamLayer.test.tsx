/**
 * useNotamLayer hook — 지도 layer 추가/제거 동작 회귀 테스트.
 *
 * locations 가 비어있으면 layer 안 그려야 하고, 데이터 변경 시 cleanup → 재추가
 * 흐름이 깨지면 layer 가 누적되거나 stale 한 NOTAM 이 표시됨.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import useNotamLayer from '../../hooks/useNotamLayer';

const MOCK_NOTAM = {
  id: 'A0001/26',
  notam_number: 'A0001/26',
  location: 'RKSI',
  qcode: 'QMRLC',
  qcode_mean: 'Runway closed',
  e_text: 'RWY 15L/33R CLSD',
  full_text: 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E005',
  effective_start: '2604010000',
  effective_end: '2904301200',
  series: 'A',
  fir: 'RKRR',
};

function makeMockMap() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getSource: vi.fn(() => null),
    getLayer: vi.fn(() => null),
    getCanvas: vi.fn(() => ({ style: { cursor: '' } })),
  };
}

describe('useNotamLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mapLoaded=false 면 layer 추가 안함', () => {
    const mockMap = makeMockMap();
    renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, false, new Set(), { data: [MOCK_NOTAM] }, false);
    });
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  it('locations 비어있으면 layer 추가 안함', () => {
    const mockMap = makeMockMap();
    renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, true, new Set(), { data: [MOCK_NOTAM] }, false);
    });
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  it('notamData null 이면 layer 추가 안함', () => {
    const mockMap = makeMockMap();
    renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, true, new Set(['RKSI']), null, false);
    });
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  it('locations 선택 + data 있음 → layer 추가', () => {
    const mockMap = makeMockMap();
    renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, true, new Set(['RKSI']), { data: [MOCK_NOTAM] }, false);
    });
    // notam-areas source + notam-fill, notam-outline, notam-icons, notam-labels 등 layer
    expect(mockMap.addSource).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled();
    // 최소한 'notam-fill' 레이어가 추가됨
    const addLayerCalls = mockMap.addLayer.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(addLayerCalls).toContain('notam-fill');
    expect(addLayerCalls).toContain('notam-outline');
    expect(addLayerCalls).toContain('notam-icons');
  });

  it('selected location 외 NOTAM 은 표시 안됨', () => {
    const mockMap = makeMockMap();
    const otherLocationNotam = { ...MOCK_NOTAM, location: 'RKPU' };
    renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, true, new Set(['RKSI']), { data: [otherLocationNotam] }, false);
    });
    // location 'RKSI' 가 선택됐는데 NOTAM 의 location 은 'RKPU' → 통과 안함 → layer 추가 안됨
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  it('3D mode 시 fill-extrusion layer 추가', () => {
    const mockMap = makeMockMap();
    renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, true, new Set(['RKSI']), { data: [MOCK_NOTAM] }, true);
    });
    const addLayerCalls = mockMap.addLayer.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(addLayerCalls).toContain('notam-extrusion');
  });

  it('unmount 시 listener cleanup', () => {
    const mockMap = makeMockMap();
    const { unmount } = renderHook(() => {
      const ref = useRef(mockMap as never);
      return useNotamLayer(ref, true, new Set(['RKSI']), { data: [MOCK_NOTAM] }, false);
    });
    unmount();
    // off 가 호출되어야 함 — click/mouseenter/mouseleave 모두
    expect(mockMap.off).toHaveBeenCalled();
  });
});
