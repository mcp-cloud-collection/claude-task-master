/**
 * Global teardown for E2E tests
 * Runs once after all test suites
 */

module.exports = async () => {
	console.log('\n🧹 Cleaning up E2E test environment...\n');
	
	// Any global cleanup needed
	// Note: Individual test directories are cleaned up in afterEach hooks
};