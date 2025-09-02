/**
 * OAuth 2.0 Authorization Code Flow service
 */

import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import os from 'os';
import open from 'open';
import {
	AuthCredentials,
	AuthenticationError,
	OAuthFlowOptions,
	AuthConfig,
	CliData
} from './types';
import { CredentialStore } from './credential-store';
import { SupabaseAuthClient } from '../clients/supabase-client';
import { getAuthConfig } from './config';
import { getLogger } from '../logger';
import packageJson from '../../../../package.json' with { type: 'json' };

export class OAuthService {
	private logger = getLogger('OAuthService');
	private credentialStore: CredentialStore;
	private supabaseClient: SupabaseAuthClient;
	private webBaseUrl: string;
	private authorizationUrl: string | null = null;
	private originalState: string | null = null;

	constructor(
		credentialStore: CredentialStore,
		config: Partial<AuthConfig> = {}
	) {
		this.credentialStore = credentialStore;
		this.supabaseClient = new SupabaseAuthClient();
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

		// Prepare CLI data object (server handles OAuth/PKCE)
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
		// Server now returns tokens directly instead of code
		const type = url.searchParams.get('type');
		const returnedState = url.searchParams.get('state');
		const accessToken = url.searchParams.get('access_token');
		const refreshToken = url.searchParams.get('refresh_token');
		const expiresIn = url.searchParams.get('expires_in');
		const error = url.searchParams.get('error');
		const errorDescription = url.searchParams.get('error_description');

		// Server handles displaying success/failure, just close connection
		res.writeHead(200);
		res.end();

		if (error) {
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
			if (!serverClosed) {
				server.close();
				reject(
					new AuthenticationError('Invalid state parameter', 'INVALID_STATE')
				);
			}
			return;
		}

		// Handle direct token response from server
		if (
			accessToken &&
			(type === 'oauth_success' || type === 'session_transfer')
		) {
			try {
				this.logger.info(`Received tokens via ${type}`);

				// Get user info using the access token if possible
				const user = await this.supabaseClient.getUser(accessToken);

				// Calculate expiration time
				const expiresAt = expiresIn
					? new Date(Date.now() + parseInt(expiresIn) * 1000).toISOString()
					: undefined;

				// Save authentication data
				const authData: AuthCredentials = {
					token: accessToken,
					refreshToken: refreshToken || undefined,
					userId: user?.id || 'unknown',
					email: user?.email,
					expiresAt: expiresAt,
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
		} else {
			if (!serverClosed) {
				server.close();
				reject(new AuthenticationError('No access token received', 'NO_TOKEN'));
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
