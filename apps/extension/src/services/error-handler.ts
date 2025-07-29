/**
 * Error Handler Service
 * Centralized error handling with categorization and recovery strategies
 */

import * as vscode from 'vscode';
import type { ExtensionLogger } from '../utils/logger';

export enum ErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum ErrorCategory {
	MCP_CONNECTION = 'mcp_connection',
	CONFIGURATION = 'configuration',
	TASK_LOADING = 'task_loading',
	NETWORK = 'network',
	INTERNAL = 'internal'
}

export interface ErrorContext {
	category: ErrorCategory;
	severity: ErrorSeverity;
	message: string;
	originalError?: Error | unknown;
	operation?: string;
	taskId?: string;
	isRecoverable?: boolean;
	suggestedActions?: string[];
}

export class ErrorHandler {
	private errorLog: Map<string, ErrorContext> = new Map();
	private errorId = 0;

	constructor(private logger: ExtensionLogger) {}

	/**
	 * Handle an error with appropriate logging and user notification
	 */
	handleError(context: ErrorContext): string {
		const errorId = `error_${++this.errorId}`;
		this.errorLog.set(errorId, context);

		// Log to extension logger
		this.logError(context);

		// Show user notification if appropriate
		this.notifyUser(context);

		return errorId;
	}

	/**
	 * Log error based on severity
	 */
	private logError(context: ErrorContext): void {
		const logMessage = `[${context.category}] ${context.message}`;
		const details = {
			operation: context.operation,
			taskId: context.taskId,
			error: context.originalError
		};

		switch (context.severity) {
			case ErrorSeverity.CRITICAL:
			case ErrorSeverity.HIGH:
				this.logger.error(logMessage, details);
				break;
			case ErrorSeverity.MEDIUM:
				this.logger.warn(logMessage, details);
				break;
			case ErrorSeverity.LOW:
				this.logger.debug(logMessage, details);
				break;
		}
	}

	/**
	 * Show user notification based on severity and category
	 */
	private notifyUser(context: ErrorContext): void {
		// Don't show low severity errors to users
		if (context.severity === ErrorSeverity.LOW) {
			return;
		}

		// Determine notification type
		const actions = context.suggestedActions || [];

		switch (context.severity) {
			case ErrorSeverity.CRITICAL:
				vscode.window
					.showErrorMessage(`Task Master: ${context.message}`, ...actions)
					.then((action) => {
						if (action) {
							this.handleUserAction(action, context);
						}
					});
				break;

			case ErrorSeverity.HIGH:
				if (context.category === ErrorCategory.MCP_CONNECTION) {
					vscode.window
						.showWarningMessage(
							`Task Master: ${context.message}`,
							'Retry',
							'Settings'
						)
						.then((action) => {
							if (action === 'Retry') {
								vscode.commands.executeCommand('taskr.reconnect');
							} else if (action === 'Settings') {
								vscode.commands.executeCommand('taskr.openSettings');
							}
						});
				} else {
					vscode.window.showWarningMessage(`Task Master: ${context.message}`);
				}
				break;

			case ErrorSeverity.MEDIUM:
				// Only show medium errors for important categories
				if (
					[ErrorCategory.CONFIGURATION, ErrorCategory.TASK_LOADING].includes(
						context.category
					)
				) {
					vscode.window.showInformationMessage(
						`Task Master: ${context.message}`
					);
				}
				break;
		}
	}

	/**
	 * Handle user action from notification
	 */
	private handleUserAction(action: string, context: ErrorContext): void {
		this.logger.debug(`User selected action: ${action}`, {
			errorContext: context
		});
		// Action handling would be implemented based on specific needs
	}

	/**
	 * Get error by ID
	 */
	getError(errorId: string): ErrorContext | undefined {
		return this.errorLog.get(errorId);
	}

	/**
	 * Clear old errors (keep last 100)
	 */
	clearOldErrors(): void {
		if (this.errorLog.size > 100) {
			const entriesToKeep = Array.from(this.errorLog.entries()).slice(-100);
			this.errorLog.clear();
			entriesToKeep.forEach(([id, error]) => this.errorLog.set(id, error));
		}
	}
}
