/* eslint-disable */
export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\.mjs$|@twurple|@d-fischer|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)'] ,
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  moduleNameMapper: {
    '^@broadboi/core(|/.*)$': '<rootDir>/../../libs/core/src/$1',
    '^@twurple/(.*)$': '<rootDir>/src/testing/mocks/twurple.mock.ts',
  },
};