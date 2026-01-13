import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/**
 * ESLint flat config (ESLint v9+)
 *
 * This repo uses TypeScript and ESM ("type": "module").
 * Keep this config intentionally minimal and production-safe.
 */

const tsconfigRootDir = new URL('.', import.meta.url).pathname;

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.js.map',
      'src/__tests__/**/*.test.ts', // Exclude test files from linting
    ],
  },

  // Base JS recommendations
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
      // Base JS rules don't understand TS declarations/globals well.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Keep noise low, but still enforce correctness.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': 'off', // server logs via LoggerService
    },
  },

  // Type-only modules and exported enums/constants.
  {
    files: ['src/types/**/*.ts', 'src/utils/error-handler.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
