/**
 * Application Entry Point
 * Production observability: Vercel Speed Insights + Analytics + web-vitals
 */

import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { logger } from './utils/logger';
import './index.css';

// Boot stage marker — index.html watchdog 이 어디까지 도달했는지 진단 패널에 노출.
// 'main-tsx-evaluated' 까지 도달했으면 ES module 로드는 됐다는 뜻 → React 단계 의심.
declare global {
  interface Window {
    __setBootStage__?: (name: string) => void;
    __BOOT_ERROR__?: string;
  }
}
window.__setBootStage__?.('main-tsx-evaluated');

// App 은 mapbox-gl (1.7 MB), three (482 KB) 등 무거운 의존성을 동기 import 한다.
// 보급형 모바일에서 number 가 너무 커서 React mount 자체가 8초+ 걸렸음
// (Samsung Internet/Android 10 384x585 진단 결과: error 없이 단순 시간 초과).
// lazy 로 별도 chunk 분리 → React 는 즉시 mount, App chunk 가 백그라운드 로드되며
// Suspense fallback 으로 진행 상태가 즉시 가시화된다.
const App = lazy(() => import('./App'));

// Vercel observability 도 main 번들에서 분리 — first-paint 까지 필요 없음.
const VercelObservability = lazy(() =>
  Promise.all([
    import('@vercel/speed-insights/react'),
    import('@vercel/analytics/react'),
  ]).then(([si, an]) => ({
    default: () => (
      <>
        <si.SpeedInsights />
        <an.Analytics />
      </>
    ),
  })),
);

const isProduction = import.meta.env.PROD;

// Web Vitals 보고 — DEV 콘솔 + production logger
const reportVital = (metric: { name: string; value: number; id: string }) => {
  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.debug(`[WebVital] ${metric.name}=${metric.value.toFixed(0)} (${metric.id})`);
  }
  logger.info('WebVital', `${metric.name}=${metric.value.toFixed(0)}`, { id: metric.id, value: metric.value });
};
onLCP(reportVital);
onINP(reportVital);
onCLS(reportVital);
onFCP(reportVital);
onTTFB(reportVital);

// 글로벌 에러 핸들러 — 어떤 환경에서도 logger 로 흘림
window.addEventListener('error', (e) => {
  logger.error('Global', `Unhandled error: ${e.message}`, e.error instanceof Error ? e.error : undefined);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
  logger.error('Global', 'Unhandled promise rejection', reason);
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Suspense fallback — App chunk 가 로드되는 동안 보일 화면.
// index.html 의 boot screen 과 동일한 시각 언어 (검은 화면 방지).
const SuspenseLoader = (): React.ReactElement => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      color: '#7fcfff',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      padding: 20,
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, letterSpacing: '.05em' }}>
      대한감시
    </div>
    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 24 }}>저고도 항공감시 시스템</div>
    <div
      style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(127,207,255,.2)',
        borderTopColor: '#7fcfff',
        borderRadius: '50%',
        animation: 'bootSpin 1s linear infinite',
      }}
    />
    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 16 }}>지도 엔진 로딩 중...</div>
  </div>
);

// React render 자체가 throw 하면 #root 가 멈춰서 검은 화면. 모바일에서 원인 파악
// 불가하므로 가시 fallback 으로 변환 + window.__BOOT_ERROR__ 에 evidence 보관.
try {
  window.__setBootStage__?.('react-render-start');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <Suspense fallback={<SuspenseLoader />}>
            <App />
          </Suspense>
        </ToastProvider>
      </ErrorBoundary>
      {/* Vercel observability — 프로덕션에서만 데이터 전송, lazy 로 분리해 first-paint 차단 안되게 */}
      <Suspense fallback={null}>
        <VercelObservability />
      </Suspense>
    </React.StrictMode>
  );
  window.__setBootStage__?.('react-render-called');
} catch (renderErr) {
  // boot watchdog 이 evidence 로 사용
  const w = window as unknown as { __BOOT_ERROR__?: string };
  if (!w.__BOOT_ERROR__) {
    w.__BOOT_ERROR__ =
      'render: ' + (renderErr instanceof Error ? renderErr.message : String(renderErr));
  }
  logger.error('Bootstrap', 'Initial render failed', renderErr instanceof Error ? renderErr : new Error(String(renderErr)));
  // 사용자가 보는 화면 — boot-screen watchdog 이 8초 후 진단 패널로 전환하지만,
  // 즉시 가시화하기 위해 여기서도 빠르게 대체.
  rootElement.innerHTML =
    '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#ff6b6b;font-family:sans-serif;padding:20px;text-align:center;font-size:13px;">' +
    '앱 초기화 실패: ' + (renderErr instanceof Error ? renderErr.message : String(renderErr)) +
    '<br><br><button onclick="window.location.replace(\'/?reset=\'+Date.now())" style="margin-top:12px;padding:10px 16px;background:#7fcfff;color:#0e1117;border:none;border-radius:4px;font-weight:600;cursor:pointer;">캐시 초기화 후 재시도</button>' +
    '</div>';
}
