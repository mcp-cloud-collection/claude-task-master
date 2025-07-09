/**
 * Global setup for E2E tests
 * Runs once before all test suites
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

module.exports = async () => {
	console.log('\n🚀 Setting up E2E test environment...\n');
	
	try {
		// Ensure task-master is linked globally
		const projectRoot = join(__dirname, '../../..');
		console.log('📦 Linking task-master globally...');
		execSync('npm link', { 
			cwd: projectRoot,
			stdio: 'inherit'
		});
		
		// Verify .env file exists
		const envPath = join(projectRoot, '.env');
		if (!existsSync(envPath)) {
			console.warn('⚠️  Warning: .env file not found. Some tests may fail without API keys.');
		} else {
			console.log('✅ .env file found');
		}
		
		// Verify task-master command is available
		try {
			execSync('task-master --version', { stdio: 'pipe' });
			console.log('✅ task-master command is available\n');
		} catch (error) {
			throw new Error('task-master command not found. Please ensure npm link succeeded.');
		}
		
	} catch (error) {
		console.error('❌ Global setup failed:', error.message);
		throw error;
	}
};