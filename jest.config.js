module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/client/', '/tests/'],
  collectCoverageFrom: ['src/**/*.js'],
  testTimeout: 10000,
};
