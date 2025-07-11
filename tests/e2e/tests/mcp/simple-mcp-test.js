#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../../..');

// Create test tasks file for testing
const testTasksPath = join(projectRoot, '.taskmaster/test-tasks.json');
const testTasks = {
	tasks: [
		{
			id: 'test-001',
			description: 'Test task 1',
			status: 'pending',
			priority: 'high',
			estimatedMinutes: 30,
			actualMinutes: 0,
			dependencies: [],
			tags: ['test'],
			subtasks: [
				{
					id: 'test-001-1',
					description: 'Test subtask 1.1',
					status: 'pending',
					priority: 'medium',
					estimatedMinutes: 15,
					actualMinutes: 0
				}
			]
		},
		{
			id: 'test-002',
			description: 'Test task 2',
			status: 'done',
			priority: 'medium',
			estimatedMinutes: 60,
			actualMinutes: 60,
			dependencies: ['test-001'],
			tags: ['test', 'demo'],
			subtasks: []
		}
	]
};

async function runTests() {
	console.log('Starting MCP server tests...\n');

	// Setup test data
	fs.mkdirSync(join(projectRoot, '.taskmaster'), { recursive: true });
	fs.writeFileSync(testTasksPath, JSON.stringify(testTasks, null, 2));

	// Create transport by spawning the server
	const transport = new StdioClientTransport({
		command: 'node',
		args: ['mcp-server/server.js'],
		env: process.env,
		cwd: projectRoot
	});

	// Create client
	const client = new Client(
		{
			name: 'test-client',
			version: '1.0.0'
		},
		{
			capabilities: {
				sampling: {}
			}
		}
	);

	let testResults = {
		total: 0,
		passed: 0,
		failed: 0,
		tests: []
	};

	async function runTest(name, testFn) {
		testResults.total++;
		try {
			await testFn();
			testResults.passed++;
			testResults.tests.push({ name, status: 'passed' });
			console.log(`✅ ${name}`);
		} catch (error) {
			testResults.failed++;
			testResults.tests.push({ name, status: 'failed', error: error.message });
			console.error(`❌ ${name}`);
			console.error(`   Error: ${error.message}`);
		}
	}

	try {
		// Connect to server
		await client.connect(transport);
		console.log('Connected to MCP server\n');

		// Test 1: List available tools
		await runTest('List available tools', async () => {
			const tools = await client.listTools();
			if (!tools.tools || tools.tools.length === 0) {
				throw new Error('No tools found');
			}
			const toolNames = tools.tools.map((t) => t.name);
			if (!toolNames.includes('get_tasks')) {
				throw new Error('get_tasks tool not found');
			}
			console.log(`   Found ${tools.tools.length} tools`);
		});

		// Test 2: Initialize project
		await runTest('Initialize project', async () => {
			const result = await client.callTool({
				name: 'initialize_project',
				arguments: {
					projectRoot: projectRoot
				}
			});
			if (
				!result.content[0].text.includes('Project initialized successfully')
			) {
				throw new Error('Project initialization failed');
			}
		});

		// Test 3: Get all tasks
		await runTest('Get all tasks with subtasks', async () => {
			const result = await client.callTool({
				name: 'get_tasks',
				arguments: {
					projectRoot: projectRoot,
					file: '.taskmaster/test-tasks.json',
					withSubtasks: true
				}
			});

			if (result.isError) {
				throw new Error(`Tool returned error: ${result.content[0].text}`);
			}

			const text = result.content[0].text;
			const data = JSON.parse(text);

			if (!data.data || !data.data.tasks) {
				throw new Error('Invalid response format');
			}

			if (data.data.tasks.length !== 2) {
				throw new Error(`Expected 2 tasks, got ${data.data.tasks.length}`);
			}

			const taskDescriptions = data.data.tasks.map((t) => t.description);
			if (
				!taskDescriptions.includes('Test task 1') ||
				!taskDescriptions.includes('Test task 2')
			) {
				throw new Error('Expected tasks not found');
			}

			// Check for subtask
			const task1 = data.data.tasks.find((t) => t.id === 'test-001');
			if (!task1.subtasks || task1.subtasks.length === 0) {
				throw new Error('Subtasks not found');
			}
			if (task1.subtasks[0].description !== 'Test subtask 1.1') {
				throw new Error('Expected subtask not found');
			}
		});

		// Test 4: Filter by status
		await runTest('Filter tasks by done status', async () => {
			const result = await client.callTool({
				name: 'get_tasks',
				arguments: {
					projectRoot: projectRoot,
					file: '.taskmaster/test-tasks.json',
					status: 'done'
				}
			});

			if (result.isError) {
				throw new Error(`Tool returned error: ${result.content[0].text}`);
			}

			const text = result.content[0].text;
			const data = JSON.parse(text);

			if (!data.data || !data.data.tasks) {
				throw new Error('Invalid response format');
			}

			if (data.data.tasks.length !== 1) {
				throw new Error(
					`Expected 1 task with done status, got ${data.data.tasks.length}`
				);
			}

			const task = data.data.tasks[0];
			if (task.description !== 'Test task 2') {
				throw new Error(`Expected 'Test task 2', got '${task.description}'`);
			}
			if (task.status !== 'done') {
				throw new Error(`Expected status 'done', got '${task.status}'`);
			}
		});

		// Test 5: Handle non-existent file
		await runTest('Handle non-existent file gracefully', async () => {
			const result = await client.callTool({
				name: 'get_tasks',
				arguments: {
					projectRoot: projectRoot,
					file: '.taskmaster/non-existent.json'
				}
			});

			if (!result.isError) {
				throw new Error('Expected error for non-existent file');
			}
			if (!result.content[0].text.includes('Error')) {
				throw new Error('Expected error message');
			}
		});
	} catch (error) {
		console.error('\nConnection error:', error.message);
		testResults.failed = testResults.total;
	} finally {
		// Clean up
		await client.close();
		if (fs.existsSync(testTasksPath)) {
			fs.unlinkSync(testTasksPath);
		}

		// Print summary
		console.log('\n' + '='.repeat(50));
		console.log('Test Summary:');
		console.log(`Total: ${testResults.total}`);
		console.log(`Passed: ${testResults.passed}`);
		console.log(`Failed: ${testResults.failed}`);
		console.log('='.repeat(50));

		// Exit with appropriate code
		process.exit(testResults.failed > 0 ? 1 : 0);
	}
}

runTests().catch(console.error);
