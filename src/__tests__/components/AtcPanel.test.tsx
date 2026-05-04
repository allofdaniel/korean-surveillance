/**
 * AtcPanel — canonical AtcData type 통합 후 정상 렌더 회귀.
 *
 * 4 파일에서 통합한 AtcData/AtcSector 타입이 panel 의 optional 필드 처리
 * (FIR?, ACC ?? [], TMA ?? [], CTR ?? []) 와 호환되는지 검증.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AtcPanel from '../../components/AtcPanel';
import type { AtcData } from '../../types';

const mockAtcData: AtcData = {
  FIR: { name: 'Incheon FIR' },
  ACC: [
    { id: 'acc-incheon', name: 'Incheon ACC - North', color: '#ff0000', vertical_limits: 'GND-FL245' },
  ],
  TMA: [
    { id: 'tma-rkss', name: 'Seoul TMA', color: '#00ff00' },
  ],
  CTR: [
    { id: 'ctr-rksi', name: 'RKSI CTR', color: '#0000ff' },
  ],
};

const baseProps = {
  showAtcPanel: true,
  setShowAtcPanel: vi.fn(),
  atcOnlyMode: false,
  setAtcOnlyMode: vi.fn(),
  atcData: mockAtcData,
  selectedAtcSectors: new Set<string>(),
  setSelectedAtcSectors: vi.fn(),
  atcExpanded: { ACC: true, TMA: true, CTR: true },
  setAtcExpanded: vi.fn(),
  radarRange: 250,
  setRadarRange: vi.fn(),
  radarBlackBackground: false,
  setRadarBlackBackground: vi.fn(),
};

describe('AtcPanel', () => {
  it('정상 데이터 렌더 — FIR 이름 + 섹터 카운트 표시', () => {
    render(<AtcPanel {...baseProps} />);
    expect(screen.getByText(/Incheon FIR/)).toBeInTheDocument();
    expect(screen.getByText(/ACC \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/TMA \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/CTR \(1\)/)).toBeInTheDocument();
  });

  it('FIR 없는 데이터 — fallback 텍스트', () => {
    const noFir: AtcData = { ACC: [], TMA: [], CTR: [] };
    render(<AtcPanel {...baseProps} atcData={noFir} />);
    expect(screen.getByText('FIR')).toBeInTheDocument(); // fallback "'FIR'"
  });

  it('빈 atcData — 모든 카테고리 (0)', () => {
    const empty: AtcData = {};
    render(<AtcPanel {...baseProps} atcData={empty} />);
    // ACC/TMA/CTR 모두 0
    expect(screen.getByText(/ACC \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/TMA \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/CTR \(0\)/)).toBeInTheDocument();
  });

  it('panel 닫힌 상태 — 내용 미표시', () => {
    render(<AtcPanel {...baseProps} showAtcPanel={false} />);
    expect(screen.queryByText(/Incheon FIR/)).toBeNull();
  });

  it('atcData null — 내용 미표시 (button 만)', () => {
    render(<AtcPanel {...baseProps} atcData={null as never} />);
    // 패널 자체는 안 보이지만 toggle button 은 있음
    expect(screen.getByTitle(/관제구역/)).toBeInTheDocument();
    expect(screen.queryByText(/FIR/)).toBeNull();
  });

  it('초기화 버튼 클릭 → selected 비움', () => {
    const setSelected = vi.fn();
    render(
      <AtcPanel
        {...baseProps}
        selectedAtcSectors={new Set(['acc-incheon'])}
        setSelectedAtcSectors={setSelected}
      />,
    );
    fireEvent.click(screen.getByText(/초기화/));
    expect(setSelected).toHaveBeenCalledWith(expect.any(Set));
    const calledWith = setSelected.mock.calls[0]![0];
    expect(calledWith.size).toBe(0);
  });
});
