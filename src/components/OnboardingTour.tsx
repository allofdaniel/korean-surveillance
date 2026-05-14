/**
 * OnboardingTour — 첫 방문자 안내 튜토리얼
 *
 * 모두의 창업 심사 + 일반 신규 사용자를 위한 step-by-step 안내.
 * 다음/이전 버튼으로 10단계 진행:
 *   1~4) 시스템 소개 (Q1~Q3 — 배경/문제/솔루션)
 *   5~9) 화면 + 기능 가이드 (햄버거/라벨/NOTAM/줌)
 *   10)  마무리 + "다시 보지 않기" 체크박스
 *
 * localStorage key 'tour_dismissed_v1' 로 한 번 본 사용자 다시 표시 안 함.
 * 외부에서 window.__reopenTour() 호출 시 다시 열림 (햄버거 메뉴 → 튜토리얼 보기).
 */
import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'tour_dismissed_v1';

interface Step {
  title: string;
  body: React.ReactNode;
  /** 강조할 화면 영역 selector — outline + dim 처리 */
  target?: string;
  /** 카드 위치 — 'center' 또는 화면 모서리 */
  cardPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const STEPS: Step[] = [
  {
    title: '대한감시 — Korean Surveillance',
    cardPosition: 'center',
    body: (
      <>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
          <strong style={{ color: '#39ddff' }}>누구나 스마트폰으로 저고도 공역을 확인하는 AI 기반 MLAT 시스템</strong>의 프로토타입입니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff' }}>
          모두의 창업 심사관님 — 다음 버튼을 눌러 시스템 배경과 화면 기능을 한 단계씩 확인하실 수 있습니다.
          <br />
          (오른쪽 위 ×를 누르거나 "건너뛰기"로 언제든 종료 가능합니다.)
        </p>
      </>
    ),
  },
  {
    title: '문제 — 보이지 않는 저고도 공역',
    cardPosition: 'center',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          한강 공원에서 드론을 띄우려는 순간, 주변 공역이 보이지 않아 망설이게 됩니다.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          저고도에서는 <strong style={{ color: '#ffcc66' }}>헬기와 소형 항공기가 건물·지형에 가려 늦게 발견</strong>되는 경우가 많고,
          기존 MLAT (다변측정감시) 시스템은 설치·보정·비용 장벽으로 공항 주변에만 제한적으로 구축되어 있습니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff' }}>
          결과적으로 대부분의 현장은 <em>"보이지 않는 공역"</em> 상태에서 운용되고 있으며, 이는 안전과 직결되는 문제입니다.
        </p>
      </>
    ),
  },
  {
    title: '누구의 문제를 해결하나?',
    cardPosition: 'center',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          이 시스템은 다음의 문제를 해결합니다:
        </p>
        <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
          <li><strong style={{ color: '#39ddff' }}>드론 조종사</strong> — 비행 전 주변 공역 시각 확인</li>
          <li><strong style={{ color: '#39ddff' }}>드론 실증사업 운영기관</strong> — 안전 운영 관리</li>
          <li><strong style={{ color: '#39ddff' }}>지자체·항공 안전관리 담당자</strong> — 현장 모니터링</li>
          <li><strong style={{ color: '#39ddff' }}>일반 시민</strong> — 우리 동네 위 헬기·항공기 확인</li>
        </ul>
      </>
    ),
  },
  {
    title: '솔루션 — AI + LLM 으로 단순화한 MLAT',
    cardPosition: 'center',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          다수의 간단한 안테나 노드가 항공 신호를 수신하고,
          위치 계산·오차 보정은 <strong style={{ color: '#39ddff' }}>서버에서 AI / LLM 기반 알고리즘으로 자동 수행</strong>합니다.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          기존 MLAT 의 핵심 장벽이었던 <strong style={{ color: '#ffcc66' }}>설치·보정·운영 복잡도</strong>를 크게 낮추고,
          사용자는 스마트폰·노트북으로 <strong>주변 항공기 위치와 공역 상황을 실시간 확인</strong>할 수 있습니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff' }}>
          → 일부 지역의 고비용 인프라 → <strong>전국 어디서나 사용 가능한 실용 인프라</strong>
        </p>
      </>
    ),
  },
  {
    title: '화면 — 한반도 실시간 항공감시',
    cardPosition: 'bottom-left',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          이 화면이 시스템 메인입니다. <strong style={{ color: '#39ddff' }}>한반도 전체의 실시간 ADS-B 항공기</strong>를 표시합니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff' }}>
          • 항공기는 1초마다 갱신되며, 칼만 필터로 부드럽게 보간 됩니다.
          <br />
          • 상단 헤더의 <code style={{ background: 'rgba(0,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>ADS-B</code> 카운트가 실시간 추적 중인 항공기 수입니다.
        </p>
      </>
    ),
  },
  {
    title: '햄버거 메뉴 — 좌측 패널',
    target: '.mobile-menu-toggle',
    cardPosition: 'top-right',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          화면 왼쪽 위 <strong style={{ color: '#39ddff' }}>☰</strong> 버튼을 누르면 좌측 컨트롤 패널이 열립니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff' }}>
          5개 대분류로 정리되어 있습니다:
        </p>
        <ul style={{ fontSize: 12.5, lineHeight: 1.8, paddingLeft: 18, margin: '6px 0 0' }}>
          <li><span style={{ color: '#5fc6ff' }}>● 지도 표시</span> — 공항/항법시설/공역/항로</li>
          <li><span style={{ color: '#39ddff' }}>● 항공기 설정</span> — 항적/예측선/라벨</li>
          <li><span style={{ color: '#ffa040' }}>● 공항별</span> — SID/STAR/접근절차</li>
          <li><span style={{ color: '#b690ff' }}>● 표시 설정</span> — 3D/지형/고도범례</li>
          <li><span style={{ color: '#79e3ff' }}>● 보기 & 오버레이</span> — 위성/CCTV/AIS/필터</li>
        </ul>
      </>
    ),
  },
  {
    title: '항공기 라벨 — 콜사인·고도·속도',
    cardPosition: 'top-right',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          지도 위 각 항공기 옆에 라벨이 표시됩니다:
        </p>
        <div style={{
          background: 'rgba(0,255,255,0.08)',
          border: '1px solid rgba(0,255,255,0.3)',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#fff',
          lineHeight: 1.5,
          marginBottom: 10,
        }}>
          KAL873<br />
          27575ft 432.1kt ↓<br />
          7250
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: '#a8e3ff' }}>
          위에서부터 <strong>콜사인 / 고도(ft) · 지속(kt) · 상승하강 화살표 / 스쿼크 코드</strong>.
          <br />
          항공기를 클릭하면 우측에 상세 패널이 열립니다 (항적 그래프, 노선 정보 등).
        </p>
      </>
    ),
  },
  {
    title: 'NOTAM — 공역 공지사항',
    target: '.view-controls',
    cardPosition: 'bottom-right',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          화면 우측 위의 <strong style={{ color: '#39ddff' }}>NOTAM</strong> 버튼은 항공 안전 공지사항 (Notice to Airmen)을 표시합니다.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff' }}>
          • 공역 제한, 비행 제한 구역, 행사 등의 임시 정보가 지도 위 다각형으로 그려집니다.
          <br />
          • 색상: <span style={{ color: '#ff8800' }}>주황 = 활성</span>,
          {' '}<span style={{ color: '#5fc6ff' }}>파랑 = 예정</span>,
          {' '}<span style={{ color: '#888' }}>회색 = 만료</span>
        </p>
      </>
    ),
  },
  {
    title: '지도 인터랙션',
    cardPosition: 'center',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          지도 조작 방법:
        </p>
        <ul style={{ fontSize: 13, lineHeight: 1.9, paddingLeft: 18, margin: 0, color: '#a8e3ff' }}>
          <li><strong style={{ color: '#fff' }}>마우스 휠 / 핀치</strong> — 줌</li>
          <li><strong style={{ color: '#fff' }}>드래그</strong> — 팬</li>
          <li><strong style={{ color: '#fff' }}>항공기 클릭</strong> — 상세 정보</li>
          <li><strong style={{ color: '#fff' }}>우클릭</strong> — 좌표/거리 측정</li>
          <li><strong style={{ color: '#fff' }}>햄버거 → 보기 & 오버레이 → 3D 보기</strong> — 입체 모드</li>
        </ul>
      </>
    ),
  },
  {
    title: '준비 완료',
    cardPosition: 'center',
    body: (
      <>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
          안내는 여기까지입니다. 자유롭게 시스템을 살펴봐 주세요.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8e3ff', marginBottom: 10 }}>
          나중에 다시 보고 싶으시면 <strong>왼쪽 햄버거 메뉴 → "튜토리얼 보기"</strong> 를 눌러주세요.
        </p>
        <p style={{ fontSize: 12, color: '#7fcfff', opacity: 0.8 }}>
          ※ 본 시스템은 모두의 창업을 통해 HW 연동될 SW 의 프로토타입이며,
          현재는 공개 ADS-B 신호 (airplanes.live / OpenSky Network) 를 사용합니다.
        </p>
      </>
    ),
  },
];

function getCardPositionStyle(pos: Step['cardPosition']): React.CSSProperties {
  const base: React.CSSProperties = { position: 'fixed', zIndex: 10001 };
  switch (pos) {
    case 'top-left':     return { ...base, top: 16,    left: 16 };
    case 'top-right':    return { ...base, top: 16,    right: 16 };
    case 'bottom-left':  return { ...base, bottom: 16, left: 16 };
    case 'bottom-right': return { ...base, bottom: 16, right: 16 };
    case 'center':
    default:
      return {
        ...base,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
  }
}

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // 첫 mount 시 localStorage 체크
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'yes') {
        // 약간 지연 — 페이지 첫 mount + LoadingOverlay dismiss 후
        const t = setTimeout(() => setOpen(true), 2000);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage 차단 시 그냥 표시
      setOpen(true);
    }
    return undefined;
  }, []);

  // 외부에서 다시 열기 (햄버거 → 튜토리얼 보기)
  useEffect(() => {
    const w = window as unknown as { __reopenTour?: () => void };
    w.__reopenTour = () => {
      setStep(0);
      setOpen(true);
    };
    return () => { delete w.__reopenTour; };
  }, []);

  // 현재 스텝의 target rect 추적
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s?.target) {
      setTargetRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(s.target!);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    const interval = setInterval(update, 500); // target 이 react re-render 되면 위치 변경 가능
    return () => {
      window.removeEventListener('resize', update);
      clearInterval(interval);
    };
  }, [open, step]);

  // ESC 로 종료
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) return null;

  const s = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const close = () => {
    if (dontShow || isLast) {
      try { localStorage.setItem(STORAGE_KEY, 'yes'); } catch { /* ignore */ }
    }
    setOpen(false);
  };

  const cardStyle: React.CSSProperties = {
    ...getCardPositionStyle(s.cardPosition),
    width: 'min(440px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, rgba(8,18,32,0.98) 0%, rgba(4,10,20,0.98) 100%)',
    border: '1px solid rgba(120,200,255,0.4)',
    borderRadius: 12,
    boxShadow: '0 8px 40px rgba(0,180,255,0.15), 0 0 0 1px rgba(0,180,255,0.1)',
    color: '#e8f6ff',
    fontFamily: '"Inter","Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif',
    padding: '22px 24px',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
        }}
        aria-hidden="true"
      />

      {/* Target highlight (스폿라이트 효과 — 사각형 outline) */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            zIndex: 10000,
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            border: '2px solid #39ddff',
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65), 0 0 24px rgba(57,221,255,0.6)',
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}
          aria-hidden="true"
        />
      )}

      {/* Card */}
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" style={cardStyle}>
        {/* Close button */}
        <button
          onClick={close}
          aria-label="튜토리얼 닫기"
          style={{
            position: 'absolute',
            top: 10, right: 12,
            background: 'transparent',
            border: 'none',
            color: '#a8e3ff',
            fontSize: 22,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
          }}
        >×</button>

        {/* Step indicator dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 22 : 8,
                height: 4,
                borderRadius: 2,
                background: i <= step ? '#39ddff' : 'rgba(120,180,220,0.25)',
                transition: 'all 0.3s',
                boxShadow: i === step ? '0 0 6px rgba(57,221,255,0.7)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h2
          id="tour-title"
          style={{
            margin: '0 0 14px',
            fontSize: 18,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: 0.3,
          }}
        >
          {s.title}
        </h2>

        {/* Body */}
        <div style={{ color: '#dfeefd' }}>{s.body}</div>

        {/* Footer — controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 22,
          gap: 12,
          flexWrap: 'wrap',
        }}>
          {/* Left — 단계 카운트 + dontShow (마지막에만) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#7fcfff' }}>
            <span>{step + 1} / {STEPS.length}</span>
            {isLast && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                  style={{ accentColor: '#39ddff' }}
                />
                <span>다시 보지 않기</span>
              </label>
            )}
          </div>

          {/* Right — navigation buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isLast && (
              <button
                onClick={close}
                style={{
                  padding: '7px 14px',
                  fontSize: 13,
                  background: 'transparent',
                  border: '1px solid rgba(120,180,220,0.35)',
                  borderRadius: 6,
                  color: '#a8e3ff',
                  cursor: 'pointer',
                }}
              >건너뛰기</button>
            )}
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  padding: '7px 14px',
                  fontSize: 13,
                  background: 'rgba(120,180,220,0.12)',
                  border: '1px solid rgba(120,180,220,0.35)',
                  borderRadius: 6,
                  color: '#dfeefd',
                  cursor: 'pointer',
                }}
              >이전</button>
            )}
            <button
              onClick={() => isLast ? close() : setStep(step + 1)}
              style={{
                padding: '7px 18px',
                fontSize: 13,
                fontWeight: 600,
                background: 'linear-gradient(180deg, #39ddff 0%, #18a8d8 100%)',
                border: '1px solid #39ddff',
                borderRadius: 6,
                color: '#001a26',
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(57,221,255,0.4)',
              }}
            >
              {isLast ? '마무리' : '다음 →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
