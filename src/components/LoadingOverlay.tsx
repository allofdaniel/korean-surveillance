import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  /** 지도 + 데이터 로딩 완료 여부 */
  ready: boolean;
  /** 표시 중인 항공기 수 (있으면 즉시 사라짐) */
  aircraftCount: number;
}

const STAGES = [
  { threshold: 0,   label: '맵 엔진 초기화' },
  { threshold: 800, label: '한반도 항공 정보 로딩' },
  { threshold: 1600, label: 'ADS-B 수신기 연결' },
  { threshold: 2600, label: '항적 데이터 수신' },
] as const;

/**
 * LoadingOverlay - 첫 로드 시 항적 데이터 도착까지 표시되는 풀스크린 오버레이.
 *
 * 표시 조건:
 *   - 첫 항공기 데이터(`aircraftCount > 0`)가 들어오기 전까지
 *   - `ready`(map + 정적 데이터 로드 완료) 가 false 인 동안
 * 첫 항공기가 들어오면 페이드아웃 후 unmount.
 */
export default function LoadingOverlay({ ready, aircraftCount }: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // 단계별 라벨 회전 + 15초 타임아웃
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const ms = performance.now() - start;
      setElapsed(ms);
      let next = 0;
      for (let i = 0; i < STAGES.length; i++) {
        const stage = STAGES[i];
        if (stage && ms >= stage.threshold) next = i;
      }
      setStageIdx(next);
    }, 200);
    const timeoutId = setTimeout(() => setTimedOut(true), 15000);
    return () => {
      clearInterval(id);
      clearTimeout(timeoutId);
    };
  }, []);

  // 첫 데이터 도착 → 페이드아웃 → unmount
  useEffect(() => {
    if (!mounted || fading) return;
    if (ready && aircraftCount > 0) {
      setFading(true);
      const t = setTimeout(() => setMounted(false), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [ready, aircraftCount, mounted, fading]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(8,16,28,0.96) 0%, rgba(0,0,0,0.99) 80%)',
        color: '#a8e3ff',
        fontFamily: '"Inter","Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {/* 레이더 스위프 + 동심원 */}
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          <RadarRings />
          <RadarSweep />
          <BlinkingDot />
        </div>

        {/* 타이틀 */}
        <div style={{ fontSize: 14, letterSpacing: 4, color: '#7fcfff', opacity: 0.85 }}>
          KOREA AIR SURVEILLANCE
        </div>

        {/* 단계 인디케이터 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 13, color: '#5fc6ff', minHeight: 18 }}>
            {STAGES[stageIdx]?.label ?? '로딩 중'}
            <span style={{ marginLeft: 6, opacity: 0.6 }}>{dots(elapsed)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STAGES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 24,
                  height: 2,
                  background: i <= stageIdx ? '#39ddff' : 'rgba(120,180,220,0.18)',
                  transition: 'background 0.4s',
                  boxShadow: i === stageIdx ? '0 0 8px rgba(57,221,255,0.7)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* 카운터 (있을 때) */}
        {aircraftCount > 0 && (
          <div style={{ fontSize: 12, color: '#39ddff', letterSpacing: 1.5, opacity: 0.9 }}>
            {aircraftCount} 대 수신
          </div>
        )}

        {/* 15초 타임아웃 메시지 */}
        {timedOut && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#ff6b6b', textAlign: 'center' }}>
              데이터 수신 지연 — 네트워크를 확인하세요
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* CSS keyframes inline */}
        <style>{KEYFRAMES}</style>
      </div>
    </div>
  );
}

function RadarRings() {
  return (
    <>
      {[1, 0.66, 0.33].map((scale) => (
        <div
          key={scale}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 140 * scale,
            height: 140 * scale,
            border: '1px solid rgba(57,221,255,0.25)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </>
  );
}

function RadarSweep() {
  return (
    <div
      className="radar-sweep"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background:
          'conic-gradient(from 0deg, rgba(57,221,255,0) 0deg, rgba(57,221,255,0) 320deg, rgba(57,221,255,0.55) 358deg, rgba(57,221,255,0) 360deg)',
        animation: 'radarSweep 2.8s linear infinite',
      }}
    />
  );
}

function BlinkingDot() {
  return (
    <div
      className="pulse-dot"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 6,
        height: 6,
        background: '#39ddff',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 12px rgba(57,221,255,0.8)',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

function dots(ms: number): string {
  const n = Math.floor(ms / 500) % 4;
  return '.'.repeat(n);
}

const KEYFRAMES = `
@keyframes radarSweep {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.4; transform: translate(-50%, -50%) scale(1.4); }
}
@media (prefers-reduced-motion: reduce) {
  .radar-sweep, .pulse-dot {
    animation: none !important;
  }
}
`;
