/**
 * Task Master Extension - Simplified Architecture
 * Only using patterns where they add real value
 */

import * as vscode from 'vscode';
import { ConfigService } from './services/config-service';
import { PollingService } from './services/polling-service';
import { createPollingStrategy } from './services/polling-strategies';
import { TaskRepository } from './services/task-repository';
import { WebviewManager } from './services/webview-manager';
import { EventEmitter } from './utils/event-emitter';
import { ExtensionLogger } from './utils/logger';
import {
	MCPClientManager,
	createMCPConfigFromSettings
} from './utils/mcpClient';
import { TaskMasterApi } from './utils/task-master-api';

let logger: ExtensionLogger;
let mcpClient: MCPClientManager;
let api: TaskMasterApi;
let repository: TaskRepository;
let pollingService: PollingService;
let webviewManager: WebviewManager;
let events: EventEmitter;
let configService: ConfigService;

export async function activate(context: vscode.ExtensionContext) {
	try {
		// Initialize logger (needed to prevent MCP stdio issues)
		logger = ExtensionLogger.getInstance();
		logger.log('🎉 Task Master Extension activating...');

		// Simple event emitter for webview communication
		events = new EventEmitter();

		// Initialize MCP client
		mcpClient = new MCPClientManager(createMCPConfigFromSettings());

		// Initialize API
		api = new TaskMasterApi(mcpClient);

		// Repository with caching (actually useful for performance)
		repository = new TaskRepository(api, logger);

		// Config service for Task Master config.json
		configService = new ConfigService(logger);

		// Polling service with strategy pattern (makes sense for different polling behaviors)
		const strategy = createPollingStrategy(
			vscode.workspace.getConfiguration('taskmaster')
		);
		pollingService = new PollingService(repository, strategy, logger);

		// Webview manager (cleaner than global panel array) - create before connection
		webviewManager = new WebviewManager(context, repository, events, logger);
		webviewManager.setConfigService(configService);

		// Initialize connection
		await initializeConnection();

		// Set MCP client and API after connection
		webviewManager.setMCPClient(mcpClient);
		webviewManager.setApi(api);

		// Register commands
		registerCommands(context);

		// Handle polling lifecycle
		events.on('webview:opened', () => {
			if (webviewManager.getPanelCount() === 1) {
				pollingService.start();
			}
		});

		events.on('webview:closed', () => {
			if (webviewManager.getPanelCount() === 0) {
				pollingService.stop();
			}
		});

		// Forward repository updates to webviews
		repository.on('tasks:updated', (tasks) => {
			webviewManager.broadcast('tasksUpdated', { tasks, source: 'polling' });
		});

		logger.log('✅ Task Master Extension activated');
	} catch (error) {
		logger?.error('Failed to activate', error);
		vscode.window.showErrorMessage(
			`Failed to activate Task Master: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

async function initializeConnection() {
	try {
		logger.log('🔗 Connecting to Task Master...');

		// Notify webviews that we're connecting
		if (webviewManager) {
			webviewManager.broadcast('connectionStatus', {
				isConnected: false,
				status: 'Connecting...'
			});
		}

		await mcpClient.connect();

		const testResult = await api.testConnection();

		if (testResult.success) {
			logger.log('✅ Connected to Task Master');
			vscode.window.showInformationMessage('Task Master connected!');

			// Notify webviews that we're connected
			if (webviewManager) {
				webviewManager.broadcast('connectionStatus', {
					isConnected: true,
					status: 'Connected'
				});
			}
		} else {
			throw new Error(testResult.error || 'Connection test failed');
		}
	} catch (error) {
		logger.error('Connection failed', error);

		// Notify webviews that connection failed
		if (webviewManager) {
			webviewManager.broadcast('connectionStatus', {
				isConnected: false,
				status: 'Disconnected'
			});
		}

		handleConnectionError(error);
	}
}

function handleConnectionError(error: any) {
	const message = error instanceof Error ? error.message : 'Unknown error';

	if (message.includes('ENOENT') && message.includes('npx')) {
		vscode.window
			.showWarningMessage(
				'Task Master: npx not found. Please ensure Node.js is installed.',
				'Open Settings'
			)
			.then((action) => {
				if (action === 'Open Settings') {
					vscode.commands.executeCommand(
						'workbench.action.openSettings',
						'@ext:taskr taskmaster'
					);
				}
			});
	} else {
		vscode.window.showWarningMessage(
			`Task Master connection failed: ${message}`
		);
	}
}

function registerCommands(context: vscode.ExtensionContext) {
	// Main command
	context.subscriptions.push(
		vscode.commands.registerCommand('taskr.showKanbanBoard', async () => {
			await webviewManager.createOrShowPanel();
		})
	);

	// Utility commands
	context.subscriptions.push(
		vscode.commands.registerCommand('taskr.refreshTasks', async () => {
			await repository.refresh();
			vscode.window.showInformationMessage('Tasks refreshed!');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('taskr.openSettings', () => {
			vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'@ext:taskr taskmaster'
			);
		})
	);
}

export function deactivate() {
	logger?.log('👋 Task Master Extension deactivating...');
	pollingService?.stop();
	webviewManager?.dispose();
	api?.destroy();
	mcpClient?.disconnect();
}
