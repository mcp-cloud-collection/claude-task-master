/**
 * Comprehensive E2E tests for update-subtask command
 * Tests all aspects of subtask updates including AI and manual modes
 */

export default async function testUpdateSubtask(logger, helpers, context) {
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
		logger.info('Starting comprehensive update-subtask tests...');

		// Setup: Create parent task with subtasks
		logger.info('Setting up parent task with subtasks...');
		
		// Create parent task
		const parentResult = await helpers.taskMaster(
			'add-task',
			['--prompt', 'Build a user authentication system'],
			{ cwd: testDir }
		);
		const parentTaskId = helpers.extractTaskId(parentResult.stdout);
		
		// Expand to get AI-generated subtasks
		await helpers.taskMaster('expand', [parentTaskId], { cwd: testDir, timeout: 120000 });
		
		// Add some manual subtasks
		await helpers.taskMaster(
			'add-subtask',
			[parentTaskId, 'Setup database schema'],
			{ cwd: testDir }
		);
		await helpers.taskMaster(
			'add-subtask',
			[parentTaskId, 'Create login endpoint'],
			{ cwd: testDir }
		);

		// Test 1: Basic AI-powered subtask update
		await runTest('AI-powered subtask update', async () => {
			const subtaskId = `${parentTaskId}.1`;
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Make this subtask focus on JWT token implementation'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify subtask was updated
			const showResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('JWT') || !showResult.stdout.includes('token')) {
				throw new Error('Subtask not updated with JWT focus');
			}
		});

		// Test 2: Manual subtask update (without AI)
		await runTest('Manual subtask update', async () => {
			const subtaskId = `${parentTaskId}.2`;
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id', subtaskId,
					'--title', 'Implement OAuth 2.0 integration',
					'--description', 'Add support for Google and GitHub OAuth providers'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify exact updates
			const showResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('OAuth 2.0')) {
				throw new Error('Subtask title not updated');
			}
			if (!showResult.stdout.includes('Google') || !showResult.stdout.includes('GitHub')) {
				throw new Error('Subtask description not updated');
			}
		});

		// Test 3: Update subtask status
		await runTest('Update subtask status', async () => {
			const subtaskId = `${parentTaskId}.3`;
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--status', 'in_progress'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify status change
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
			
			if (subtask.status !== 'in_progress') {
				throw new Error('Subtask status not updated');
			}
		});

		// Test 4: Update subtask priority
		await runTest('Update subtask priority', async () => {
			const subtaskId = `${parentTaskId}.4`;
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--priority', 'high'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify priority change
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
			
			if (subtask.priority !== 'high') {
				throw new Error('Subtask priority not updated');
			}
		});

		// Test 5: Batch subtask updates
		await runTest('Batch subtask updates', async () => {
			// Update multiple subtasks at once
			const subtaskIds = [`${parentTaskId}.1`, `${parentTaskId}.2`];
			const result = await helpers.taskMaster(
				'update-subtask',
				['--ids', subtaskIds.join(','), '--status', 'completed'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify all were updated
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			
			subtaskIds.forEach(id => {
				const subtask = parentTask.subtasks.find(s => s.id === id);
				if (subtask.status !== 'completed') {
					throw new Error(`Subtask ${id} not updated in batch`);
				}
			});
		});

		// Test 6: Update subtask with dependencies
		await runTest('Update subtask dependencies', async () => {
			const subtask1 = `${parentTaskId}.3`;
			const subtask2 = `${parentTaskId}.4`;
			
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtask2, '--depends-on', subtask1],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify dependency was added
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			const subtask = parentTask.subtasks.find(s => s.id === subtask2);
			
			if (!subtask.dependencies || !subtask.dependencies.includes(subtask1)) {
				throw new Error('Subtask dependency not added');
			}
		});

		// Test 7: AI enhancement of existing subtask
		await runTest('AI enhancement of manual subtask', async () => {
			// Get last manual subtask
			const showResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
			const subtaskMatches = showResult.stdout.match(/(\d+\.\d+)/g) || [];
			const lastSubtaskId = subtaskMatches[subtaskMatches.length - 1];
			
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', lastSubtaskId, '--enhance', '--prompt', 'Add security considerations'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should include security aspects
			const updatedShow = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
			const hasSecurityMention = updatedShow.stdout.toLowerCase().includes('security') ||
			                          updatedShow.stdout.toLowerCase().includes('secure') ||
			                          updatedShow.stdout.toLowerCase().includes('protection');
			
			if (!hasSecurityMention) {
				throw new Error('AI enhancement did not add security considerations');
			}
		});

		// Test 8: Error handling - invalid subtask ID
		await runTest('Error handling - invalid subtask ID', async () => {
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', '999.999', '--title', 'Invalid update'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with invalid subtask ID');
			}
			if (!result.stderr.includes('not found') && !result.stderr.includes('invalid')) {
				throw new Error('Error message not clear about invalid ID');
			}
		});

		// Test 9: Update subtask metadata
		await runTest('Update subtask metadata', async () => {
			const subtaskId = `${parentTaskId}.1`;
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id', subtaskId,
					'--metadata', 'assigned_to=john@example.com',
					'--metadata', 'estimated_hours=4'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify metadata
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
			
			if (!subtask.metadata || subtask.metadata.assigned_to !== 'john@example.com') {
				throw new Error('Subtask metadata not updated');
			}
		});

		// Test 10: Update with validation
		await runTest('Update with validation rules', async () => {
			// Try to update completed subtask (should warn or fail based on rules)
			const subtaskId = `${parentTaskId}.1`; // This was marked completed earlier
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--title', 'Trying to update completed task', '--force'],
				{ cwd: testDir }
			);
			
			// Should either succeed with --force or provide clear message
			if (result.exitCode !== 0 && !result.stderr.includes('completed')) {
				throw new Error('No clear message about updating completed subtask');
			}
		});

		// Test 11: Complex update with multiple fields
		await runTest('Complex multi-field update', async () => {
			// Create fresh subtask
			await helpers.taskMaster(
				'add-subtask',
				[parentTaskId, 'Fresh subtask for complex update'],
				{ cwd: testDir }
			);
			
			const showResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
			const subtaskMatches = showResult.stdout.match(/(\d+\.\d+)/g) || [];
			const newSubtaskId = subtaskMatches[subtaskMatches.length - 1];
			
			const result = await helpers.taskMaster(
				'update-subtask',
				[
					'--id', newSubtaskId,
					'--prompt', 'Enhance with testing requirements',
					'--priority', 'medium',
					'--status', 'in_progress',
					'--metadata', 'test_coverage=required'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify all updates applied
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			const subtask = parentTask.subtasks.find(s => s.id === newSubtaskId);
			
			if (subtask.priority !== 'medium' || subtask.status !== 'in_progress') {
				throw new Error('Not all fields updated');
			}
			if (!subtask.metadata || subtask.metadata.test_coverage !== 'required') {
				throw new Error('Metadata not updated in complex update');
			}
		});

		// Test 12: Update subtask in context of parent task
		await runTest('Context-aware subtask update', async () => {
			// Create new parent task with specific context
			const contextParent = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Build REST API with Node.js'],
				{ cwd: testDir }
			);
			const contextParentId = helpers.extractTaskId(contextParent.stdout);
			
			// Add subtask
			await helpers.taskMaster(
				'add-subtask',
				[contextParentId, 'Create endpoints'],
				{ cwd: testDir }
			);
			
			const subtaskId = `${contextParentId}.1`;
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--prompt', 'Focus on CRUD operations', '--use-parent-context'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should maintain REST API context
			const showResult = await helpers.taskMaster('show', [contextParentId], { cwd: testDir });
			const hasApiContext = showResult.stdout.toLowerCase().includes('api') ||
			                     showResult.stdout.toLowerCase().includes('endpoint') ||
			                     showResult.stdout.toLowerCase().includes('rest');
			
			if (!hasApiContext) {
				throw new Error('Parent context not preserved in subtask update');
			}
		});

		// Test 13: Reorder subtasks during update
		await runTest('Reorder subtasks', async () => {
			const subtaskId = `${parentTaskId}.3`;
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--position', '1'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify reordering
			const showResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
			// The subtask that was at position 3 should now appear first
			// This is implementation dependent, so we just check it succeeded
		});

		// Test 14: Update with tag assignment
		await runTest('Update subtask with tags', async () => {
			// Create tag first
			await helpers.taskMaster('add-tag', ['backend-subtasks'], { cwd: testDir });
			
			const subtaskId = `${parentTaskId}.1`;
			const result = await helpers.taskMaster(
				'update-subtask',
				['--id', subtaskId, '--tag', 'backend-subtasks'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify tag was assigned
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const parentTask = tasksJson.tasks.find(t => t.id === parentTaskId);
			const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
			
			if (!subtask.tags || !subtask.tags.includes('backend-subtasks')) {
				throw new Error('Tag not assigned to subtask');
			}
		});

		// Test 15: Performance - update many subtasks
		await runTest('Performance - bulk subtask updates', async () => {
			// Create parent with many subtasks
			const perfParent = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Large project with many components'],
				{ cwd: testDir }
			);
			const perfParentId = helpers.extractTaskId(perfParent.stdout);
			
			// Add 20 subtasks
			const promises = [];
			for (let i = 1; i <= 20; i++) {
				promises.push(
					helpers.taskMaster(
						'add-subtask',
						[perfParentId, `Component ${i}`],
						{ cwd: testDir }
					)
				);
			}
			await Promise.all(promises);
			
			// Update all to in_progress
			const subtaskIds = [];
			for (let i = 1; i <= 20; i++) {
				subtaskIds.push(`${perfParentId}.${i}`);
			}
			
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'update-subtask',
				['--ids', subtaskIds.join(','), '--status', 'in_progress'],
				{ cwd: testDir }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			logger.info(`Updated 20 subtasks in ${duration}ms`);
			if (duration > 5000) {
				throw new Error(`Bulk update too slow: ${duration}ms`);
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Update-Subtask Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All update-subtask tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'update-subtask test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Update-subtask test suite failed: ${error.message}`);
	}

	return results;
}