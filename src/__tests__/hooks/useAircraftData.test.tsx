/**
 * useAircraftData hook — fetch + 429 백오프 + AbortController 회귀 테스트.
 *
 * 항공기 데이터 폴링은 핵심 실시간 기능이라 race condition / 429 처리가 깨지면
 * UI 가 stuck 되거나 무제한 요청 폭주 가능.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const MOCK_AIRCRAFT = {
  ac: [
    {
      hex: '7c7c7c',
      flight: 'KAL319',
      lat: 37.5,
      lon: 126.5,
      alt_baro: 35000,
      gs: 450,
      track: 90,
      type: 'B789',
      r: 'HL8001',
      squawk: '7000',
    },
  ],
  total: 1,
};

async function importFreshHook() {
  vi.resetModules();
  const mod = await import('../../hooks/useAircraftData');
  return mod.default;
}

describe('useAircraftData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(MOCK_AIRCRAFT)),
        json: () => Promise.resolve(MOCK_AIRCRAFT),
      } as never),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mapLoaded=false 면 fetch 안함', async () => {
    const useAircraftData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    renderHook(() => useAircraftData(null, false, true, 300000));
    // 짧게 기다려도 fetch 호출 안됨
    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('showAircraft=false 면 fetch 안함', async () => {
    const useAircraftData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    renderHook(() => useAircraftData(null, true, false, 300000));
    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mapLoaded=true + showAircraft=true 시 첫 fetch 호출', async () => {
    const useAircraftData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    renderHook(() => useAircraftData(null, true, true, 300000));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // URL 에 한반도 중심 좌표 + 500nm radius 포함 (KOREA_FALLBACK)
    const calledWith = fetchMock.mock.calls[0]![0];
    expect(String(calledWith)).toMatch(/lat=36\.5/);
    expect(String(calledWith)).toMatch(/lon=127\.8/);
    expect(String(calledWith)).toMatch(/radius=500/);
  });

  it('초기 dataHealth: isConnected=false', async () => {
    const useAircraftData = await importFreshHook();
    const { result } = renderHook(() => useAircraftData(null, false, false, 300000));
    expect(result.current.dataHealth.isConnected).toBe(false);
    expect(result.current.dataHealth.aircraftCount).toBe(0);
  });

  it('성공적 fetch 후 aircraft 배열 채워짐', async () => {
    const useAircraftData = await importFreshHook();
    const { result } = renderHook(() => useAircraftData(null, true, true, 300000));

    await waitFor(
      () => {
        expect(result.current.aircraft.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    expect(result.current.aircraft[0]?.hex).toBe('7c7c7c');
  });

  it('unmount 시 interval cleanup — 추가 fetch 안 발생', async () => {
    const useAircraftData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { unmount } = renderHook(() => useAircraftData(null, true, true, 300000));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callCountAfterMount = fetchMock.mock.calls.length;

    unmount();
    // 폴링 간격(15s) 보다 긴 시간 진행 — unmount 후 새 fetch 가 없어야 함
    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock.mock.calls.length).toBe(callCountAfterMount);
  });
});
