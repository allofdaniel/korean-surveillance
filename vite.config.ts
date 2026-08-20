import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
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
          return `/v2/point/${lat}/${lon}/${radius}`;\n        },\n      },\n      '/api/weather': {\n        target: 'https://aviationweather.gov',\n        changeOrigin: true,\n        rewrite: (path) => {\n          const params = new URLSearchParams(path.split('?')[1] || '');\n          const type = params.get('type') || 'metar';\n          if (type === 'metar') {\n            return `/api/data/metar?ids=RKPU&format=json`;\n          } else if (type === 'taf') {\n            return `/api/data/taf?ids=RKPU,RKPK&format=json`;\n          }\n          return `/api/data/metar?ids=RKPU&format=json`;\n        },\n      },\n      '/api/charts': {\n        target: 'http://localhost:8080',\n        changeOrigin: true,\n      },\n    },\n  },\n  build: {\n    sourcemap: false,\n    target: 'es2018',\n    chunkSizeWarningLimit: 1800,\n    rollupOptions: {\n      output: {\n        manualChunks: (id) => {\n          // React 및 React 의존 UI 라이브러리를 단일 청크로 묶어 createContext 초기화 오류 방지\n          if (\n            id.includes('node_modules/react') ||\n            id.includes('node_modules/react-dom') ||\n            id.includes('node_modules/lucide-react') ||\n            id.includes('node_modules/zustand') ||\n            id.includes('node_modules/scheduler')\n          ) {\n            return 'vendor-react';\n          }\n          // Mapbox GL 분리\n          if (id.includes('node_modules/mapbox-gl')) {\n            return 'vendor-mapbox';\n          }\n          // Three.js 분리\n          if (id.includes('node_modules/three')) {\n            return 'vendor-three';\n          }\n        },\n      },\n    },\n  },\n});\n