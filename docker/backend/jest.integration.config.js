module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.integration.test.ts',
    '**/?(*.)+(integration).test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/integration-setup.ts'],
  testTimeout: 60000,
  maxWorkers: 2,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/migrations/**',
    '!src/scripts/**',
    '!src/types/**'
  ]
};