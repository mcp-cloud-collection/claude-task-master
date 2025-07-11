import { mcpTest } from 'mcp-jest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../../..');

// Create test tasks file for testing
const testTasksPath = join(projectRoot, '.taskmaster/test-mcp-tasks.json');
const testTasks = {
	tasks: [
		{
			id: 'mcp-test-001',
			description: 'MCP Test task 1',
			status: 'pending',
			priority: 'high',
			estimatedMinutes: 30,
			actualMinutes: 0,
			dependencies: [],
			tags: ['test'],
			subtasks: [
				{
					id: 'mcp-test-001-1',
					description: 'MCP Test subtask 1.1',
					status: 'pending',
					priority: 'medium',
					estimatedMinutes: 15,
					actualMinutes: 0
				}
			]
		},
		{
			id: 'mcp-test-002',
			description: 'MCP Test task 2',
			status: 'done',
			priority: 'medium',
			estimatedMinutes: 60,
			actualMinutes: 60,
			dependencies: ['mcp-test-001'],
			tags: ['test', 'demo'],
			subtasks: []
		}
	]
};

// Setup test data
fs.mkdirSync(join(projectRoot, '.taskmaster'), { recursive: true });
fs.writeFileSync(testTasksPath, JSON.stringify(testTasks, null, 2));

// Run MCP Jest tests
async function runTests() {
	try {
		const results = await mcpTest(
			{
				command: 'node',
				args: [join(projectRoot, 'mcp-server/server.js')],
				env: process.env
			},
			{
				tools: {
					initialize_project: {
						args: { projectRoot: projectRoot },
						expect: (result) =>
							result.content[0].text.includes(
								'Project initialized successfully'
							)
					},
					get_tasks: [
						{
							name: 'get all tasks with subtasks',
							args: {
								projectRoot: projectRoot,
								file: '.taskmaster/test-mcp-tasks.json',
								withSubtasks: true
							},
							expect: (result) => {
								const text = result.content[0].text;
								return (
									!result.isError &&
									text.includes('2 tasks found') &&
									text.includes('MCP Test task 1') &&
									text.includes('MCP Test task 2') &&
									text.includes('MCP Test subtask 1.1')
								);
							}
						},
						{
							name: 'filter by done status',
							args: {
								projectRoot: projectRoot,
								file: '.taskmaster/test-mcp-tasks.json',
								status: 'done'
							},
							expect: (result) => {
								const text = result.content[0].text;
								return (
									!result.isError &&
									text.includes('1 task found') &&
									text.includes('MCP Test task 2') &&
									!text.includes('MCP Test task 1')
								);
							}
						},
						{
							name: 'handle non-existent file',
							args: {
								projectRoot: projectRoot,
								file: '.taskmaster/non-existent.json'
							},
							expect: (result) =>
								result.isError && result.content[0].text.includes('Error')
						}
					]
				}
			}
		);

		console.log('\nTest Results:');
		console.log('=============');
		console.log(`✅ Passed: ${results.passed}/${results.total}`);

		if (results.failed > 0) {
			console.error(`❌ Failed: ${results.failed}`);
			console.error('\nDetailed Results:');
			console.log(JSON.stringify(results, null, 2));
		}

		// Cleanup
		if (fs.existsSync(testTasksPath)) {
			fs.unlinkSync(testTasksPath);
		}

		// Exit with appropriate code
		process.exit(results.failed > 0 ? 1 : 0);
	} catch (error) {
		console.error('Test execution failed:', error);
		// Cleanup on error
		if (fs.existsSync(testTasksPath)) {
			fs.unlinkSync(testTasksPath);
		}
		process.exit(1);
	}
}

runTests();
