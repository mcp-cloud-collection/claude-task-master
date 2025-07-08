/**
 * Comprehensive E2E tests for update-task command
 * Tests all aspects of task updates including AI-powered and manual updates
 */

export default async function testUpdateTask(logger, helpers, context) {
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
		logger.info('Starting comprehensive update-task tests...');

		// Setup: Create various tasks for testing
		logger.info('Setting up test tasks...');
		
		// Create simple task
		const simpleResult = await helpers.taskMaster(
			'add-task',
			['--title', 'Simple task', '--description', 'Initial description'],
			{ cwd: testDir }
		);
		const simpleTaskId = helpers.extractTaskId(simpleResult.stdout);
		
		// Create AI task
		const aiResult = await helpers.taskMaster(
			'add-task',
			['--prompt', 'Create a logging system for the application'],
			{ cwd: testDir }
		);
		const aiTaskId = helpers.extractTaskId(aiResult.stdout);
		
		// Create task with metadata
		const metaResult = await helpers.taskMaster(
			'add-task',
			['--title', 'Task with metadata', '--metadata', 'version=1.0'],
			{ cwd: testDir }
		);
		const metaTaskId = helpers.extractTaskId(metaResult.stdout);

		// Test 1: Basic manual update - description only
		await runTest('Basic description update', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[simpleTaskId, '--description', 'Updated description with more details'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify update
			const showResult = await helpers.taskMaster('show', [simpleTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('Updated description with more details')) {
				throw new Error('Description not updated');
			}
		});

		// Test 2: AI-powered task update
		await runTest('AI-powered task update', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[aiTaskId, '--prompt', 'Add requirements for structured logging with log levels and rotation'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify AI enhancements
			const showResult = await helpers.taskMaster('show', [aiTaskId], { cwd: testDir });
			const output = showResult.stdout.toLowerCase();
			
			// Should mention logging concepts
			const hasLoggingConcepts = output.includes('log level') || 
			                          output.includes('rotation') || 
			                          output.includes('structured') ||
			                          output.includes('logging');
			if (!hasLoggingConcepts) {
				throw new Error('AI did not enhance task with logging requirements');
			}
		});

		// Test 3: Update multiple fields simultaneously
		await runTest('Multi-field update', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					simpleTaskId,
					'--title', 'Renamed task',
					'--description', 'New comprehensive description',
					'--priority', 'high',
					'--status', 'in_progress'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify all updates
			const showResult = await helpers.taskMaster('show', [simpleTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('Renamed task')) {
				throw new Error('Title not updated');
			}
			if (!showResult.stdout.includes('New comprehensive description')) {
				throw new Error('Description not updated');
			}
			if (!showResult.stdout.includes('high') && !showResult.stdout.includes('High')) {
				throw new Error('Priority not updated');
			}
			if (!showResult.stdout.includes('in_progress') && !showResult.stdout.includes('In Progress')) {
				throw new Error('Status not updated');
			}
		});

		// Test 4: Update task metadata
		await runTest('Update task metadata', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					metaTaskId,
					'--metadata', 'version=2.0',
					'--metadata', 'author=test-user',
					'--metadata', 'reviewed=true'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify metadata
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const task = tasksJson.tasks.find(t => t.id === metaTaskId);
			
			if (!task.metadata || task.metadata.version !== '2.0' || 
			    task.metadata.author !== 'test-user' || task.metadata.reviewed !== 'true') {
				throw new Error('Metadata not properly updated');
			}
		});

		// Test 5: Error handling - non-existent task
		await runTest('Error handling - non-existent task', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				['99999', '--description', 'This should fail'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with non-existent task');
			}
			if (!result.stderr.includes('not found') && !result.stderr.includes('exist')) {
				throw new Error('Error message not clear about missing task');
			}
		});

		// Test 6: Update with validation of AI output
		await runTest('AI update with validation', async () => {
			// Create task with specific context
			const validationResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Setup CI/CD pipeline'],
				{ cwd: testDir }
			);
			const validationTaskId = helpers.extractTaskId(validationResult.stdout);
			
			// Update with specific requirements
			const result = await helpers.taskMaster(
				'update-task',
				[validationTaskId, '--prompt', 'Add automated testing and deployment stages', '--validate-ai'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check AI added relevant content
			const showResult = await helpers.taskMaster('show', [validationTaskId], { cwd: testDir });
			const output = showResult.stdout.toLowerCase();
			
			if (!output.includes('test') || !output.includes('deploy')) {
				throw new Error('AI validation failed - missing required concepts');
			}
		});

		// Test 7: Update task with tag changes
		await runTest('Update task tags', async () => {
			// Create tags
			await helpers.taskMaster('add-tag', ['frontend'], { cwd: testDir });
			await helpers.taskMaster('add-tag', ['urgent'], { cwd: testDir });
			
			const result = await helpers.taskMaster(
				'update-task',
				[simpleTaskId, '--add-tag', 'frontend', '--add-tag', 'urgent'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify tags in appropriate contexts
			const frontendList = await helpers.taskMaster('list', ['--tag', 'frontend'], { cwd: testDir });
			const urgentList = await helpers.taskMaster('list', ['--tag', 'urgent'], { cwd: testDir });
			
			if (!frontendList.stdout.includes(simpleTaskId)) {
				throw new Error('Task not found in frontend tag');
			}
			if (!urgentList.stdout.includes(simpleTaskId)) {
				throw new Error('Task not found in urgent tag');
			}
		});

		// Test 8: Remove tags from task
		await runTest('Remove task tags', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[simpleTaskId, '--remove-tag', 'urgent'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify tag removed
			const urgentList = await helpers.taskMaster('list', ['--tag', 'urgent'], { cwd: testDir });
			if (urgentList.stdout.includes(simpleTaskId)) {
				throw new Error('Task still in removed tag');
			}
		});

		// Test 9: Update with dependencies
		await runTest('Update task dependencies', async () => {
			// Create dependency task
			const depResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Dependency task'],
				{ cwd: testDir }
			);
			const depTaskId = helpers.extractTaskId(depResult.stdout);
			
			const result = await helpers.taskMaster(
				'update-task',
				[aiTaskId, '--add-dependency', depTaskId],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify dependency added
			const showResult = await helpers.taskMaster('show', [aiTaskId], { cwd: testDir });
			if (!showResult.stdout.includes(depTaskId)) {
				throw new Error('Dependency not added to task');
			}
		});

		// Test 10: Complex AI enhancement
		await runTest('Complex AI task enhancement', async () => {
			// Create task needing enhancement
			const enhanceResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Basic API endpoint', '--description', 'Create user endpoint'],
				{ cwd: testDir }
			);
			const enhanceTaskId = helpers.extractTaskId(enhanceResult.stdout);
			
			const result = await helpers.taskMaster(
				'update-task',
				[
					enhanceTaskId,
					'--prompt', 'Enhance with REST best practices, error handling, validation, and OpenAPI documentation',
					'--keep-original'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should preserve original and add enhancements
			const showResult = await helpers.taskMaster('show', [enhanceTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('user endpoint')) {
				throw new Error('Original content lost during enhancement');
			}
			
			// Check for enhancements
			const output = showResult.stdout.toLowerCase();
			const enhancements = ['validation', 'error', 'rest', 'openapi', 'documentation'];
			const foundEnhancements = enhancements.filter(e => output.includes(e)).length;
			
			if (foundEnhancements < 3) {
				throw new Error('AI did not add sufficient enhancements');
			}
		});

		// Test 11: Bulk property update
		await runTest('Update common properties across tasks', async () => {
			// Update all tasks to have a common property
			const taskIds = [simpleTaskId, aiTaskId, metaTaskId];
			
			// This tests if update-task can handle multiple IDs (implementation dependent)
			// If not supported, test single updates in sequence
			for (const taskId of taskIds) {
				const result = await helpers.taskMaster(
					'update-task',
					[taskId, '--metadata', 'project=test-suite'],
					{ cwd: testDir }
				);
				if (result.exitCode !== 0) {
					throw new Error(`Failed to update task ${taskId}: ${result.stderr}`);
				}
			}
			
			// Verify all have the metadata
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			taskIds.forEach(taskId => {
				const task = tasksJson.tasks.find(t => t.id === taskId);
				if (!task.metadata || task.metadata.project !== 'test-suite') {
					throw new Error(`Task ${taskId} missing project metadata`);
				}
			});
		});

		// Test 12: Update completed task
		await runTest('Update completed task handling', async () => {
			// Complete a task first
			await helpers.taskMaster('set-status', [simpleTaskId, 'completed'], { cwd: testDir });
			
			// Try to update it
			const result = await helpers.taskMaster(
				'update-task',
				[simpleTaskId, '--description', 'Trying to update completed task'],
				{ cwd: testDir, allowFailure: true }
			);
			
			// Should either fail with clear message or succeed with warning
			if (result.exitCode !== 0) {
				if (!result.stderr.includes('completed')) {
					throw new Error('No clear message about updating completed task');
				}
			} else if (!result.stdout.includes('warning') && !result.stdout.includes('completed')) {
				throw new Error('No warning about updating completed task');
			}
		});

		// Test 13: Update with context preservation
		await runTest('Context-aware AI update', async () => {
			// Create task with rich context
			const contextResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Implement user profile page with React'],
				{ cwd: testDir }
			);
			const contextTaskId = helpers.extractTaskId(contextResult.stdout);
			
			// Expand to add subtasks
			await helpers.taskMaster('expand', [contextTaskId], { cwd: testDir, timeout: 120000 });
			
			// Update with context preservation
			const result = await helpers.taskMaster(
				'update-task',
				[contextTaskId, '--prompt', 'Add accessibility features', '--preserve-context'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should maintain React context and add accessibility
			const showResult = await helpers.taskMaster('show', [contextTaskId], { cwd: testDir });
			const output = showResult.stdout.toLowerCase();
			
			if (!output.includes('react')) {
				throw new Error('Lost React context during update');
			}
			if (!output.includes('accessibility') && !output.includes('a11y') && !output.includes('aria')) {
				throw new Error('Accessibility features not added');
			}
		});

		// Test 14: Update with estimation
		await runTest('Update task with time estimation', async () => {
			const result = await helpers.taskMaster(
				'update-task',
				[
					aiTaskId,
					'--estimate', '8h',
					'--metadata', 'story_points=5'
				],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Verify estimation added
			const tasksJson = helpers.readJson(`${testDir}/.taskmaster/tasks/tasks.json`);
			const task = tasksJson.tasks.find(t => t.id === aiTaskId);
			
			if (!task.estimate || !task.estimate.includes('8h')) {
				throw new Error('Time estimate not added');
			}
			if (!task.metadata || task.metadata.story_points !== '5') {
				throw new Error('Story points not added');
			}
		});

		// Test 15: Performance - large description update
		await runTest('Performance - large content update', async () => {
			// Create large description
			const largeDescription = 'This is a detailed task description. '.repeat(100) + 
			                        '\n\n## Requirements\n' + 
			                        '- Requirement item\n'.repeat(50);
			
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'update-task',
				[metaTaskId, '--description', largeDescription],
				{ cwd: testDir }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			logger.info(`Large update completed in ${duration}ms`);
			if (duration > 5000) {
				throw new Error(`Update too slow: ${duration}ms`);
			}
			
			// Verify content was saved
			const showResult = await helpers.taskMaster('show', [metaTaskId], { cwd: testDir });
			if (!showResult.stdout.includes('detailed task description')) {
				throw new Error('Large description not saved properly');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Update-Task Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All update-task tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'update-task test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Update-task test suite failed: ${error.message}`);
	}

	return results;
}