// ESLint flat config — TASK-004.
// rules-of-hooks is an ERROR gate (audit F06 class); exhaustive-deps is warn-level
// for the legacy prototype and will be tightened once components are refactored.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      'audio-cache/**',
      'dubbed-videos/**',
      'public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Plain Node-side JS helpers (legacy) — declare Node globals without a new dependency.
    files: ['src/serverAudioCache.js', 'pre-cache.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    rules: {
      // Legacy-prototype tolerance: keep lint signal honest without forcing
      // an unrelated rewrite in the tooling slice.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
