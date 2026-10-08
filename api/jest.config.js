/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/__tests__/**'],
  coverageDirectory: 'coverage',
  setupFiles: ['<rootDir>/src/__tests__/testEnv.ts'],
  testTimeout: 20000
};
