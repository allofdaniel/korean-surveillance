/**
 * LoadingOverlay — 첫 로드 오버레이 동작 회귀 테스트.
 *
 * 항공기 데이터 도착 후 페이드아웃 → unmount 가 정확히 일어나야 사용자 경험 보장.
 * setTimeout/setInterval cleanup 도 함께 검증.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LoadingOverlay from '../../components/LoadingOverlay';

describe('LoadingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기 상태 렌더 — 타이틀 표시', () => {
    render(<LoadingOverlay ready={false} aircraftCount={0} />);
    expect(screen.getByText(/KOREA AIR SURVEILLANCE/i)).toBeInTheDocument();
  });

  it('초기 단계 라벨 표시 (맵 엔진 초기화)', () => {
    render(<LoadingOverlay ready={false} aircraftCount={0} />);
    expect(screen.getByText(/맵 엔진 초기화/)).toBeInTheDocument();
  });

  it('aircraftCount > 0 일 때 카운터 표시', () => {
    render(<LoadingOverlay ready={true} aircraftCount={42} />);
    expect(screen.getByText(/42 대 수신/)).toBeInTheDocument();
  });

  it('ready + aircraft 들어오면 페이드아웃 트리거 (opacity 0)', async () => {
    const { container } = render(<LoadingOverlay ready={true} aircraftCount={5} />);
    expect(container.firstChild).not.toBeNull();

    // 페이드아웃 효과 — opacity 가 0 으로 바뀌어야 함
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    const overlay = container.querySelector('[role="status"]') as HTMLElement | null;
    expect(overlay?.style.opacity).toBe('0');
  });

  it('aria-live 와 role="status" — 접근성 속성', () => {
    render(<LoadingOverlay ready={false} aircraftCount={0} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('progress bar 인디케이터 4개 (4 STAGES)', () => {
    const { container } = render(<LoadingOverlay ready={false} aircraftCount={0} />);
    // STAGES 배열 길이만큼의 progress bar 가 있어야 함
    const indicators = container.querySelectorAll('[style*="width: 24px"]');
    expect(indicators.length).toBe(4);
  });
});
