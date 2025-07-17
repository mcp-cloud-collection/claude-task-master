import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock console methods
jest.mock('console', () => ({
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
}));

describe('Kiro Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('mcp.json')) {
				return JSON.stringify({ mcpServers: {} }, null, 2);
			}
			return '{}';
		});
		jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
		jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up the temporary directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			console.error(`Error cleaning up: ${err.message}`);
		}
	});

	// Test function that simulates the createProjectStructure behavior for Kiro files
	function mockCreateKiroStructure() {
		// Create main .kiro directory
		fs.mkdirSync(path.join(tempDir, '.kiro'), { recursive: true });

		// Create settings directory
		fs.mkdirSync(path.join(tempDir, '.kiro', 'settings'), { recursive: true });

		// Create steering directory
		fs.mkdirSync(path.join(tempDir, '.kiro', 'steering'), { recursive: true });

		// Create MCP config file (mcp.json in settings)
		fs.writeFileSync(
			path.join(tempDir, '.kiro', 'settings', 'mcp.json'),
			JSON.stringify({ mcpServers: {} }, null, 2)
		);

		// Create kiro rule files in steering directory
		fs.writeFileSync(
			path.join(tempDir, '.kiro', 'steering', 'kiro_rules.md'),
			'# Kiro Rules\n\nKiro-specific rules and instructions.'
		);
		fs.writeFileSync(
			path.join(tempDir, '.kiro', 'steering', 'dev_workflow.md'),
			'# Development Workflow\n\nDevelopment workflow instructions.'
		);
		fs.writeFileSync(
			path.join(tempDir, '.kiro', 'steering', 'self_improve.md'),
			'# Self Improvement\n\nSelf improvement guidelines.'
		);
		fs.writeFileSync(
			path.join(tempDir, '.kiro', 'steering', 'taskmaster.md'),
			'# Task Master\n\nTask Master integration instructions.'
		);
	}

	test('creates all required .kiro directories', () => {
		// Act
		mockCreateKiroStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.kiro'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.kiro', 'settings'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.kiro', 'steering'), {
			recursive: true
		});
	});

	test('creates Kiro mcp.json with mcpServers format', () => {
		// Act
		mockCreateKiroStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kiro', 'settings', 'mcp.json'),
			JSON.stringify({ mcpServers: {} }, null, 2)
		);
	});

	test('creates rule files in steering directory', () => {
		// Act
		mockCreateKiroStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kiro', 'steering', 'kiro_rules.md'),
			'# Kiro Rules\n\nKiro-specific rules and instructions.'
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kiro', 'steering', 'dev_workflow.md'),
			'# Development Workflow\n\nDevelopment workflow instructions.'
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kiro', 'steering', 'self_improve.md'),
			'# Self Improvement\n\nSelf improvement guidelines.'
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.kiro', 'steering', 'taskmaster.md'),
			'# Task Master\n\nTask Master integration instructions.'
		);
	});
});