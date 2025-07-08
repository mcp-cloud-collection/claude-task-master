/**
 * Comprehensive E2E tests for analyze-complexity command
 * Tests all aspects of complexity analysis including research mode and output formats
 */

export default async function testAnalyzeComplexity(logger, helpers, context) {
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
		logger.info('Starting comprehensive analyze-complexity tests...');

		// Setup: Create some tasks for analysis
		logger.info('Setting up test tasks...');
		const taskIds = [];
		
		// Create simple task
		const simple = await helpers.taskMaster(
			'add-task',
			['--title', 'Simple task', '--description', 'A very simple task'],
			{ cwd: testDir }
		);
		taskIds.push(helpers.extractTaskId(simple.stdout));
		
		// Create complex task with subtasks
		const complex = await helpers.taskMaster(
			'add-task',
			['--prompt', 'Build a complete e-commerce platform with payment processing'],
			{ cwd: testDir }
		);
		const complexId = helpers.extractTaskId(complex.stdout);
		taskIds.push(complexId);
		
		// Expand complex task to add subtasks
		await helpers.taskMaster('expand', [complexId], { cwd: testDir });
		
		// Create task with dependencies
		const withDeps = await helpers.taskMaster(
			'add-task',
			['--title', 'Deployment task', '--depends-on', taskIds[0]],
			{ cwd: testDir }
		);
		taskIds.push(helpers.extractTaskId(withDeps.stdout));

		// Test 1: Basic complexity analysis
		await runTest('Basic complexity analysis', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Check for basic output
			if (!result.stdout.includes('Complexity') && !result.stdout.includes('complexity')) {
				throw new Error('Output does not contain complexity information');
			}
		});

		// Test 2: Complexity analysis with research flag
		await runTest('Complexity analysis with --research', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--research'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Research mode should provide more detailed analysis
			if (!result.stdout.includes('Complexity') && !result.stdout.includes('complexity')) {
				throw new Error('Research mode did not provide complexity analysis');
			}
		});

		// Test 3: Complexity analysis with custom output file
		await runTest('Complexity analysis with custom output', async () => {
			const outputPath = '.taskmaster/reports/custom-complexity.json';
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--output', outputPath],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Verify file was created
			const fullPath = `${testDir}/${outputPath}`;
			if (!helpers.fileExists(fullPath)) {
				throw new Error('Custom output file was not created');
			}
			// Verify it's valid JSON
			const report = helpers.readJson(fullPath);
			if (!report || typeof report !== 'object') {
				throw new Error('Output file is not valid JSON');
			}
		});

		// Test 4: Complexity analysis for specific tasks
		await runTest('Complexity analysis for specific tasks', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--tasks', taskIds.join(',')],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should analyze only specified tasks
			for (const taskId of taskIds) {
				if (!result.stdout.includes(taskId)) {
					throw new Error(`Task ${taskId} not included in analysis`);
				}
			}
		});

		// Test 5: Complexity analysis with custom thresholds
		await runTest('Complexity analysis with custom thresholds', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--low-threshold', '3', '--medium-threshold', '7', '--high-threshold', '10'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Output should reflect custom thresholds
			if (!result.stdout.includes('low') || !result.stdout.includes('medium') || !result.stdout.includes('high')) {
				throw new Error('Custom thresholds not reflected in output');
			}
		});

		// Test 6: Complexity analysis with JSON output format
		await runTest('Complexity analysis with JSON format', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--format', 'json'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Output should be valid JSON
			try {
				const parsed = JSON.parse(result.stdout);
				if (!parsed || typeof parsed !== 'object') {
					throw new Error('Output is not valid JSON object');
				}
			} catch (e) {
				throw new Error('Output is not valid JSON format');
			}
		});

		// Test 7: Complexity analysis with detailed breakdown
		await runTest('Complexity analysis with --detailed flag', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--detailed'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should include detailed breakdown
			const expectedDetails = ['subtasks', 'dependencies', 'description', 'metadata'];
			const foundDetails = expectedDetails.filter(detail => 
				result.stdout.toLowerCase().includes(detail)
			);
			if (foundDetails.length < 2) {
				throw new Error('Detailed breakdown not comprehensive enough');
			}
		});

		// Test 8: Complexity analysis for empty project
		await runTest('Complexity analysis with no tasks', async () => {
			// Create a new temp directory
			const emptyDir = `${testDir}_empty`;
			await helpers.executeCommand('mkdir', ['-p', emptyDir]);
			await helpers.taskMaster('init', ['-y'], { cwd: emptyDir });
			
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[],
				{ cwd: emptyDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should handle empty project gracefully
			if (!result.stdout.includes('No tasks') && !result.stdout.includes('0')) {
				throw new Error('Empty project not handled gracefully');
			}
		});

		// Test 9: Complexity analysis with tag filter
		await runTest('Complexity analysis filtered by tag', async () => {
			// Create tag and tagged task
			await helpers.taskMaster('add-tag', ['complex-tag'], { cwd: testDir });
			const taggedResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Tagged complex task', '--tag', 'complex-tag'],
				{ cwd: testDir }
			);
			const taggedId = helpers.extractTaskId(taggedResult.stdout);
			
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--tag', 'complex-tag'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should only analyze tagged tasks
			if (!result.stdout.includes(taggedId)) {
				throw new Error('Tagged task not included in filtered analysis');
			}
		});

		// Test 10: Complexity analysis with status filter
		await runTest('Complexity analysis filtered by status', async () => {
			// Set one task to completed
			await helpers.taskMaster('set-status', [taskIds[0], 'completed'], { cwd: testDir });
			
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--status', 'pending'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should not include completed task
			if (result.stdout.includes(taskIds[0])) {
				throw new Error('Completed task included in pending-only analysis');
			}
		});

		// Test 11: Generate complexity report command
		await runTest('Generate complexity report', async () => {
			// First run analyze-complexity to generate data
			await helpers.taskMaster(
				'analyze-complexity',
				['--output', '.taskmaster/reports/task-complexity-report.json'],
				{ cwd: testDir }
			);
			
			const result = await helpers.taskMaster(
				'complexity-report',
				[],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should display report
			if (!result.stdout.includes('Complexity Report') && !result.stdout.includes('complexity')) {
				throw new Error('Complexity report not displayed');
			}
		});

		// Test 12: Error handling - invalid threshold values
		await runTest('Error handling - invalid thresholds', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--low-threshold', '-1'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with negative threshold');
			}
		});

		// Test 13: Error handling - invalid output path
		await runTest('Error handling - invalid output path', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--output', '/invalid/path/report.json'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with invalid output path');
			}
		});

		// Test 14: Performance test - large number of tasks
		await runTest('Performance - analyze many tasks', async () => {
			// Create 20 more tasks
			const promises = [];
			for (let i = 0; i < 20; i++) {
				promises.push(
					helpers.taskMaster(
						'add-task',
						['--title', `Performance test task ${i}`],
						{ cwd: testDir }
					)
				);
			}
			await Promise.all(promises);
			
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[],
				{ cwd: testDir }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			// Should complete in reasonable time (< 10 seconds)
			if (duration > 10000) {
				throw new Error(`Analysis took too long: ${duration}ms`);
			}
			logger.info(`Analyzed ~25 tasks in ${duration}ms`);
		});

		// Test 15: Verify complexity scoring algorithm
		await runTest('Verify complexity scoring accuracy', async () => {
			// The complex task with subtasks should have higher score than simple task
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--format', 'json'],
				{ cwd: testDir }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			const analysis = JSON.parse(result.stdout);
			const simpleTask = analysis.tasks?.find(t => t.id === taskIds[0]);
			const complexTask = analysis.tasks?.find(t => t.id === taskIds[1]);
			
			if (!simpleTask || !complexTask) {
				throw new Error('Could not find tasks in analysis');
			}
			
			if (simpleTask.complexity >= complexTask.complexity) {
				throw new Error('Complex task should have higher complexity score than simple task');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Analyze-Complexity Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All analyze-complexity tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'analyze-complexity test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Analyze-complexity test suite failed: ${error.message}`);
	}

	return results;
}