import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  // SamsungBrowser 29 진단 결과: vite-plugin-legacy 의 detection script
  // (type=module) + dual-loading flow 가 SamsungBrowser 에서 깨짐.
  // polyfills-legacy 까지 다운로드 되지만 legacy entry 미다운로드.
  // → legacy plugin 완전 제거하고 단일 module bundle + 보수적 syntax target
  //   ('es2015') 으로 SamsungBrowser native module loader 사용.
  esbuild: {
    target: 'es2015',
  },
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
    // Build target — es2015 로 낮춤 (이전 es2018 도 SamsungBrowser 29 에서
    // 평가 fail 진단). es2015 = Chrome 51+, SamsungBrowser 5+, iOS 10+. 모든
    // 모바일 안전.
    target: 'es2015',
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
