import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/**
 * ESLint flat config (ESLint v9+)
 *
 * Shared package: types + small utilities.
 */

const tsconfigRootDir = new URL('.', import.meta.url).pathname;

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      '**/*.d.ts',
      '**/*.js.map',
    ],
  },
  js.configs.recommended,
  // TypeScript (typed)
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Base JS rules don't understand TS declarations well.
      'no-undef': 'off',
      'no-unused-vars': 'off',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': 'off',
    },
  },

  // Shared type exports: allow exported enums/interfaces without local usage.
  {
    files: ['src/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
