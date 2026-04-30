/**
 * mapbox utility helpers — safeRemoveLayer / safeRemoveSource.
 *
 * 이 helper 들이 깨지면 모든 hook 의 cleanup 이 무력화되어
 * style reload / unmount 시 layer 누적 → 메모리 leak 발생.
 */

import { describe, it, expect, vi } from 'vitest';
import { safeRemoveLayer, safeRemoveSource } from '../../utils/mapbox';

describe('safeRemoveLayer', () => {
  it('null map → no-op (throw 안함)', () => {
    expect(() => safeRemoveLayer(null, 'test-layer')).not.toThrow();
    expect(() => safeRemoveLayer(undefined, 'test-layer')).not.toThrow();
  });

  it('layer 가 존재하면 removeLayer 호출', () => {
    const removeLayer = vi.fn();
    const mockMap = {
      getLayer: vi.fn().mockReturnValue({ id: 'test-layer' }),
      removeLayer,
    };
    safeRemoveLayer(mockMap as never, 'test-layer');
    expect(mockMap.getLayer).toHaveBeenCalledWith('test-layer');
    expect(removeLayer).toHaveBeenCalledWith('test-layer');
  });

  it('layer 가 없으면 removeLayer 호출 안함', () => {
    const removeLayer = vi.fn();
    const mockMap = {
      getLayer: vi.fn().mockReturnValue(null),
      removeLayer,
    };
    safeRemoveLayer(mockMap as never, 'missing');
    expect(removeLayer).not.toHaveBeenCalled();
  });

  it('removeLayer 가 throw 해도 catch — graceful', () => {
    const mockMap = {
      getLayer: vi.fn().mockReturnValue({ id: 'x' }),
      removeLayer: vi.fn(() => { throw new Error('boom'); }),
    };
    expect(() => safeRemoveLayer(mockMap as never, 'x')).not.toThrow();
  });
});

describe('safeRemoveSource', () => {
  it('null map → no-op', () => {
    expect(() => safeRemoveSource(null, 'test-source')).not.toThrow();
    expect(() => safeRemoveSource(undefined, 'test-source')).not.toThrow();
  });

  it('source 가 존재하면 removeSource 호출', () => {
    const removeSource = vi.fn();
    const mockMap = {
      getSource: vi.fn().mockReturnValue({ id: 'test-source' }),
      removeSource,
    };
    safeRemoveSource(mockMap as never, 'test-source');
    expect(removeSource).toHaveBeenCalledWith('test-source');
  });

  it('source 가 없으면 removeSource 호출 안함', () => {
    const removeSource = vi.fn();
    const mockMap = {
      getSource: vi.fn().mockReturnValue(null),
      removeSource,
    };
    safeRemoveSource(mockMap as never, 'missing');
    expect(removeSource).not.toHaveBeenCalled();
  });

  it('removeSource 가 throw 해도 catch — graceful', () => {
    const mockMap = {
      getSource: vi.fn().mockReturnValue({ id: 'x' }),
      removeSource: vi.fn(() => { throw new Error('source still in use'); }),
    };
    expect(() => safeRemoveSource(mockMap as never, 'x')).not.toThrow();
  });
});
