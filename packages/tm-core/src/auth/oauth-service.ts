/**
 * OAuth 2.0 Authorization Code Flow service
 */

import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import open from 'open';
import {
	AuthCredentials,
	AuthenticationError,
	OAuthFlowOptions,
	AuthConfig,
	CliData
} from './types';
import { ApiClient } from './api-client';
import { CredentialStore } from './credential-store';
import {
	getSuccessHtml,
	getErrorHtml,
	getSecurityErrorHtml
} from './templates';
import { getAuthConfig } from './config';
import { getLogger } from '../logger';
import packageJson from '../../../../package.json' with { type: 'json' };

export class OAuthService {
	private logger = getLogger('OAuthService');
	private apiClient: ApiClient;
	private credentialStore: CredentialStore;
	private webBaseUrl: string;
	private authorizationUrl: string | null = null;
	private originalState: string | null = null;

	constructor(
		apiClient: ApiClient,
		credentialStore: CredentialStore,
		config: Partial<AuthConfig> = {}
	) {
		this.apiClient = apiClient;
		this.credentialStore = credentialStore;
		const authConfig = getAuthConfig(config);
		this.webBaseUrl = authConfig.webBaseUrl;
	}

	/**
	 * Start OAuth 2.0 Authorization Code Flow with browser handling
	 */
	async authenticate(options: OAuthFlowOptions = {}): Promise<AuthCredentials> {
		const {
			openBrowser = true,
			timeout = 300000, // 5 minutes default
			onAuthUrl,
			onWaitingForAuth,
			onSuccess,
			onError
		} = options;

		try {
			// Start the OAuth flow (starts local server)
			const authPromise = this.startFlow(timeout);

			// Wait for server to start
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Get the authorization URL
			const authUrl = this.getAuthorizationUrl();

			if (!authUrl) {
				throw new AuthenticationError(
					'Failed to generate authorization URL',
					'URL_GENERATION_FAILED'
				);
			}

			// Notify about the auth URL
			if (onAuthUrl) {
				onAuthUrl(authUrl);
			}

			// Open browser if requested
			if (openBrowser) {
				await this.openBrowser(authUrl);
			}

			// Notify that we're waiting for authentication
			if (onWaitingForAuth) {
				onWaitingForAuth();
			}

			// Wait for authentication to complete
			const credentials = await authPromise;

			// Notify success
			if (onSuccess) {
				onSuccess(credentials);
			}

			return credentials;
		} catch (error) {
			const authError =
				error instanceof AuthenticationError
					? error
					: new AuthenticationError(
							`OAuth authentication failed: ${(error as Error).message}`,
							'OAUTH_FAILED'
						);

			// Notify error
			if (onError) {
				onError(authError);
			}

			throw authError;
		}
	}

	/**
	 * Start the OAuth flow (internal implementation)
	 */
	private async startFlow(timeout: number = 300000): Promise<AuthCredentials> {
		const state = this.generateState();
		const port = await this.getRandomPort();
		const callbackUrl = `http://localhost:${port}/callback`;

		// Store the original state for verification
		this.originalState = state;

		// Prepare CLI data object
		const cliData: CliData = {
			callback: callbackUrl,
			state: state,
			name: 'Task Master CLI',
			version: this.getCliVersion(),
			device: os.hostname(),
			user: os.userInfo().username,
			platform: os.platform(),
			timestamp: Date.now()
		};

		return new Promise((resolve, reject) => {
			let serverClosed = false;

			// Create local HTTP server for OAuth callback
			const server = http.createServer(async (req, res) => {
				const url = new URL(req.url!, `http://127.0.0.1:${port}`);

				if (url.pathname === '/callback') {
					await this.handleCallback(
						url,
						res,
						server,
						serverClosed,
						resolve,
						reject
					);
					serverClosed = true;
				} else {
					// Handle other paths (favicon, etc.)
					res.writeHead(404);
					res.end();
				}
			});

			// Start server on localhost only
			server.listen(port, '127.0.0.1', () => {
				// Build authorization URL for web app sign-in page
				const authUrl = new URL(`${this.webBaseUrl}/auth/sign-in`);

				// Encode CLI data as base64
				const cliParam = Buffer.from(JSON.stringify(cliData)).toString(
					'base64'
				);

				// Set the single CLI parameter with all encoded data
				authUrl.searchParams.append('cli', cliParam);

				// Store auth URL for browser opening
				this.authorizationUrl = authUrl.toString();

				this.logger.info(
					`OAuth session started - ${cliData.name} v${cliData.version} on port ${port}`
				);
				this.logger.debug('CLI data:', cliData);
			});

			// Set timeout for authentication
			setTimeout(() => {
				if (!serverClosed) {
					serverClosed = true;
					server.close();
					reject(
						new AuthenticationError('Authentication timeout', 'AUTH_TIMEOUT')
					);
				}
			}, timeout);
		});
	}

	/**
	 * Handle OAuth callback
	 */
	private async handleCallback(
		url: URL,
		res: http.ServerResponse,
		server: http.Server,
		serverClosed: boolean,
		resolve: (value: AuthCredentials) => void,
		reject: (error: any) => void
	): Promise<void> {
		const code = url.searchParams.get('code');
		const returnedState = url.searchParams.get('state');
		const error = url.searchParams.get('error');
		const errorDescription = url.searchParams.get('error_description');

		// Send response to browser
		res.writeHead(200, { 'Content-Type': 'text/html' });

		if (error) {
			res.end(getErrorHtml(errorDescription || error));
			if (!serverClosed) {
				server.close();
				reject(
					new AuthenticationError(
						errorDescription || error || 'Authentication failed',
						'OAUTH_ERROR'
					)
				);
			}
			return;
		}

		// Verify state parameter for CSRF protection
		if (returnedState !== this.originalState) {
			res.end(getSecurityErrorHtml());
			if (!serverClosed) {
				server.close();
				reject(
					new AuthenticationError('Invalid state parameter', 'INVALID_STATE')
				);
			}
			return;
		}

		if (code) {
			res.end(getSuccessHtml());

			try {
				// Exchange authorization code for tokens
				const response = await this.apiClient.exchangeCode(code);

				// Save authentication data
				const authData: AuthCredentials = {
					token: response.token,
					refreshToken: response.refreshToken,
					userId: response.userId,
					email: response.email,
					expiresAt: response.expiresAt,
					tokenType: 'standard',
					savedAt: new Date().toISOString()
				};

				this.credentialStore.saveCredentials(authData);

				if (!serverClosed) {
					server.close();
					resolve(authData);
				}
			} catch (error) {
				if (!serverClosed) {
					server.close();
					reject(error);
				}
			}
		}
	}

	/**
	 * Open browser with the given URL
	 */
	private async openBrowser(url: string): Promise<void> {
		try {
			await open(url);
			this.logger.debug('Browser opened successfully with URL:', url);
		} catch (error) {
			// Log the error but don't throw - user can still manually open the URL
			this.logger.warn('Failed to open browser automatically:', error);
		}
	}

	/**
	 * Generate state for OAuth flow
	 */
	private generateState(): string {
		return crypto.randomBytes(32).toString('base64url');
	}

	/**
	 * Get a random available port
	 */
	private async getRandomPort(): Promise<number> {
		return new Promise((resolve) => {
			const server = http.createServer();
			server.listen(0, '127.0.0.1', () => {
				const port = (server.address() as any).port;
				server.close(() => resolve(port));
			});
		});
	}

	/**
	 * Get CLI version from package.json if available
	 */
	private getCliVersion(): string {
		return packageJson.version || 'unknown';
	}

	/**
	 * Get the authorization URL (for browser opening)
	 */
	getAuthorizationUrl(): string | null {
		return this.authorizationUrl;
	}
}
