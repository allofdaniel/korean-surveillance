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
