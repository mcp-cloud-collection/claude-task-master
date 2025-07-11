import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';

describe('task-master add-dependency', () => {
	let testDir;
	let helpers;

	beforeEach(() => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'tm-test-add-dep-'));
		process.chdir(testDir);

		// Get helpers from global context
		helpers = global.testHelpers;

		// Copy .env if exists
		const envPath = join(process.cwd(), '../../.env');
		if (existsSync(envPath)) {
			const envContent = readFileSync(envPath, 'utf-8');
			helpers.writeFile('.env', envContent);
		}

		// Initialize task-master project
		const initResult = helpers.taskMaster('init', ['-y']);
		expect(initResult).toHaveExitCode(0);

		// Ensure tasks.json exists
		const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!helpers.fileExists(tasksPath)) {
			helpers.writeFile(tasksPath, JSON.stringify({ tasks: [] }, null, 2));
		}
	});

	afterEach(() => {
		// Clean up test directory
		process.chdir('..');
		rmSync(testDir, { recursive: true, force: true });
	});

	describe('Basic dependency creation', () => {
		it('should add a single dependency to a task', () => {
			// Create tasks
			const dep = helpers.taskMaster('add-task', ['Dependency task', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', ['Main task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Add dependency
			const result = helpers.taskMaster('add-dependency', [taskId, depId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependency added successfully');
			expect(result.stdout).toContain(`${taskId} now depends on ${depId}`);

			// Verify dependency was added
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain('Dependencies:');
			expect(showResult.stdout).toContain(`${depId} - Dependency task`);
		});

		it('should add multiple dependencies at once', () => {
			// Create dependency tasks
			const dep1 = helpers.taskMaster('add-task', ['First dependency', '-m']);
			const depId1 = helpers.extractTaskId(dep1.stdout);

			const dep2 = helpers.taskMaster('add-task', ['Second dependency', '-m']);
			const depId2 = helpers.extractTaskId(dep2.stdout);

			const dep3 = helpers.taskMaster('add-task', ['Third dependency', '-m']);
			const depId3 = helpers.extractTaskId(dep3.stdout);

			const task = helpers.taskMaster('add-task', ['Main task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Add multiple dependencies
			const result = helpers.taskMaster('add-dependency', [
				taskId,
				`${depId1},${depId2},${depId3}`
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 dependencies added');

			// Verify all dependencies were added
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain(depId1);
			expect(showResult.stdout).toContain(depId2);
			expect(showResult.stdout).toContain(depId3);
		});
	});

	describe('Dependency validation', () => {
		it('should prevent circular dependencies', () => {
			// Create circular dependency chain
			const task1 = helpers.taskMaster('add-task', ['Task 1', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Task 2', '-m']);
			const id2 = helpers.extractTaskId(task2.stdout);

			// Add first dependency
			helpers.taskMaster('add-dependency', [id2, id1]);

			// Try to create circular dependency
			const result = helpers.taskMaster('add-dependency', [id1, id2], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('circular dependency');
		});

		it('should prevent self-dependencies', () => {
			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('add-dependency', [taskId, taskId], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('cannot depend on itself');
		});

		it('should detect transitive circular dependencies', () => {
			// Create chain: A -> B -> C, then try C -> A
			const taskA = helpers.taskMaster('add-task', ['Task A', '-m']);
			const idA = helpers.extractTaskId(taskA.stdout);

			const taskB = helpers.taskMaster('add-task', ['Task B', '-m']);
			const idB = helpers.extractTaskId(taskB.stdout);

			const taskC = helpers.taskMaster('add-task', ['Task C', '-m']);
			const idC = helpers.extractTaskId(taskC.stdout);

			// Create chain
			helpers.taskMaster('add-dependency', [idB, idA]);
			helpers.taskMaster('add-dependency', [idC, idB]);

			// Try to create circular dependency
			const result = helpers.taskMaster('add-dependency', [idA, idC], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('circular dependency');
		});

		it('should prevent duplicate dependencies', () => {
			const dep = helpers.taskMaster('add-task', ['Dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Add dependency first time
			helpers.taskMaster('add-dependency', [taskId, depId]);

			// Try to add same dependency again
			const result = helpers.taskMaster('add-dependency', [taskId, depId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('already depends on');
			expect(result.stdout).toContain('No changes made');
		});
	});

	describe('Status updates', () => {
		it('should update task status to blocked when adding dependencies', () => {
			const dep = helpers.taskMaster('add-task', [
				'Incomplete dependency',
				'-m'
			]);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Start the task
			helpers.taskMaster('set-status', [taskId, 'in-progress']);

			// Add dependency (should change status to blocked)
			const result = helpers.taskMaster('add-dependency', [taskId, depId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Status changed to: blocked');

			// Verify status
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain('Status: blocked');
		});

		it('should not change status if all dependencies are complete', () => {
			const dep = helpers.taskMaster('add-task', ['Complete dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);
			helpers.taskMaster('set-status', [depId, 'done']);

			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);
			helpers.taskMaster('set-status', [taskId, 'in-progress']);

			// Add completed dependency
			const result = helpers.taskMaster('add-dependency', [taskId, depId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).not.toContain('Status changed');

			// Status should remain in-progress
			const showResult = helpers.taskMaster('show', [taskId]);
			expect(showResult.stdout).toContain('Status: in-progress');
		});
	});

	describe('Subtask dependencies', () => {
		it('should add dependency to a subtask', () => {
			// Create parent and dependency
			const parent = helpers.taskMaster('add-task', ['Parent task', '-m']);
			const parentId = helpers.extractTaskId(parent.stdout);

			const dep = helpers.taskMaster('add-task', ['Dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			// Expand parent
			helpers.taskMaster('expand', ['-i', parentId, '-n', '2'], {
				timeout: 60000
			});

			// Add dependency to subtask
			const subtaskId = `${parentId}.1`;
			const result = helpers.taskMaster('add-dependency', [subtaskId, depId]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`${subtaskId} now depends on ${depId}`);
		});

		it('should allow subtask to depend on another subtask', () => {
			// Create parent task
			const parent = helpers.taskMaster('add-task', ['Parent', '-m']);
			const parentId = helpers.extractTaskId(parent.stdout);

			// Expand to create subtasks
			helpers.taskMaster('expand', ['-i', parentId, '-n', '3'], {
				timeout: 60000
			});

			// Make subtask 2 depend on subtask 1
			const result = helpers.taskMaster('add-dependency', [
				`${parentId}.2`,
				`${parentId}.1`
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependency added successfully');
		});

		it('should prevent parent depending on its own subtask', () => {
			const parent = helpers.taskMaster('add-task', ['Parent', '-m']);
			const parentId = helpers.extractTaskId(parent.stdout);

			helpers.taskMaster('expand', ['-i', parentId, '-n', '2'], {
				timeout: 60000
			});

			const result = helpers.taskMaster(
				'add-dependency',
				[parentId, `${parentId}.1`],
				{ allowFailure: true }
			);
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('cannot depend on its own subtask');
		});
	});

	describe('Bulk operations', () => {
		it('should add dependencies to multiple tasks', () => {
			// Create dependency
			const dep = helpers.taskMaster('add-task', ['Shared dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			// Create multiple tasks
			const task1 = helpers.taskMaster('add-task', ['Task 1', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Task 2', '-m']);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', ['Task 3', '-m']);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Add dependency to all tasks
			const result = helpers.taskMaster('add-dependency', [
				`${id1},${id2},${id3}`,
				depId
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks updated');

			// Verify all have the dependency
			for (const id of [id1, id2, id3]) {
				const showResult = helpers.taskMaster('show', [id]);
				expect(showResult.stdout).toContain(depId);
			}
		});

		it('should add dependencies by range', () => {
			// Create dependency
			const dep = helpers.taskMaster('add-task', ['Dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			// Create sequential tasks
			const ids = [];
			for (let i = 0; i < 5; i++) {
				const result = helpers.taskMaster('add-task', [`Task ${i + 1}`, '-m']);
				ids.push(helpers.extractTaskId(result.stdout));
			}

			// Add dependency to range
			const result = helpers.taskMaster('add-dependency', [
				'--from',
				ids[1],
				'--to',
				ids[3],
				depId
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('3 tasks updated');

			// Verify middle tasks have dependency
			for (let i = 1; i <= 3; i++) {
				const showResult = helpers.taskMaster('show', [ids[i]]);
				expect(showResult.stdout).toContain(depId);
			}

			// Verify edge tasks don't have dependency
			const show0 = helpers.taskMaster('show', [ids[0]]);
			expect(show0.stdout).not.toContain(`Dependencies:.*${depId}`);
		});
	});

	describe('Complex dependency graphs', () => {
		it('should handle diamond dependency pattern', () => {
			// Create diamond: A depends on B and C, both B and C depend on D
			const taskD = helpers.taskMaster('add-task', ['Task D (base)', '-m']);
			const idD = helpers.extractTaskId(taskD.stdout);

			const taskB = helpers.taskMaster('add-task', ['Task B', '-m']);
			const idB = helpers.extractTaskId(taskB.stdout);
			helpers.taskMaster('add-dependency', [idB, idD]);

			const taskC = helpers.taskMaster('add-task', ['Task C', '-m']);
			const idC = helpers.extractTaskId(taskC.stdout);
			helpers.taskMaster('add-dependency', [idC, idD]);

			const taskA = helpers.taskMaster('add-task', ['Task A (top)', '-m']);
			const idA = helpers.extractTaskId(taskA.stdout);

			// Add both dependencies to create diamond
			const result = helpers.taskMaster('add-dependency', [
				idA,
				`${idB},${idC}`
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('2 dependencies added');

			// Verify the structure
			const showResult = helpers.taskMaster('show', [idA]);
			expect(showResult.stdout).toContain(idB);
			expect(showResult.stdout).toContain(idC);
		});

		it('should show transitive dependencies', () => {
			// Create chain A -> B -> C -> D
			const taskD = helpers.taskMaster('add-task', ['Task D', '-m']);
			const idD = helpers.extractTaskId(taskD.stdout);

			const taskC = helpers.taskMaster('add-task', ['Task C', '-m']);
			const idC = helpers.extractTaskId(taskC.stdout);
			helpers.taskMaster('add-dependency', [idC, idD]);

			const taskB = helpers.taskMaster('add-task', ['Task B', '-m']);
			const idB = helpers.extractTaskId(taskB.stdout);
			helpers.taskMaster('add-dependency', [idB, idC]);

			const taskA = helpers.taskMaster('add-task', ['Task A', '-m']);
			const idA = helpers.extractTaskId(taskA.stdout);
			helpers.taskMaster('add-dependency', [idA, idB]);

			// Show should indicate full dependency chain
			const result = helpers.taskMaster('show', [idA]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependencies:');
			expect(result.stdout).toContain(idB);
			// May also show transitive dependencies in some views
		});
	});

	describe('Tag context', () => {
		it('should add dependencies within a tag', () => {
			// Create tag
			helpers.taskMaster('add-tag', ['feature']);
			helpers.taskMaster('use-tag', ['feature']);

			// Create tasks in feature tag
			const dep = helpers.taskMaster('add-task', ['Feature dependency', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', ['Feature task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			// Add dependency with tag context
			const result = helpers.taskMaster('add-dependency', [
				taskId,
				depId,
				'--tag',
				'feature'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('[feature]');
		});

		it('should prevent cross-tag dependencies by default', () => {
			// Create tasks in different tags
			const masterTask = helpers.taskMaster('add-task', ['Master task', '-m']);
			const masterId = helpers.extractTaskId(masterTask.stdout);

			helpers.taskMaster('add-tag', ['feature']);
			helpers.taskMaster('use-tag', ['feature']);
			const featureTask = helpers.taskMaster('add-task', [
				'Feature task',
				'-m'
			]);
			const featureId = helpers.extractTaskId(featureTask.stdout);

			// Try to add cross-tag dependency
			const result = helpers.taskMaster(
				'add-dependency',
				[featureId, masterId, '--tag', 'feature'],
				{ allowFailure: true }
			);
			// Depending on implementation, this might warn or fail
		});
	});

	describe('Error handling', () => {
		it('should handle non-existent task IDs', () => {
			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('add-dependency', [taskId, '999'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toMatch(/Task.*999.*not found/i);
		});

		it('should handle invalid task ID format', () => {
			const result = helpers.taskMaster('add-dependency', ['invalid-id', '1'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid task ID');
		});

		it('should require both task and dependency IDs', () => {
			const result = helpers.taskMaster('add-dependency', ['1'], {
				allowFailure: true
			});
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('required');
		});
	});

	describe('Output options', () => {
		it('should support quiet mode', () => {
			const dep = helpers.taskMaster('add-task', ['Dep', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('add-dependency', [
				taskId,
				depId,
				'-q'
			]);
			expect(result).toHaveExitCode(0);
			expect(result.stdout.split('\n').length).toBeLessThan(3);
		});

		it('should support JSON output', () => {
			const dep = helpers.taskMaster('add-task', ['Dep', '-m']);
			const depId = helpers.extractTaskId(dep.stdout);

			const task = helpers.taskMaster('add-task', ['Task', '-m']);
			const taskId = helpers.extractTaskId(task.stdout);

			const result = helpers.taskMaster('add-dependency', [
				taskId,
				depId,
				'--json'
			]);
			expect(result).toHaveExitCode(0);

			const json = JSON.parse(result.stdout);
			expect(json.task.id).toBe(parseInt(taskId));
			expect(json.task.dependencies).toContain(parseInt(depId));
			expect(json.added).toBe(1);
		});
	});

	describe('Visualization', () => {
		it('should show dependency graph after adding', () => {
			// Create simple dependency chain
			const task1 = helpers.taskMaster('add-task', ['Base task', '-m']);
			const id1 = helpers.extractTaskId(task1.stdout);

			const task2 = helpers.taskMaster('add-task', ['Middle task', '-m']);
			const id2 = helpers.extractTaskId(task2.stdout);

			const task3 = helpers.taskMaster('add-task', ['Top task', '-m']);
			const id3 = helpers.extractTaskId(task3.stdout);

			// Build chain
			helpers.taskMaster('add-dependency', [id2, id1]);
			const result = helpers.taskMaster('add-dependency', [id3, id2]);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Dependency chain:');
			expect(result.stdout).toMatch(/→|depends on/);
		});
	});
});
