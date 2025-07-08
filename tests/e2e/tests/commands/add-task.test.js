/**
 * Comprehensive E2E tests for add-task command
 * Tests all aspects of task creation including AI and manual modes
 */

export default async function testAddTask(logger, helpers, context) {
	const { testDir } = context;
	const results = {
		status: 'passed',
		errors: [],
		tests: []
	};

	async function runTest(name, testFn) {
		try {
			logger.info(`\nRunning: ${name}`);
			await testFn();
			results.tests.push({ name, status: 'passed' });
			logger.success(`✓ ${name}`);
		} catch (error) {
			results.tests.push({ name, status: 'failed', error: error.message });
			results.errors.push({ test: name, error: error.message });
			logger.error(`✗ ${name}: ${error.message}`);
		}
	}

	try {
		logger.info('Starting comprehensive add-task tests...');

		// Test 1: Basic AI task creation with --prompt
		await runTest('AI task creation with prompt', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Create a user authentication system with JWT tokens'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			if (!taskId) {
				throw new Error('Failed to extract task ID from output');
			}
			// Verify task was created with AI-generated content
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			if (!showResult.stdout.includes('authentication') && !showResult.stdout.includes('JWT')) {
				throw new Error('AI did not properly understand the prompt');
			}
		});

		// Test 2: Manual task creation with --title and --description
		await runTest('Manual task creation', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--title', 'Setup database connection',
					'--description', 'Configure PostgreSQL connection with connection pooling'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			if (!taskId) {
				throw new Error('Failed to extract task ID');
			}
			// Verify exact title and description
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			if (!showResult.stdout.includes('Setup database connection')) {
				throw new Error('Title not set correctly');
			}
			if (!showResult.stdout.includes('Configure PostgreSQL connection')) {
				throw new Error('Description not set correctly');
			}
		});

		// Test 3: Task creation with tags
		await runTest('Task creation with tags', async () => {
			// First create a tag
			await helpers.taskMaster(
				'add-tag',
				['backend', '--description', 'Backend tasks'],
				{ cwd: testDir }
			);
			
			// Create task with tag
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Create REST API endpoints', '--tag', 'backend'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			
			// Verify task is in tag
			const listResult = await helpers.taskMaster('list', ['--tag', 'backend'], { cwd: testDir });
			if (!listResult.stdout.includes(taskId)) {
				throw new Error('Task not found in specified tag');
			}
		});

		// Test 4: Task creation with priority
		await runTest('Task creation with priority', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Fix critical security vulnerability', '--priority', 'high'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			
			// Verify priority was set
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			if (!showResult.stdout.includes('high') && !showResult.stdout.includes('High')) {
				throw new Error('Priority not set correctly');
			}
		});

		// Test 5: Task creation with dependencies at creation time
		await runTest('Task creation with dependencies', async () => {
			// Create dependency task first
			const depResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Setup environment'],
				{ cwd: testDir }
			);
			const depTaskId = helpers.extractTaskId(depResult.stdout);
			
			// Create task with dependency
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Deploy application', '--depends-on', depTaskId],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			
			// Verify dependency was set
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			if (!showResult.stdout.includes(depTaskId)) {
				throw new Error('Dependency not set correctly');
			}
		});

		// Test 6: Task creation with custom metadata
		await runTest('Task creation with metadata', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt', 'Implement caching layer',
					'--metadata', 'team=backend',
					'--metadata', 'sprint=2024-Q1'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			
			// Verify metadata (check in tasks.json)
			const tasksPath = `${testDir}/.taskmaster/tasks/tasks.json`;
			const tasks = helpers.readJson(tasksPath);
			const task = tasks.tasks.find(t => t.id === taskId);
			if (!task || !task.metadata || task.metadata.team !== 'backend' || task.metadata.sprint !== '2024-Q1') {
				throw new Error('Metadata not set correctly');
			}
		});

		// Test 7: Error handling - empty prompt
		await runTest('Error handling - empty prompt', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', ''],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with empty prompt');
			}
		});

		// Test 8: Error handling - invalid priority
		await runTest('Error handling - invalid priority', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Test task', '--priority', 'invalid'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with invalid priority');
			}
		});

		// Test 9: Error handling - non-existent dependency
		await runTest('Error handling - non-existent dependency', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Test task', '--depends-on', '99999'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with non-existent dependency');
			}
		});

		// Test 10: Very long prompt handling
		await runTest('Very long prompt handling', async () => {
			const longPrompt = 'Create a comprehensive system that ' + 'handles many features '.repeat(50);
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', longPrompt],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			if (!taskId) {
				throw new Error('Failed to create task with long prompt');
			}
		});

		// Test 11: Special characters in prompt
		await runTest('Special characters in prompt', async () => {
			const specialPrompt = 'Implement feature: "User\'s data & settings" <with> special|chars!';
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', specialPrompt],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			if (!taskId) {
				throw new Error('Failed to create task with special characters');
			}
		});

		// Test 12: Multiple tasks in parallel
		await runTest('Multiple tasks in parallel', async () => {
			const promises = [];
			for (let i = 0; i < 3; i++) {
				promises.push(
					helpers.taskMaster(
						'add-task',
						['--prompt', `Parallel task ${i + 1}`],
						{ cwd: testDir }
					)
				);
			}
			const results = await Promise.all(promises);
			
			for (let i = 0; i < results.length; i++) {
				if (results[i].exitCode !== 0) {
					throw new Error(`Parallel task ${i + 1} failed`);
				}
				const taskId = helpers.extractTaskId(results[i].stdout);
				if (!taskId) {
					throw new Error(`Failed to extract task ID for parallel task ${i + 1}`);
				}
			}
		});

		// Test 13: AI fallback behavior (simulate by using invalid model)
		await runTest('AI fallback behavior', async () => {
			// Set an invalid model to trigger fallback
			await helpers.taskMaster(
				'models',
				['--set-main', 'invalid-model-xyz'],
				{ cwd: testDir }
			);
			
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Test fallback behavior'],
				{ cwd: testDir, allowFailure: true }
			);
			
			// Should either use fallback model or create task without AI
			// The exact behavior depends on implementation
			if (result.exitCode === 0) {
				const taskId = helpers.extractTaskId(result.stdout);
				if (!taskId) {
					throw new Error('Fallback did not create a task');
				}
			}
			
			// Reset to valid model
			await helpers.taskMaster(
				'models',
				['--set-main', 'gpt-3.5-turbo'],
				{ cwd: testDir }
			);
		});

		// Test 14: AI quality check - verify reasonable output
		await runTest('AI quality - reasonable title and description', async () => {
			const result = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Build a responsive navigation menu with dropdown support'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			const output = showResult.stdout.toLowerCase();
			
			// Check for relevant keywords that indicate AI understood the prompt
			const relevantKeywords = ['navigation', 'menu', 'dropdown', 'responsive'];
			const foundKeywords = relevantKeywords.filter(keyword => output.includes(keyword));
			
			if (foundKeywords.length < 2) {
				throw new Error('AI output does not seem to understand the prompt properly');
			}
		});

		// Test 15: Task creation with all options combined
		await runTest('Task creation with all options', async () => {
			// Create dependency
			const depResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Prerequisite task'],
				{ cwd: testDir }
			);
			const depTaskId = helpers.extractTaskId(depResult.stdout);
			
			// Create tag
			await helpers.taskMaster(
				'add-tag',
				['feature-complete', '--description', 'Complete feature test'],
				{ cwd: testDir }
			);
			
			// Create task with all options
			const result = await helpers.taskMaster(
				'add-task',
				[
					'--prompt', 'Comprehensive task with all features',
					'--priority', 'medium',
					'--tag', 'feature-complete',
					'--depends-on', depTaskId,
					'--metadata', 'complexity=high',
					'--metadata', 'estimated_hours=8'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			const taskId = helpers.extractTaskId(result.stdout);
			
			// Verify all options were applied
			const showResult = await helpers.taskMaster('show', [taskId], { cwd: testDir });
			const listResult = await helpers.taskMaster('list', ['--tag', 'feature-complete'], { cwd: testDir });
			const tasksData = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const task = tasksData.tasks.find(t => t.id === taskId);
			
			if (!showResult.stdout.includes('medium') && !showResult.stdout.includes('Medium')) {
				throw new Error('Priority not set');
			}
			if (!listResult.stdout.includes(taskId)) {
				throw new Error('Task not in tag');
			}
			if (!showResult.stdout.includes(depTaskId)) {
				throw new Error('Dependency not set');
			}
			if (!task || !task.metadata || task.metadata.complexity !== 'high') {
				throw new Error('Metadata not set correctly');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Add-Task Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All add-task tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'add-task test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Add-task test suite failed: ${error.message}`);
	}

	return results;
}