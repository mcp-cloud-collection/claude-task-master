const path = require('path');
const fs = require('fs');
const {
	setupTestEnvironment,
	cleanupTestEnvironment,
	runCommand
} = require('../../helpers/testHelpers');

describe('use-tag command', () => {
	let testDir;
	let tasksPath;

	beforeEach(async () => {
		const setup = await setupTestEnvironment();
		testDir = setup.testDir;
		tasksPath = setup.tasksPath;

		// Create a test project with multiple tags
		const tasksData = {
			tasks: [
				{
					id: 1,
					description: 'Task in master',
					status: 'pending',
					tags: ['master']
				},
				{
					id: 2,
					description: 'Task in feature',
					status: 'pending',
					tags: ['feature']
				},
				{
					id: 3,
					description: 'Task in both',
					status: 'pending',
					tags: ['master', 'feature']
				}
			],
			tags: {
				master: {
					name: 'master',
					description: 'Main development branch'
				},
				feature: {
					name: 'feature',
					description: 'Feature branch'
				},
				release: {
					name: 'release',
					description: 'Release branch'
				}
			},
			activeTag: 'master',
			metadata: {
				nextId: 4
			}
		};
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	});

	afterEach(async () => {
		await cleanupTestEnvironment(testDir);
	});

	test('should switch to an existing tag', async () => {
		const result = await runCommand(['use-tag', 'feature'], testDir);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Successfully switched to tag: feature');

		// Verify the active tag was updated
		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.activeTag).toBe('feature');
	});

	test('should show error when switching to non-existent tag', async () => {
		const result = await runCommand(['use-tag', 'nonexistent'], testDir);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Tag "nonexistent" does not exist');
	});

	test('should switch from feature tag back to master', async () => {
		// First switch to feature
		await runCommand(['use-tag', 'feature'], testDir);

		// Then switch back to master
		const result = await runCommand(['use-tag', 'master'], testDir);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Successfully switched to tag: master');

		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		expect(updatedData.activeTag).toBe('master');
	});

	test('should handle switching to the same tag gracefully', async () => {
		const result = await runCommand(['use-tag', 'master'], testDir);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Already on tag: master');
	});

	test('should work with custom tasks file path', async () => {
		const customTasksPath = path.join(testDir, 'custom-tasks.json');
		fs.copyFileSync(tasksPath, customTasksPath);

		const result = await runCommand(
			['use-tag', 'feature', '-f', customTasksPath],
			testDir
		);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Successfully switched to tag: feature');

		const updatedData = JSON.parse(fs.readFileSync(customTasksPath, 'utf8'));
		expect(updatedData.activeTag).toBe('feature');
	});

	test('should fail when tasks file does not exist', async () => {
		const nonExistentPath = path.join(testDir, 'nonexistent.json');
		const result = await runCommand(
			['use-tag', 'feature', '-f', nonExistentPath],
			testDir
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Tasks file not found');
	});
});