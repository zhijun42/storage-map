module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@tarojs/taro$': '<rootDir>/src/__tests__/__mocks__/taro.ts',
    '^@tarojs/components$': '<rootDir>/src/__tests__/__mocks__/components.ts',
    '\\.scss$': '<rootDir>/src/__tests__/__mocks__/style.ts',
    '^\\.\\./cloud$': '<rootDir>/src/__tests__/__mocks__/cloud.ts',
    '^\\.\\./services/cloud$': '<rootDir>/src/__tests__/__mocks__/cloud.ts',
    '^\\.\/cloud$': '<rootDir>/src/__tests__/__mocks__/cloud.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
}
