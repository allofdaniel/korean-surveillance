/**
 * useWeatherData hook — METAR/TAF cache + AbortController 회귀.
 *
 * 5분 cache + 5분 자동 refresh interval + 종료 시 abort cleanup 가 깨지면
 * 항공기상 panel 이 stuck 되거나 unmount 후 setState 경고 발생.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const MOCK_METAR = [
  {
    icaoId: 'RKPU',
    obsTime: '2026-04-15T04:00:00Z',
    temp: 15,
    fltCat: 'VFR',
    rawOb: 'RKPU 150400Z 09010KT CAVOK 15/05 Q1015',
  },
];

const MOCK_TAF = [
  { icaoId: 'RKPU', rawTAF: 'TAF RKPU 150400Z 1506/1606 09010KT CAVOK' },
];

async function importFreshHook() {
  vi.resetModules();
  const mod = await import('../../hooks/useWeatherData');
  return mod.default;
}

describe('useWeatherData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      const urlStr = String(url);
      const data = urlStr.includes('type=metar') ? MOCK_METAR
                 : urlStr.includes('type=taf') ? MOCK_TAF
                 : [];
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data),
      } as never);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('airport=null 이면 fetch 안함', async () => {
    const useWeatherData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    renderHook(() => useWeatherData(null, false, false, false, false, false));
    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('airport 있으면 METAR + TAF fetch', async () => {
    const useWeatherData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    const { result } = renderHook(() =>
      useWeatherData({ lat: 35.5, lon: 129.3 }, false, false, false, false, false),
    );

    await waitFor(() => {
      expect(result.current.weatherData).not.toBeNull();
    });

    // metar + taf 둘 다 호출
    const calls = fetchMock.mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('type=metar'))).toBe(true);
    expect(calls.some(u => u.includes('type=taf'))).toBe(true);
  });

  it('showRadar=true 면 radar fetch', async () => {
    const useWeatherData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    renderHook(() =>
      useWeatherData(null, true, false, false, false, false),
    );

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('type=radar'))).toBe(true);
    });
  });

  it('showLightning=true 면 lightning fetch', async () => {
    const useWeatherData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    renderHook(() =>
      useWeatherData(null, false, false, true, false, false),
    );

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('type=lightning'))).toBe(true);
    });
  });

  it('showSigmet=true 면 sigmet + llws 둘 다 fetch', async () => {
    const useWeatherData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    renderHook(() =>
      useWeatherData(null, false, false, false, true, false),
    );

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('type=sigmet'))).toBe(true);
      expect(calls.some(u => u.includes('type=llws'))).toBe(true);
    });
  });

  it('weatherHealth: 첫 fetch 성공 시 isConnected=true', async () => {
    const useWeatherData = await importFreshHook();
    const { result } = renderHook(() =>
      useWeatherData({ lat: 35.5, lon: 129.3 }, false, false, false, false, false),
    );

    await waitFor(() => {
      expect(result.current.weatherHealth.isConnected).toBe(true);
    });
  });

  it('unmount 시 interval cleanup', async () => {
    const useWeatherData = await importFreshHook();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

    const { result, unmount } = renderHook(() =>
      useWeatherData({ lat: 35.5, lon: 129.3 }, false, false, false, false, false),
    );

    await waitFor(() => expect(result.current.weatherData).not.toBeNull());
    const callsAfterMount = fetchMock.mock.calls.length;

    unmount();
    // unmount 후 짧게 기다려도 새 fetch 안 발생
    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock.mock.calls.length).toBe(callsAfterMount);
  });
});
