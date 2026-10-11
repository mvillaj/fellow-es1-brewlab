// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      'playwright-report/',
      'test-results/',
      '.claude/',
      '.github/skills/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Node: the API, the shared package, scripts and the Playwright suite.
    files: ['server/**', 'packages/**', 'scripts/**', 'e2e/**', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    // The two classic hooks rules. The plugin's recommended set now also carries
    // the React Compiler rules, which this app does not use yet.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // SQLite rows come back untyped, and the routes and seed read them as any.
    // Typing the row layer is its own change; until then the rule stays off here.
    files: ['server/src/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    rules: {
      // A leading underscore marks a parameter that has to exist for its position.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  // Last, so formatting is Prettier's job alone.
  prettier,
);
