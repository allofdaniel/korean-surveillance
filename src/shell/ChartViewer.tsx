import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Maximize2, Layers, ExternalLink, Plane } from 'lucide-react';
import type { ChartEntry } from './data';
import { KOREAN_NAMES } from './data';
import ChartTraffic from './ChartTraffic';
import type { AircraftData } from '../hooks/useAircraftData';

interface ChartViewerProps {
  tabs: ChartEntry[];
  activeId: string;
  onActivate: (id: string) => void;
  onCloseTab: (id: string) => void;
  onClose: () => void;
  overlayOn: boolean;
  onToggleOverlay: () => void;
  opacity: number;
  onOpacity: (v: number) => void;
  aircraft: AircraftData[];
  selectedHex: string | null;
  onSelectAircraft: (ac: AircraftData) => void;
}

const TRAFFIC_KEY = 'ks.viewer.traffic';

type View = { s: number; x: number; y: number };
const MIN = 0.05, MAX = 8;

export default function ChartViewer(p: ChartViewerProps): React.ReactElement {
  const chart = p.tabs.find(t => t.id === p.activeId) || p.tabs[0];
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [traffic, setTraffic] = useState<boolean>(() => { try { return localStorage.getItem(TRAFFIC_KEY) !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem(TRAFFIC_KEY, traffic ? '1' : '0'); } catch { /* ignore */ } }, [traffic]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; v: View; cx: number; cy: number } | null>(null);

  const fit = useCallback((): void => {
    const st = stageRef.current, im = imgRef.current;
    if (!st || !im || !im.naturalWidth) return;
    const s = Math.min(st.clientWidth / im.naturalWidth, st.clientHeight / im.naturalHeight) * 0.98;
    setView({ s, x: (st.clientWidth - im.naturalWidth * s) / 2, y: (st.clientHeight - im.naturalHeight * s) / 2 });
  }, []);

  useEffect(() => { setLoaded(false); setNatural(null); }, [chart?.file]);
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const ro = new ResizeObserver(() => { if (loaded) fit(); });
    ro.observe(st);
    return () => ro.disconnect();
  }, [fit, loaded]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number): void => {
    setView(v => {
      const s = Math.min(MAX, Math.max(MIN, v.s * factor));
      const k = s / v.s;
      return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const r = st.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onDown = (e: React.PointerEvent): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const r = stageRef.current!.getBoundingClientRect();
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), v: view, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
    }
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent): void => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const { d, v, cx, cy } = pinch.current;
      const s = Math.min(MAX, Math.max(MIN, v.s * (Math.hypot(a.x - b.x, a.y - b.y) / d)));
      const k = s / v.s;
      setView({ s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    } else if (pointers.current.size === 1) {
      setView(v => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    }
  };
  const onUp = (e: React.PointerEvent): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const center = (): [number, number] => {
    const st = stageRef.current;
    return st ? [st.clientWidth / 2, st.clientHeight / 2] : [0, 0];
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') zoomAt(1.25, ...center());
      else if (e.key === '-') zoomAt(0.8, ...center());
      else if (e.key === '0') fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomAt, fit]);

  if (!chart) return <></>;

  return (
    <section className="ks-viewer" aria-label="차트 뷰어">
      <div className="ks-viewer-tabs" role="tablist" aria-label="열린 차트">
        {p.tabs.map(t => (
          <div key={t.id} role="tab" tabIndex={0} aria-selected={t.id === chart.id} className="ks-vtab"
            onClick={() => p.onActivate(t.id)} onKeyDown={e => { if (e.key === 'Enter') p.onActivate(t.id); }}>
            <span className="ks-mono">{t.airport}</span>
            <span>{t.type}</span>
            <span className="x" role="button" aria-label={`${t.name} 닫기`} onClick={e => { e.stopPropagation(); p.onCloseTab(t.id); }}><X size={12} /></span>
          </div>
        ))}
      </div>

      <div className="ks-viewer-bar">
        <div className="t">
          <b title={chart.name}>{chart.name}</b>
          <small>{chart.airport} {KOREAN_NAMES[chart.airport] || ''} · {chart.chartNo ? `AD 2-${chart.chartNo.replace(/^2-/, '')}` : chart.type}{chart.bounds ? (chart.rmsM != null ? ` · 지도 정합 ±${Math.max(1, Math.round(chart.rmsM))}m` : chart.method === 'ocr' ? ' · 좌표 OCR(근사)' : '') : ''}</small>
        </div>
        {chart.bounds && chart.clip && (
          <button type="button" className="ks-icon-btn" aria-pressed={traffic} onClick={() => setTraffic(t => !t)}
            title={traffic ? '차트 위 항공기 숨기기' : '차트 위에 실시간 항공기 표시'} aria-label="차트 위 항공기">
            <Plane size={15} />
          </button>
        )}
        {chart.bounds && (
          <>
            <button type="button" className="ks-overlay-toggle" style={{ height: 30, padding: '0 10px', fontSize: 12 }} aria-pressed={p.overlayOn} onClick={p.onToggleOverlay}>
              <Layers size={13} /> 지도에 겹치기
            </button>
            {p.overlayOn && (
              <label className="ks-opacity">투명도
                <input type="range" min={0.2} max={1} step={0.05} value={p.opacity} onChange={e => p.onOpacity(Number(e.target.value))} aria-label="차트 겹치기 투명도" />
              </label>
            )}
          </>
        )}
        <a className="ks-icon-btn" href={chart.pdf ? `${chart.pdf}${chart.page ? `#page=${chart.page}` : ''}` : chart.file} target="_blank" rel="noopener noreferrer" title={chart.pdf ? 'eAIP 원본 PDF 새 탭으로' : '원본 이미지 새 탭으로'}><ExternalLink size={15} /></a>
        <button type="button" className="ks-icon-btn" onClick={p.onClose} title="뷰어 닫기" aria-label="차트 뷰어 닫기"><X size={17} /></button>
      </div>

      <div ref={stageRef} className={`ks-viewer-stage ${dragging ? 'dragging' : ''}`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={fit}>
        {!loaded && <div className="ks-viewer-loading">차트 불러오는 중…</div>}
        <img ref={imgRef} key={chart.file} src={chart.file} alt={`${chart.airport} ${chart.name}`} draggable={false}
          onLoad={e => { setLoaded(true); setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); requestAnimationFrame(fit); }}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, opacity: loaded ? 1 : 0 }} />
        {traffic && loaded && natural && chart.bounds && chart.clip && (
          <ChartTraffic aircraft={p.aircraft} bounds={chart.bounds} clip={chart.clip} width={natural.w} height={natural.h}
            view={view} selectedHex={p.selectedHex} onSelect={p.onSelectAircraft}
            showGround={['ADC', 'PDC', 'GMC'].includes(chart.type)} />
        )}
        <div className="ks-viewer-zoom">
          <button type="button" onClick={() => zoomAt(1.3, ...center())} aria-label="확대"><Plus size={16} /></button>
          <button type="button" onClick={() => zoomAt(1 / 1.3, ...center())} aria-label="축소"><Minus size={16} /></button>
          <button type="button" onClick={fit} aria-label="화면에 맞추기"><Maximize2 size={15} /></button>
        </div>
      </div>
    </section>
  );
}
