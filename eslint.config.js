import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.eslintrc.cjs',
      '.vercel/**',
      'build/**',
      'coverage/**',
      'android/**',
      '*.config.js',
      '*.config.ts',
      // External crawler tooling — separate codebase, has its own bundled n8n .cjs
      'ubikais-crawler/**',
      'eaip-crawler/**',
      'navigraph-analysis/**',
      'tbas/**',
      'OSINTMappingSite/**',
      'SpaceTracking/**',
      // Standalone scripts and Deno edge functions (not part of main app)
      '**/*.cjs',
      'supabase/functions/**',
      'docs/*.{cjs,js}',
      'scripts/**',
      // Generated/minified files
      '**/*.min.js',
      '**/dist/**',
      // Public static assets (data files etc.)
      'public/**',
    ],
  },

  // Base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React configuration
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        ReadableStream: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        IdleRequestCallback: 'readonly',
        IdleDeadline: 'readonly',
        // Node globals (Vercel functions, build tools)
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        NodeJS: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        queueMicrotask: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // Custom rules
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'useAircraftContext',
            'useMapContext',
            'useWeatherContext',
            'showToast',
            'useToast',
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/prop-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks: '(useIsomorphicLayoutEffect|useLayoutEffect)',
        },
      ],
    },
  },

  // Prettier config (should be last to override formatting rules)
  prettierConfig
)
