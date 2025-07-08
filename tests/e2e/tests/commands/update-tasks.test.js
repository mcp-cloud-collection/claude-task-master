/**
 * Comprehensive E2E tests for update-tasks command
 * Tests bulk task update functionality with various filters and AI capabilities
 */

export default async function testUpdateTasks(logger, helpers, context) {
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
		logger.info('Starting comprehensive update-tasks tests...');

		// Setup: Create a variety of tasks for bulk operations
		logger.info('Setting up test tasks for bulk operations...');
		
		// Create tasks with different statuses
		const taskIds = [];
		
		// Pending tasks
		for (let i = 1; i <= 3; i++) {
			const result = await helpers.taskMaster(
				'add-task',
				['--title', `Pending task ${i}`, '--priority', i === 1 ? 'high' : 'medium'],
				{ cwd: testDir }
			);
			taskIds.push(helpers.extractTaskId(result.stdout));
		}
		
		// In-progress tasks
		for (let i = 1; i <= 2; i++) {
			const result = await helpers.taskMaster(
				'add-task',
				['--title', `In-progress task ${i}`],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(result.stdout);
			taskIds.push(taskId);
			await helpers.taskMaster('set-status', [taskId, 'in_progress'], { cwd: testDir });
		}
		
		// Tasks with tags
		await helpers.taskMaster('add-tag', ['backend'], { cwd: testDir });
		await helpers.taskMaster('add-tag', ['frontend'], { cwd: testDir });
		
		for (let i = 1; i <= 2; i++) {
			const result = await helpers.taskMaster(
				'add-task',
				['--title', `Backend task ${i}`, '--tag', 'backend'],
				{ cwd: testDir }
			);
			taskIds.push(helpers.extractTaskId(result.stdout));
		}

		// Test 1: Bulk update by status
		await runTest('Bulk update tasks by status', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--status', 'pending', '--set-priority', 'high'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should report number of tasks updated
			if (!result.stdout.includes('updated') || !result.stdout.match(/\d+/)) {
				throw new Error('No update count reported');
			}
			
			// Verify all pending tasks now have high priority
			const listResult = await helpers.taskMaster('list', ['--status', 'pending'], { cwd: testDir });
			const pendingTasks = listResult.stdout.match(/\d+\s*\|/g) || [];
			
			// Check a sample task
			if (pendingTasks.length > 0) {
				const showResult = await helpers.taskMaster('show', [taskIds[0]], { cwd: testDir });
				if (!showResult.stdout.includes('high') && !showResult.stdout.includes('High')) {
					throw new Error('Priority not updated for pending tasks');
				}
			}
		});

		// Test 2: Bulk update by tag
		await runTest('Bulk update tasks by tag', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--tag', 'backend', '--add-metadata', 'team=backend-team'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify backend tasks have metadata
			const listResult = await helpers.taskMaster('list', ['--tag', 'backend'], { cwd: testDir });
			const backendTaskIds = (listResult.stdout.match(/\d+(?=\s*\|)/g) || []);
			
			if (backendTaskIds.length > 0) {
				const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
				const backendTask = tasksJson.tasks.find(t => backendTaskIds.includes(t.id));
				
				if (!backendTask || !backendTask.metadata || backendTask.metadata.team !== 'backend-team') {
					throw new Error('Metadata not added to backend tasks');
				}
			}
		});

		// Test 3: Bulk update with AI enhancement
		await runTest('Bulk AI enhancement', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--tag', 'backend', '--enhance', '--prompt', 'Add security considerations'],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check that tasks were enhanced
			const listResult = await helpers.taskMaster('list', ['--tag', 'backend'], { cwd: testDir });
			const backendTaskIds = (listResult.stdout.match(/\d+(?=\s*\|)/g) || []);
			
			if (backendTaskIds.length > 0) {
				const showResult = await helpers.taskMaster('show', [backendTaskIds[0]], { cwd: testDir });
				const hasSecurityMention = showResult.stdout.toLowerCase().includes('security') ||
				                          showResult.stdout.toLowerCase().includes('secure') ||
				                          showResult.stdout.toLowerCase().includes('auth');
				
				if (!hasSecurityMention) {
					throw new Error('AI enhancement did not add security considerations');
				}
			}
		});

		// Test 4: Bulk status change
		await runTest('Bulk status change', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--priority', 'high', '--set-status', 'in_progress'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify high priority tasks are now in progress
			const listResult = await helpers.taskMaster('list', ['--priority', 'high'], { cwd: testDir });
			const highPriorityIds = (listResult.stdout.match(/\d+(?=\s*\|)/g) || []);
			
			if (highPriorityIds.length > 0) {
				const showResult = await helpers.taskMaster('show', [highPriorityIds[0]], { cwd: testDir });
				if (!showResult.stdout.includes('in_progress') && !showResult.stdout.includes('In Progress')) {
					throw new Error('Status not updated for high priority tasks');
				}
			}
		});

		// Test 5: Bulk update with multiple filters
		await runTest('Bulk update with combined filters', async () => {
			// Add frontend tag to some tasks
			await helpers.taskMaster('update-task', [taskIds[0], '--add-tag', 'frontend'], { cwd: testDir });
			await helpers.taskMaster('update-task', [taskIds[1], '--add-tag', 'frontend'], { cwd: testDir });
			
			const result = await helpers.taskMaster(
				'update-tasks',
				['--tag', 'frontend', '--status', 'in_progress', '--add-metadata', 'urgent=true'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should only update tasks matching both filters
			const updateCount = result.stdout.match(/(\d+) tasks? updated/);
			if (!updateCount) {
				throw new Error('Update count not reported');
			}
		});

		// Test 6: Bulk update all tasks
		await runTest('Update all tasks', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--all', '--add-metadata', 'batch_update=test'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify all tasks have the metadata
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const tasksWithoutMetadata = tasksJson.tasks.filter(
				t => !t.metadata || t.metadata.batch_update !== 'test'
			);
			
			if (tasksWithoutMetadata.length > 0) {
				throw new Error('Not all tasks were updated');
			}
		});

		// Test 7: Bulk update with confirmation
		await runTest('Bulk update with safety check', async () => {
			// This test checks if dangerous operations require confirmation
			// The actual behavior depends on implementation
			const result = await helpers.taskMaster(
				'update-tasks',
				['--all', '--set-status', 'completed', '--force'],
				{ cwd: testDir }
			);
			
			// Should either succeed with --force or show warning
			if (result.exitCode !== 0 && !result.stderr.includes('confirm')) {
				throw new Error('No safety check for dangerous bulk operation');
			}
		});

		// Test 8: Bulk update by ID list
		await runTest('Bulk update specific task IDs', async () => {
			const targetIds = taskIds.slice(0, 3);
			const result = await helpers.taskMaster(
				'update-tasks',
				['--ids', targetIds.join(','), '--add-metadata', 'selected=true'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify only specified tasks were updated
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			targetIds.forEach(id => {
				const task = tasksJson.tasks.find(t => t.id === id);
				if (!task.metadata || task.metadata.selected !== 'true') {
					throw new Error(`Task ${id} not updated`);
				}
			});
			
			// Verify other tasks were not updated
			const otherTasks = tasksJson.tasks.filter(t => !targetIds.includes(t.id));
			otherTasks.forEach(task => {
				if (task.metadata && task.metadata.selected === 'true') {
					throw new Error(`Task ${task.id} incorrectly updated`);
				}
			});
		});

		// Test 9: Bulk update with complex query
		await runTest('Complex query bulk update', async () => {
			// Create tasks with specific patterns
			for (let i = 1; i <= 3; i++) {
				await helpers.taskMaster(
					'add-task',
					['--title', `API endpoint: /users/${i}`, '--tag', 'backend'],
					{ cwd: testDir }
				);
			}
			
			const result = await helpers.taskMaster(
				'update-tasks',
				['--query', 'title:API endpoint', '--add-metadata', 'type=api'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify API tasks were updated
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const apiTasks = tasksJson.tasks.filter(t => t.title.includes('API endpoint'));
			
			apiTasks.forEach(task => {
				if (!task.metadata || task.metadata.type !== 'api') {
					throw new Error('API tasks not properly updated');
				}
			});
		});

		// Test 10: Error handling - no matching tasks
		await runTest('Error handling - no matches', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--tag', 'non-existent-tag', '--set-priority', 'low'],
				{ cwd: testDir, allowFailure: true }
			);
			
			// Should indicate no tasks matched
			if (!result.stdout.includes('0 tasks') && !result.stdout.includes('No tasks')) {
				throw new Error('No clear message about zero matches');
			}
		});

		// Test 11: Bulk update with dry run
		await runTest('Dry run mode', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				['--status', 'pending', '--set-priority', 'low', '--dry-run'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should show what would be updated
			if (!result.stdout.includes('would') || !result.stdout.includes('dry')) {
				throw new Error('Dry run output not clear');
			}
			
			// Verify no actual changes
			const showResult = await helpers.taskMaster('show', [taskIds[0]], { cwd: testDir });
			if (showResult.stdout.includes('low') || showResult.stdout.includes('Low')) {
				throw new Error('Dry run actually modified tasks');
			}
		});

		// Test 12: Bulk update with progress reporting
		await runTest('Progress reporting for large updates', async () => {
			// Create many tasks
			const manyTaskIds = [];
			for (let i = 1; i <= 20; i++) {
				const result = await helpers.taskMaster(
					'add-task',
					['--title', `Bulk task ${i}`],
					{ cwd: testDir }
				);
				manyTaskIds.push(helpers.extractTaskId(result.stdout));
			}
			
			const result = await helpers.taskMaster(
				'update-tasks',
				['--ids', manyTaskIds.join(','), '--set-priority', 'medium', '--verbose'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should show progress or summary
			const hasProgress = result.stdout.includes('updated') && 
			                   result.stdout.includes('20');
			if (!hasProgress) {
				throw new Error('No progress information for bulk update');
			}
		});

		// Test 13: Bulk update with rollback on error
		await runTest('Rollback on error', async () => {
			// Try to update with invalid data that should fail partway through
			const result = await helpers.taskMaster(
				'update-tasks',
				['--all', '--add-dependency', '99999'],
				{ cwd: testDir, allowFailure: true }
			);
			
			// Should fail and indicate rollback or atomic operation
			if (result.exitCode === 0) {
				throw new Error('Should have failed with invalid dependency');
			}
			
			// Verify no partial updates occurred
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const tasksWithBadDep = tasksJson.tasks.filter(
				t => t.dependencies && t.dependencies.includes('99999')
			);
			
			if (tasksWithBadDep.length > 0) {
				throw new Error('Partial update occurred - no rollback');
			}
		});

		// Test 14: Bulk update with template
		await runTest('Bulk update with template', async () => {
			const result = await helpers.taskMaster(
				'update-tasks',
				[
					'--tag', 'backend',
					'--apply-template', 'standard-backend-task',
					'--template-fields', 'add testing requirements, add documentation needs'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check tasks were updated with template
			const listResult = await helpers.taskMaster('list', ['--tag', 'backend'], { cwd: testDir });
			const backendTaskIds = (listResult.stdout.match(/\d+(?=\s*\|)/g) || []);
			
			if (backendTaskIds.length > 0) {
				const showResult = await helpers.taskMaster('show', [backendTaskIds[0]], { cwd: testDir });
				const hasTemplateContent = showResult.stdout.toLowerCase().includes('test') ||
				                          showResult.stdout.toLowerCase().includes('documentation');
				
				if (!hasTemplateContent) {
					throw new Error('Template not applied to tasks');
				}
			}
		});

		// Test 15: Performance test - bulk update many tasks
		await runTest('Performance - update 50 tasks', async () => {
			// Create 50 tasks
			const perfTaskIds = [];
			for (let i = 1; i <= 50; i++) {
				const result = await helpers.taskMaster(
					'add-task',
					['--title', `Performance test task ${i}`],
					{ cwd: testDir }
				);
				perfTaskIds.push(helpers.extractTaskId(result.stdout));
			}
			
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'update-tasks',
				['--ids', perfTaskIds.join(','), '--set-priority', 'low', '--add-metadata', 'perf_test=true'],
				{ cwd: testDir }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			logger.info(`Updated 50 tasks in ${duration}ms`);
			if (duration > 10000) {
				throw new Error(`Bulk update too slow: ${duration}ms`);
			}
			
			// Verify all were updated
			const updateMatch = result.stdout.match(/(\d+) tasks? updated/);
			if (!updateMatch || parseInt(updateMatch[1]) !== 50) {
				throw new Error('Not all tasks were updated');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Update-Tasks Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All update-tasks tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'update-tasks test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Update-tasks test suite failed: ${error.message}`);
	}

	return results;
}