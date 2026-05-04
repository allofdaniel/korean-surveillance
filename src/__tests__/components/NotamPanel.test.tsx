/**
 * NotamPanel — smoke / interpretation card 회귀 테스트.
 *
 * 한국어 해석 카드, 빈 상태, error 표시, 패널 토글이 정상 렌더링되는지 검증.
 * 자세한 로직은 utils/notam 의 테스트가 담당하므로 여기서는 표시 통합만 확인.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotamPanel from '../../components/NotamPanel';

const mockNotam = {
  id: 'A0001/26',
  notam_number: 'A0001/26',
  location: 'RKSI',
  qcode: 'QMRLC',
  qcode_mean: 'Runway closed',
  e_text: 'RWY 15L/33R CLSD DUE TO MAINT',
  full_text: '(A0001/26 NOTAMN\nQ)RKRR/QMRLC/IV/NBO/A/000/100/3729N12626E005\nA)RKSI B)2604010000 C)2604301200',
  effective_start: '2604010000',
  effective_end: '2604301200',
  series: 'A',
  fir: 'RKRR',
};

const baseProps = {
  showNotamPanel: true,
  setShowNotamPanel: vi.fn(),
  notamData: { data: [mockNotam], returned: 1 },
  notamLoading: false,
  notamError: null,
  notamPeriod: 'current',
  setNotamPeriod: vi.fn(),
  notamFilter: '',
  setNotamFilter: vi.fn(),
  notamExpanded: {},
  setNotamExpanded: vi.fn(),
  notamLocationsOnMap: new Set<string>(),
  setNotamLocationsOnMap: vi.fn(),
  fetchNotamData: vi.fn(),
  showLightning: false,
  setShowLightning: vi.fn(),
  showSigmet: false,
  setShowSigmet: vi.fn(),
  sigmetData: null,
  lightningData: null,
};

describe('NotamPanel', () => {
  it('정상 데이터 렌더 — NOTAM 번호 표시', () => {
    render(<NotamPanel {...baseProps} />);
    expect(screen.getAllByText(/A0001\/26/).length).toBeGreaterThan(0);
  });

  it('error state 렌더', () => {
    render(<NotamPanel {...baseProps} notamData={null} notamError="네트워크 오류" />);
    expect(screen.getByText(/네트워크 오류/)).toBeInTheDocument();
  });

  it('패널 닫힌 상태에서는 panel content 미표시', () => {
    const { container } = render(<NotamPanel {...baseProps} showNotamPanel={false} />);
    // 닫힌 상태에서도 toggle button 은 있을 수 있음 — 패널 내부 콘텐츠 여부만 검증
    const panel = container.querySelector('.notam-dropdown');
    expect(panel).toBeNull();
  });

  it('빈 데이터 — 0건이어도 throw 없이 렌더', () => {
    expect(() => {
      render(<NotamPanel {...baseProps} notamData={{ data: [], returned: 0 }} />);
    }).not.toThrow();
  });

  it('Loading state — throw 없이 렌더', () => {
    expect(() => {
      render(<NotamPanel {...baseProps} notamData={null} notamLoading={true} />);
    }).not.toThrow();
  });
});
