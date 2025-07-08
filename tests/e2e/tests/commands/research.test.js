/**
 * Comprehensive E2E tests for research command
 * Tests all aspects of AI-powered research functionality
 */

export default async function testResearch(logger, helpers, context) {
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
		logger.info('Starting comprehensive research tests...');

		// Test 1: Basic research on a topic
		await runTest('Basic research query', async () => {
			const result = await helpers.taskMaster(
				'research',
				['What are the best practices for implementing JWT authentication in Node.js?'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check for relevant research output
			const output = result.stdout.toLowerCase();
			if (!output.includes('jwt') || !output.includes('authentication')) {
				throw new Error('Research output does not contain expected keywords');
			}
			
			// Should provide actionable information
			const hasActionableInfo = output.includes('implement') || 
			                         output.includes('use') || 
			                         output.includes('practice') ||
			                         output.includes('security');
			if (!hasActionableInfo) {
				throw new Error('Research output lacks actionable information');
			}
		});

		// Test 2: Research with specific context
		await runTest('Research with project context', async () => {
			// Create a task to provide context
			const taskResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Implement user authentication', '--description', 'Need to add secure login to our Express.js API'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(taskResult.stdout);
			
			const result = await helpers.taskMaster(
				'research',
				['--task', taskId, 'Compare bcrypt vs argon2 for password hashing'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should mention both technologies
			const output = result.stdout.toLowerCase();
			if (!output.includes('bcrypt') || !output.includes('argon2')) {
				throw new Error('Research did not compare both technologies');
			}
			
			// Should relate to the task context
			if (!output.includes('password') || !output.includes('hash')) {
				throw new Error('Research not relevant to password hashing');
			}
		});

		// Test 3: Research with output format options
		await runTest('Research with markdown output', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--format', 'markdown', 'How to implement rate limiting in REST APIs?'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Check for markdown formatting
			const hasMarkdown = result.stdout.includes('#') || 
			                   result.stdout.includes('*') || 
			                   result.stdout.includes('-') ||
			                   result.stdout.includes('```');
			if (!hasMarkdown) {
				throw new Error('Output does not appear to be in markdown format');
			}
		});

		// Test 4: Research with depth parameter
		await runTest('Research with depth control', async () => {
			const shallowResult = await helpers.taskMaster(
				'research',
				['--depth', 'shallow', 'React state management options'],
				{ cwd: testDir, timeout: 120000 }
			);
			
			const deepResult = await helpers.taskMaster(
				'research',
				['--depth', 'deep', 'React state management options'],
				{ cwd: testDir, timeout: 180000 }
			);
			
			if (shallowResult.exitCode !== 0 || deepResult.exitCode !== 0) {
				throw new Error('Research with depth parameter failed');
			}
			
			// Deep research should provide more content
			if (deepResult.stdout.length <= shallowResult.stdout.length) {
				throw new Error('Deep research did not provide more detailed information');
			}
			
			// Both should mention state management solutions
			const solutions = ['redux', 'context', 'mobx', 'zustand', 'recoil'];
			const shallowMentions = solutions.filter(s => shallowResult.stdout.toLowerCase().includes(s)).length;
			const deepMentions = solutions.filter(s => deepResult.stdout.toLowerCase().includes(s)).length;
			
			if (deepMentions <= shallowMentions) {
				throw new Error('Deep research should cover more solutions');
			}
		});

		// Test 5: Research for multiple tasks
		await runTest('Research across multiple tasks', async () => {
			// Create related tasks
			const task1 = await helpers.taskMaster(
				'add-task',
				['--title', 'Setup database connection'],
				{ cwd: testDir }
			);
			const taskId1 = helpers.extractTaskId(task1.stdout);
			
			const task2 = await helpers.taskMaster(
				'add-task',
				['--title', 'Implement caching layer'],
				{ cwd: testDir }
			);
			const taskId2 = helpers.extractTaskId(task2.stdout);
			
			const result = await helpers.taskMaster(
				'research',
				['--tasks', `${taskId1},${taskId2}`, 'Best practices for database connection pooling and Redis caching'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should cover both topics
			const output = result.stdout.toLowerCase();
			if (!output.includes('database') || !output.includes('connection')) {
				throw new Error('Research did not cover database connections');
			}
			if (!output.includes('redis') || !output.includes('cach')) {
				throw new Error('Research did not cover caching');
			}
		});

		// Test 6: Research with source preferences
		await runTest('Research with source preferences', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--sources', 'official-docs,stackoverflow', 'How to use React hooks effectively?'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should focus on practical examples
			const output = result.stdout.toLowerCase();
			if (!output.includes('hook') || !output.includes('react')) {
				throw new Error('Research not relevant to React hooks');
			}
		});

		// Test 7: Research with language/framework context
		await runTest('Research with technology context', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--context', 'python,django', 'How to optimize database queries?'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should be Python/Django specific
			const output = result.stdout.toLowerCase();
			if (!output.includes('django') || !output.includes('orm') || !output.includes('queryset')) {
				throw new Error('Research not specific to Django context');
			}
		});

		// Test 8: Research error handling - empty query
		await runTest('Error handling - empty query', async () => {
			const result = await helpers.taskMaster(
				'research',
				[''],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with empty query');
			}
		});

		// Test 9: Research with time constraints
		await runTest('Research with recency filter', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--since', '2023', 'Latest JavaScript features and ES2024 updates'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should mention recent features
			const output = result.stdout.toLowerCase();
			const recentFeatures = ['es2023', 'es2024', '2023', '2024', 'latest', 'recent'];
			const mentionsRecent = recentFeatures.some(feature => output.includes(feature));
			
			if (!mentionsRecent) {
				throw new Error('Research did not focus on recent information');
			}
		});

		// Test 10: Research with comparison request
		await runTest('Research comparison analysis', async () => {
			const result = await helpers.taskMaster(
				'research',
				['Compare REST vs GraphQL vs gRPC for microservices communication'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should mention all three technologies
			const output = result.stdout.toLowerCase();
			if (!output.includes('rest') || !output.includes('graphql') || !output.includes('grpc')) {
				throw new Error('Research did not compare all three technologies');
			}
			
			// Should include pros/cons or comparison points
			const hasComparison = output.includes('advantage') || 
			                     output.includes('disadvantage') || 
			                     output.includes('pros') || 
			                     output.includes('cons') ||
			                     output.includes('better') ||
			                     output.includes('when to use');
			if (!hasComparison) {
				throw new Error('Research lacks comparative analysis');
			}
		});

		// Test 11: Research with code examples request
		await runTest('Research with code examples', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--include-examples', 'How to implement a singleton pattern in TypeScript?'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should include code blocks
			if (!result.stdout.includes('```') && !result.stdout.includes('class') && !result.stdout.includes('function')) {
				throw new Error('Research did not include code examples');
			}
			
			// Should be TypeScript specific
			const output = result.stdout.toLowerCase();
			if (!output.includes('typescript') && !output.includes('private constructor')) {
				throw new Error('Examples not specific to TypeScript');
			}
		});

		// Test 12: Research for architecture decisions
		await runTest('Research for architecture decisions', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--type', 'architecture', 'Microservices vs monolithic architecture for a startup'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should provide architectural insights
			const output = result.stdout.toLowerCase();
			const archKeywords = ['scalability', 'deployment', 'complexity', 'team size', 'maintenance', 'cost'];
			const mentionedKeywords = archKeywords.filter(keyword => output.includes(keyword)).length;
			
			if (mentionedKeywords < 3) {
				throw new Error('Research lacks architectural considerations');
			}
		});

		// Test 13: Research with tag context
		await runTest('Research within tag context', async () => {
			// Create tag and tagged tasks
			await helpers.taskMaster('add-tag', ['security-research'], { cwd: testDir });
			
			const result = await helpers.taskMaster(
				'research',
				['--tag', 'security-research', 'OWASP top 10 vulnerabilities and mitigation strategies'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should focus on security
			const output = result.stdout.toLowerCase();
			const securityTerms = ['vulnerability', 'security', 'attack', 'protection', 'owasp', 'mitigation'];
			const mentionedTerms = securityTerms.filter(term => output.includes(term)).length;
			
			if (mentionedTerms < 4) {
				throw new Error('Research not focused on security topics');
			}
		});

		// Test 14: Research performance with complex query
		await runTest('Performance - complex research query', async () => {
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'research',
				['Comprehensive guide to building a scalable real-time chat application with WebSockets, including architecture, database design, message queuing, and deployment strategies'],
				{ cwd: testDir, timeout: 180000 }
			);
			const duration = Date.now() - startTime;
			
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			logger.info(`Complex research completed in ${duration}ms`);
			
			// Should cover all requested topics
			const output = result.stdout.toLowerCase();
			const topics = ['websocket', 'architecture', 'database', 'queue', 'deployment', 'scalab'];
			const coveredTopics = topics.filter(topic => output.includes(topic)).length;
			
			if (coveredTopics < 4) {
				throw new Error('Complex research did not cover all requested topics');
			}
		});

		// Test 15: Research with export option (preparing for research-save)
		await runTest('Research with export preparation', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--prepare-export', 'Best practices for API versioning'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}
			
			// Should indicate export readiness
			if (!result.stdout.includes('API') || !result.stdout.includes('version')) {
				throw new Error('Research content not relevant to query');
			}
			
			// Check if research is structured for saving
			const hasStructure = result.stdout.includes('#') || 
			                    result.stdout.includes('##') || 
			                    result.stdout.includes('1.') ||
			                    result.stdout.includes('*');
			if (!hasStructure) {
				throw new Error('Research not well-structured for export');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(t => t.status === 'passed').length;
		const failedTests = results.tests.filter(t => t.status === 'failed').length;

		logger.info('\n=== Research Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All research tests passed!');
		}

	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'research test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Research test suite failed: ${error.message}`);
	}

	return results;
}