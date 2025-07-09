/**
 * Jest configuration for E2E tests
 * Separate from unit tests to allow different settings
 */

export default {
	displayName: 'E2E Tests',
	testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
	testPathIgnorePatterns: [
		'/node_modules/',
		'/tests/e2e/utils/',
		'/tests/e2e/config/',
		'/tests/e2e/runners/',
		'/tests/e2e/e2e_helpers.sh',
		'/tests/e2e/test_llm_analysis.sh',
		'/tests/e2e/run_e2e.sh',
		'/tests/e2e/run_fallback_verification.sh'
	],
	testEnvironment: 'node',
	testTimeout: 180000, // 3 minutes default (AI operations can be slow)
	maxWorkers: 1, // Run E2E tests sequentially to avoid conflicts
	verbose: true,
	setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup/jest-setup.js'],
	globalSetup: '<rootDir>/tests/e2e/setup/global-setup.js',
	globalTeardown: '<rootDir>/tests/e2e/setup/global-teardown.js',
	collectCoverageFrom: [
		'src/**/*.js',
		'!src/**/*.test.js',
		'!src/**/__tests__/**'
	],
	coverageDirectory: '<rootDir>/coverage-e2e',
	// Custom reporters for better E2E test output
	reporters: ['default'],
	// Environment variables for E2E tests
	testEnvironmentOptions: {
		env: {
			NODE_ENV: 'test',
			E2E_TEST: 'true'
		}
	}
};
