import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    // Legacy bundle — SamsungBrowser 29 / Android 10 같은 보급형 모바일이
    // 최신 ES module 평가에 silent fail 하는 사례 진단됨. 이 플러그인이
    // ES2015 호환 nomodule fallback bundle 을 emit, <script nomodule> 로
    // 자동 주입하여 최신 ES 못 다루는 환경을 자동 커버.
    legacy({
      targets: ['defaults', 'not IE 11', 'Samsung >= 9', 'Android >= 7'],
      modernPolyfills: true,
      renderLegacyChunks: true,
      // SamsungBrowser 29 진단 결과: modern + legacy dual-loading flow 가
      // 어디선가 깨짐 (polyfills-legacy 까지 download 후 legacy entry
      // 미다운로드). renderModernChunks=false 로 modern bundle 자체를 emit
      // 안 하고 모든 사용자가 단일 legacy bundle (SystemJS + polyfills +
      // ES2015 transpile) 사용 → dual-loading 흐름 자체 제거.
      renderModernChunks: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/aircraft-trace': {
        target: 'https://api.airplanes.live',
        changeOrigin: true,
        rewrite: (path) => {
          const hex = new URLSearchParams(path.split('?')[1]).get('hex');
          return `/v2/hex/${hex}`;
        },
      },
      '/api/aircraft': {
        target: 'https://api.airplanes.live',
        changeOrigin: true,
        rewrite: (path) => {
          const params = new URLSearchParams(path.split('?')[1]);
          const lat = params.get('lat');
          const lon = params.get('lon');
          const radius = params.get('radius') || '100';
          return `/v2/point/${lat}/${lon}/${radius}`;
        },
      },
      // Weather API - disabled for local dev (requires KMA API key)
      // Production uses Vercel serverless function with API keys
      '/api/weather': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (path) => {
          const params = new URLSearchParams(path.split('?')[1] || '');
          const type = params.get('type') || 'metar';
          if (type === 'metar') {
            return `/api/data/metar?ids=RKPU&format=json`;
          } else if (type === 'taf') {
            return `/api/data/taf?ids=RKPU,RKPK&format=json`;
          }
          return `/api/data/metar?ids=RKPU&format=json`;
        },
      },
      '/api/charts': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 프로덕션 빌드는 sourcemap 비공개 — 보안 감사 A-2 권고
    // (sourcemap 가 공개되면 전체 TypeScript 소스 + 비즈니스 로직 노출)
    // 개발 환경에서는 항상 sourcemap 활성 (dev server 자동)
    sourcemap: false,
    // 큰 의존성 (Mapbox GL ~465KB gzip, Three.js ~122KB gzip) 청크 크기 경고 상향
    chunkSizeWarningLimit: 1800,
    // Build target — 보수적으로 es2018 까지만 emit. SamsungBrowser 29
    // (Android 10) 같은 보급형 모바일이 최신 syntax 일부 (private class fields,
    // top-level await, Promise.withResolvers 등) 평가 단계에서 silent throw 하는
    // 사례 진단됨. 진단 결과: error 캡처 안 되고 main-tsx-evaluated 마커 hit 안 됨
    // → vendor chunk 평가 단계 실패 강력 의심. es2018 = Chrome 64+, SamsungBrowser
    // 9+, iOS 12+ 모두 안전.
    target: 'es2018',
    rollupOptions: {
      output: {
        // 청크 분리 최적화
        manualChunks: (id) => {
          // React 코어 분리
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Mapbox GL 분리 (가장 큰 청크, ~465KB gzip)
          if (id.includes('node_modules/mapbox-gl')) {
            return 'vendor-mapbox';
          }
          // Three.js 3D 렌더링 분리
          if (id.includes('node_modules/three')) {
            return 'vendor-three';
          }
          // 나머지 node_modules는 vendor 청크로
          if (id.includes('node_modules')) {
            return 'vendor-common';
          }
        },
      },
    },
  },
});
