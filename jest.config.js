module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'main.js',
    'preload.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov']
};
