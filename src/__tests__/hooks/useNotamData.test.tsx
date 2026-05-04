/**
 * useNotamData hook — cache, race condition, silent prefetch 회귀 테스트.
 *
 * 이 hook 의 module-level memory cache 와 silent flag, AbortController 동작은
 * 손상되면 NOTAM UI 가 stuck loading 상태가 되거나 unmount 후 setState 경고를 일으킨다.
 *
 * NOTE: notamMemoryCache 가 module-level state 라서 vi.resetModules() 로 각 테스트 간
 * 격리하고 useNotamData 를 동적으로 re-import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const MOCK_NOTAM_RESPONSE = {
  data: [
    {
      id: 'A0001/26',
      notam_number: 'A0001/26',
      location: 'RKSI',
      qcode: 'QMRLC',
      qcode_mean: 'Runway closed',
      e_text: 'RWY 15L/33R CLSD',
      full_text: 'Q)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E005',
      effective_start: '2604010000',
      effective_end: '2604301200',
      series: 'A',
      fir: 'RKRR',
      q_lat: 37.46,
      q_lon: 126.44,
      q_radius: 5,
    },
  ],
  count: 1,
  returned: 1,
  source: 'database',
};

// 모듈을 매 테스트마다 fresh import — module-level cache 격리
async function importFreshHook(): Promise<typeof import('../../hooks/useNotamData').default> {
  vi.resetModules();
  const mod = await import('../../hooks/useNotamData');
  return mod.default;
}

describe('useNotamData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(MOCK_NOTAM_RESPONSE),
      } as never),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('첫 마운트 시 current period 자동 fetch', async () => {
    const useNotamData = await importFreshHook();
    const { result } = renderHook(() => useNotamData());
    await waitFor(() => {
      expect(result.current.notamData).not.toBeNull();
    });
    expect(result.current.notamData?.data).toHaveLength(1);
    expect(result.current.notamPeriod).toBe('current');
  });

  it('fetchNotamData 가 silent=true 면 loading state 변경 안함', async () => {
    const useNotamData = await importFreshHook();
    const { result } = renderHook(() => useNotamData());
    await waitFor(() => expect(result.current.notamData).not.toBeNull());

    let loadingDuringSilent = false;
    await act(async () => {
      const promise = result.current.fetchNotamData('1month', true, true);
      loadingDuringSilent = result.current.notamLoading;
      await promise;
    });
    expect(loadingDuringSilent).toBe(false);
  });

  it('forceRefresh=true 면 cache 무시하고 재요청', async () => {
    const useNotamData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { result } = renderHook(() => useNotamData());
    await waitFor(() => expect(result.current.notamData).not.toBeNull());

    const callCountBefore = fetchMock.mock.calls.length;
    await act(async () => {
      await result.current.fetchNotamData('current', true);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('네트워크 에러 + cache 없음 → error state', async () => {
    const useNotamData = await importFreshHook();
    // fetch 첫 호출부터 실패하게 mock
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject(new Error('Network down')),
    );

    const { result } = renderHook(() => useNotamData());
    await waitFor(() => {
      expect(result.current.notamError).not.toBeNull();
    });
  });

  it('notamLocationsOnMap setter 정상 동작', async () => {
    const useNotamData = await importFreshHook();
    const { result } = renderHook(() => useNotamData());
    act(() => {
      result.current.setNotamLocationsOnMap(new Set(['RKSI', 'RKPU']));
    });
    expect(result.current.notamLocationsOnMap.has('RKSI')).toBe(true);
    expect(result.current.notamLocationsOnMap.has('RKPU')).toBe(true);
    expect(result.current.notamLocationsOnMap.size).toBe(2);
  });

  it('첫 fetch 성공 시 notamHealth.isConnected=true + notamCount 정확', async () => {
    const useNotamData = await importFreshHook();
    const { result } = renderHook(() => useNotamData());
    await waitFor(() => {
      expect(result.current.notamHealth.isConnected).toBe(true);
    });
    expect(result.current.notamHealth.notamCount).toBe(1);
    expect(result.current.notamHealth.lastSuccessTime).toBeGreaterThan(0);
  });
});
