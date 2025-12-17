module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
        diagnostics: false,
      },
    ],
  },
  testMatch: [
    '**/__tests__/**/*.integration.test.ts',
    '**/?(*.)+(integration).test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/integration-setup.ts'],
  testTimeout: 60000,
  maxWorkers: 2,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  resetModules: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/migrations/**',
    '!src/scripts/**',
    '!src/types/**'
  ]
};
