import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/target/**',
      '**/*.d.ts',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Browser surfaces: Next.js pages and the extension bundle.
    files: ['web/**/*.{ts,tsx}', 'ext/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // MV3 service worker and content scripts talk to the chrome.* namespace.
    files: ['ext/src/**/*.ts'],
    languageOptions: {
      globals: { chrome: 'readonly' },
    },
  },
);
