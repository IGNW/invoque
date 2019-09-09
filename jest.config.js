module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  // silent: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '(/tests/.*|(\\.|/)(test))\\.(ts)$',
  moduleFileExtensions: ['js', 'ts', 'json'],
  testPathIgnorePatterns: ['node_modules', 'dist', 'task', 'types'],
  collectCoverage: true,
};
