/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    }],
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/',
    '/dst/',
  ],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/types/**",
    "!**/node_modules/**"
  ],
  coverageReporters: ["text", "lcov", "clover"],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
