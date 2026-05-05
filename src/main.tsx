/**
 * Application Entry Point
 * Production observability: Vercel Speed Insights + Analytics + web-vitals
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';
import App from './App';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { logger } from './utils/logger';
import './index.css';

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

// React render 자체가 throw 하면 #root 가 멈춰서 검은 화면. 모바일에서 원인 파악
// 불가하므로 가시 fallback 으로 변환 + window.__BOOT_ERROR__ 에 evidence 보관.
try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
      {/* Vercel observability — 프로덕션에서만 데이터 전송, dev에서는 no-op */}
      <SpeedInsights />
      <Analytics />
    </React.StrictMode>
  );
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
