/**
 * Comprehensive E2E tests for expand-task command
 * Tests all aspects of task expansion including single, multiple, and recursive expansion
 */

export default async function testExpandTask(logger, helpers, context) {
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
		logger.info('Starting comprehensive expand-task tests...');

		// Setup: Create tasks for expansion testing
		logger.info('Setting up test tasks...');
		
		// Create simple task for expansion
		const simpleResult = await helpers.taskMaster(
			'add-task',
			['--prompt', 'Create a user authentication system'],
			{ cwd: testDir }
		);
		const simpleTaskId = helpers.extractTaskId(simpleResult.stdout);
		
		// Create complex task for expansion
		const complexResult = await helpers.taskMaster(
			'add-task',
			['--prompt', 'Build a full-stack web application with React frontend and Node.js backend'],
			{ cwd: testDir }
		);
		const complexTaskId = helpers.extractTaskId(complexResult.stdout);
		
		// Create manual task (no AI prompt)
		const manualResult = await helpers.taskMaster(
			'add-task',
			['--title', 'Manual task for expansion', '--description', 'This task needs to be broken down into subtasks'],
			{ cwd: testDir }
		);
		const manualTaskId = helpers.extractTaskId(manualResult.stdout);

		// Test 1: Single task expansion
		await runTest('Single task expansion', async () => {
			const result = await helpers.taskMaster(
				'expand',
				[simpleTaskId],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify subtasks were created
			const showResult = await helpers.taskMaster('show', [simpleTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('Subtasks:') && !showResult.stdout.includes('.1')) {
				throw new Error('No subtasks created during expansion');
			}
			
			// Check expansion output mentions subtasks
			if (!result.stdout.includes('subtask') && !result.stdout.includes('expanded')) {
				throw new Error('Expansion output does not mention subtasks');
			}
		});

		// Test 2: Expansion of already expanded task (should skip)
		await runTest('Expansion of already expanded task', async () => {
			const result = await helpers.taskMaster(
				'expand',
				[simpleTaskId],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should indicate task is already expanded
			if (!result.stdout.includes('already') && !result.stdout.includes('skip')) {
				throw new Error('Did not indicate task was already expanded');
			}
		});

		// Test 3: Force re-expansion with --force
		await runTest('Force re-expansion', async () => {
			// Get initial subtask count
			const beforeShow = await helpers.taskMaster('show', [simpleTaskId], { cwd: testDir });
			const beforeSubtasks = (beforeShow.stdout.match(/\d+\.\d+/g) || []).length;
			
			const result = await helpers.taskMaster(
				'expand',
				[simpleTaskId, '--force'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify it actually re-expanded
			if (!result.stdout.includes('expanded') && !result.stdout.includes('Re-expand')) {
				throw new Error('Force flag did not trigger re-expansion');
			}
			
			// Check if subtasks changed (they might be different)
			const afterShow = await helpers.taskMaster('show', [simpleTaskId], { cwd: testDir });
			const afterSubtasks = (afterShow.stdout.match(/\d+\.\d+/g) || []).length;
			
			if (afterSubtasks === 0) {
				throw new Error('Force re-expansion removed all subtasks');
			}
		});

		// Test 4: Expand multiple tasks
		await runTest('Expand multiple tasks', async () => {
			const result = await helpers.taskMaster(
				'expand',
				[complexTaskId, manualTaskId],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify both tasks were expanded
			const showComplex = await helpers.taskMaster('show', [complexTaskId], { cwd: testDir });
			const showManual = await helpers.taskMaster('show', [manualTaskId], { cwd: testDir });
			
			if (!showComplex.stdout.includes('Subtasks:')) {
				throw new Error('Complex task was not expanded');
			}
			if (!showManual.stdout.includes('Subtasks:')) {
				throw new Error('Manual task was not expanded');
			}
		});

		// Test 5: Expand all tasks with --all
		await runTest('Expand all tasks', async () => {
			// Create a few more tasks
			await helpers.taskMaster('add-task', ['--prompt', 'Task A for expand all'], { cwd: testDir });
			await helpers.taskMaster('add-task', ['--prompt', 'Task B for expand all'], { cwd: testDir });
			
			const result = await helpers.taskMaster(
				'expand',
				['--all'],
				{ cwd: testDir, timeout: 240000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should mention expanding multiple tasks
			if (!result.stdout.includes('Expand') || !result.stdout.includes('all')) {
				throw new Error('Expand all did not indicate it was processing all tasks');
			}
		});

		// Test 6: Error handling - invalid task ID
		await runTest('Error handling - invalid task ID', async () => {
			const result = await helpers.taskMaster(
				'expand',
				['99999'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with invalid task ID');
			}
			if (!result.stderr.includes('not found') && !result.stderr.includes('invalid')) {
				throw new Error('Error message does not indicate task not found');
			}
		});

		// Test 7: Expansion quality verification
		await runTest('Expansion quality - relevant subtasks', async () => {
			// Create a specific task
			const specificResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Implement user login with email and password'],
				{ cwd: testDir }
			);
			const specificTaskId = helpers.extractTaskId(specificResult.stdout);
			
			// Expand it
			await helpers.taskMaster('expand', [specificTaskId], { cwd: testDir, timeout: 120000 });
			
			// Check subtasks are relevant
			const showResult = await helpers.taskMaster('show', [specificTaskId], { cwd: testDir });
			const subtaskText = showResult.stdout.toLowerCase();
			
			// Should have subtasks related to login functionality
			const relevantKeywords = ['email', 'password', 'validation', 'auth', 'login', 'user', 'security'];
			const foundKeywords = relevantKeywords.filter(keyword => subtaskText.includes(keyword));
			
			if (foundKeywords.length < 3) {
				throw new Error('Subtasks do not seem relevant to user login task');
			}
		});

		// Test 8: Recursive expansion of subtasks
		await runTest('Recursive expansion with --recursive', async () => {
			// Create task for recursive expansion
			const recursiveResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Build a complete project management system'],
				{ cwd: testDir }
			);
			const recursiveTaskId = helpers.extractTaskId(recursiveResult.stdout);
			
			// First expand the main task
			await helpers.taskMaster('expand', [recursiveTaskId], { cwd: testDir, timeout: 120000 });
			
			// Now expand recursively
			const result = await helpers.taskMaster(
				'expand',
				[recursiveTaskId, '--recursive'],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check for nested subtasks (e.g., 1.1.1)
			const showResult = await helpers.taskMaster('show', [recursiveTaskId], { cwd: testDir });
			if (!showResult.stdout.match(/\d+\.\d+\.\d+/)) {
				throw new Error('Recursive expansion did not create nested subtasks');
			}
		});

		// Test 9: Expand with depth limit
		await runTest('Expand with depth limit', async () => {
			// Create task for depth testing
			const depthResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Create a mobile application'],
				{ cwd: testDir }
			);
			const depthTaskId = helpers.extractTaskId(depthResult.stdout);
			
			const result = await helpers.taskMaster(
				'expand',
				[depthTaskId, '--depth', '2'],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should have subtasks but not too deep
			const showResult = await helpers.taskMaster('show', [depthTaskId], { cwd: testDir });
			const hasLevel1 = showResult.stdout.match(/\d+\.1/);
			const hasLevel2 = showResult.stdout.match(/\d+\.1\.1/);
			const hasLevel3 = showResult.stdout.match(/\d+\.1\.1\.1/);
			
			if (!hasLevel1) {
				throw new Error('No level 1 subtasks created');
			}
			if (hasLevel3) {
				throw new Error('Depth limit not respected - found level 3 subtasks');
			}
		});

		// Test 10: Expand task with existing subtasks
		await runTest('Expand task with manual subtasks', async () => {
			// Create task and add manual subtask
			const mixedResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Mixed subtasks task'],
				{ cwd: testDir }
			);
			const mixedTaskId = helpers.extractTaskId(mixedResult.stdout);
			
			// Add manual subtask
			await helpers.taskMaster(
				'add-subtask',
				[mixedTaskId, 'Manual subtask 1'],
				{ cwd: testDir }
			);
			
			// Now expand with AI
			const result = await helpers.taskMaster(
				'expand',
				[mixedTaskId],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should preserve manual subtask and add AI ones
			const showResult = await helpers.taskMaster('show', [mixedTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('Manual subtask 1')) {
				throw new Error('Manual subtask was removed during expansion');
			}
			
			// Count total subtasks - should be more than 1
			const subtaskCount = (showResult.stdout.match(/\d+\.\d+/g) || []).length;
			if (subtaskCount <= 1) {
				throw new Error('AI did not add additional subtasks');
			}
		});

		// Test 11: Expand with custom prompt
		await runTest('Expand with custom prompt', async () => {
			// Create task
			const customResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Generic development task'],
				{ cwd: testDir }
			);
			const customTaskId = helpers.extractTaskId(customResult.stdout);
			
			// Expand with custom instructions
			const result = await helpers.taskMaster(
				'expand',
				[customTaskId, '--prompt', 'Break this down focusing on security aspects'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify subtasks focus on security
			const showResult = await helpers.taskMaster('show', [customTaskId], { cwd: testDir });
			const subtaskText = showResult.stdout.toLowerCase();
			
			if (!subtaskText.includes('security') && !subtaskText.includes('secure') && 
			    !subtaskText.includes('auth') && !subtaskText.includes('protect')) {
				throw new Error('Custom prompt did not influence subtask generation');
			}
		});

		// Test 12: Performance - expand large task
		await runTest('Performance - expand complex task', async () => {
			const perfResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Build a complete enterprise resource planning (ERP) system with all modules'],
				{ cwd: testDir }
			);
			const perfTaskId = helpers.extractTaskId(perfResult.stdout);
			
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'expand',
				[perfTaskId],
				{ cwd: testDir, timeout: 180000 }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			logger.info(`Complex task expanded in ${duration}ms`);
			
			// Should create many subtasks for complex task
			const showResult = await helpers.taskMaster('show', [perfTaskId], { cwd: testDir });
			const subtaskCount = (showResult.stdout.match(/\d+\.\d+/g) || []).length;
			
			if (subtaskCount < 5) {
				throw new Error('Complex task should have generated more subtasks');
			}
			logger.info(`Generated ${subtaskCount} subtasks`);
		});

		// Test 13: Expand with tag context
		await runTest('Expand within tag context', async () => {
			// Create tag and task
			await helpers.taskMaster('add-tag', ['frontend-expansion'], { cwd: testDir });
			const taggedResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Create UI components', '--tag', 'frontend-expansion'],
				{ cwd: testDir }
			);
			const taggedTaskId = helpers.extractTaskId(taggedResult.stdout);
			
			// Expand within tag context
			const result = await helpers.taskMaster(
				'expand',
				[taggedTaskId, '--tag', 'frontend-expansion'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify subtasks inherit tag
			const listResult = await helpers.taskMaster(
				'list',
				['--tag', 'frontend-expansion'],
				{ cwd: testDir }
			);
			
			// Should show parent and subtasks in tag
			const taskMatches = listResult.stdout.match(/\d+(\.\d+)*/g) || [];
			if (taskMatches.length <= 1) {
				throw new Error('Subtasks did not inherit tag context');
			}
		});

		// Test 14: Expand completed task
		await runTest('Expand completed task', async () => {
			// Create and complete a task
			const completedResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Completed task'],
				{ cwd: testDir }
			);
			const completedTaskId = helpers.extractTaskId(completedResult.stdout);
			await helpers.taskMaster('set-status', [completedTaskId, 'completed'], { cwd: testDir });
			
			// Try to expand
			const result = await helpers.taskMaster(
				'expand',
				[completedTaskId],
				{ cwd: testDir, allowFailure: true }
			);
			
			// Should either fail or warn about completed status
			if (result.exitCode === 0 && !result.stdout.includes('completed') && !result.stdout.includes('warning')) {
				throw new Error('No warning about expanding completed task');
			}
		});

		// Test 15: Batch expansion with mixed results
		await runTest('Batch expansion with mixed results', async () => {
			// Create tasks in different states
			const task1 = await helpers.taskMaster('add-task', ['--prompt', 'New task 1'], { cwd: testDir });
			const taskId1 = helpers.extractTaskId(task1.stdout);
			
			const task2 = await helpers.taskMaster('add-task', ['--prompt', 'New task 2'], { cwd: testDir });
			const taskId2 = helpers.extractTaskId(task2.stdout);
			
			// Expand task2 first
			await helpers.taskMaster('expand', [taskId2], { cwd: testDir });
			
			// Now expand both - should skip task2
			const result = await helpers.taskMaster(
				'expand',
				[taskId1, taskId2],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should indicate one was skipped
			if (!result.stdout.includes('skip') || !result.stdout.includes('already')) {
				throw new Error('Did not indicate that already-expanded task was skipped');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Expand-Task Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All expand-task tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'expand-task test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Expand-task test suite failed: ${error.message}`);
	}

	return results;
}