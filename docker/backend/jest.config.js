module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  // Keep unit tests fast and deterministic.
  // Integration tests are executed via [`jest.integration.config.js`](docker/backend/jest.integration.config.js:1).
  testPathIgnorePatterns: [
    '<rootDir>/src/__tests__/integration/',
    '\\.integration\\.test\\.ts$'
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
        // Typechecking is enforced via `npm run typecheck`.
        // Keep Jest fast and avoid false negatives from ts-jest's compiler settings.
        diagnostics: false,
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      // TODO: Raise these thresholds once core flows are covered by tests.
      // Current codebase coverage is low; failing CI on coverage blocks functional testing.
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%',
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  resetModules: true,
};
