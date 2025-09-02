/**
 * Authentication manager for tryhamster.com
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import { getLogger } from '../logger';

// Auth configuration
const AUTH_CONFIG_DIR = path.join(os.homedir(), '.taskmaster');
const AUTH_CONFIG_FILE = path.join(AUTH_CONFIG_DIR, 'auth.json');
// const API_BASE_URL = process.env.HAMSTER_API_URL || 'https://tryhamster.com/api';
const API_BASE_URL = process.env.HAMSTER_API_URL || 'https://localhost:8080';

export interface AuthCredentials {
	token: string;
	refreshToken?: string;
	userId: string;
	email?: string;
	expiresAt?: string;
	tokenType?: 'standard' | 'api_key';
	savedAt: string;
}

export interface AuthOptions {
	email?: string;
	password?: string;
	apiKey?: string;
}

export interface AuthResponse {
	token: string;
	refreshToken?: string;
	userId: string;
	email?: string;
	expiresAt?: string;
}

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
	constructor(
		message: string,
		public code: string
	) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

/**
 * Authentication manager class
 */
export class AuthManager {
	private static instance: AuthManager;
	private logger = getLogger('AuthManager');

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): AuthManager {
		if (!AuthManager.instance) {
			AuthManager.instance = new AuthManager();
		}
		return AuthManager.instance;
	}

	/**
	 * Get stored authentication credentials
	 */
	getCredentials(): AuthCredentials | null {
		try {
			// Check for environment variable override (useful for CI/CD)
			// Similar to SUPABASE_ACCESS_TOKEN pattern
			if (process.env.TASKMASTER_ACCESS_TOKEN) {
				return {
					token: process.env.TASKMASTER_ACCESS_TOKEN,
					userId: process.env.TASKMASTER_USER_ID || 'env-user',
					email: process.env.TASKMASTER_EMAIL,
					tokenType: 'api_key',
					savedAt: new Date().toISOString()
				};
			}

			if (!fs.existsSync(AUTH_CONFIG_FILE)) {
				return null;
			}

			const authData = JSON.parse(
				fs.readFileSync(AUTH_CONFIG_FILE, 'utf-8')
			) as AuthCredentials;

			// Check if token is expired
			if (authData.expiresAt && new Date(authData.expiresAt) < new Date()) {
				this.logger.warn('Authentication token has expired');
				return null;
			}

			return authData;
		} catch (error) {
			this.logger.error(
				`Failed to read auth credentials: ${(error as Error).message}`
			);
			return null;
		}
	}

	/**
	 * Save authentication credentials
	 */
	private saveCredentials(authData: AuthCredentials): void {
		try {
			// Ensure directory exists
			if (!fs.existsSync(AUTH_CONFIG_DIR)) {
				fs.mkdirSync(AUTH_CONFIG_DIR, { recursive: true });
			}

			// Add timestamp
			authData.savedAt = new Date().toISOString();

			// Save credentials
			fs.writeFileSync(AUTH_CONFIG_FILE, JSON.stringify(authData, null, 2));

			// Set file permissions to read/write for owner only
			fs.chmodSync(AUTH_CONFIG_FILE, 0o600);
		} catch (error) {
			throw new AuthenticationError(
				`Failed to save auth credentials: ${(error as Error).message}`,
				'SAVE_FAILED'
			);
		}
	}

	/**
	 * Make an API request
	 */
	private makeApiRequest(endpoint: string, options: any = {}): Promise<any> {
		return new Promise((resolve, reject) => {
			const url = new URL(endpoint, API_BASE_URL);

			const requestOptions = {
				hostname: url.hostname,
				port: url.port || (url.protocol === 'https:' ? 443 : 80),
				path: url.pathname + url.search,
				method: options.method || 'GET',
				headers: {
					'Content-Type': 'application/json',
					...options.headers
				}
			};

			const protocol = url.protocol === 'https:' ? https : http;

			const req = protocol.request(requestOptions, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					try {
						const parsedData = JSON.parse(data);

						if (
							res.statusCode &&
							res.statusCode >= 200 &&
							res.statusCode < 300
						) {
							resolve(parsedData);
						} else {
							reject(
								new AuthenticationError(
									parsedData.message ||
										`API request failed with status ${res.statusCode}`,
									parsedData.code || 'API_ERROR'
								)
							);
						}
					} catch (error) {
						reject(
							new AuthenticationError(
								`Failed to parse API response: ${(error as Error).message}`,
								'PARSE_ERROR'
							)
						);
					}
				});
			});

			req.on('error', (error) => {
				reject(
					new AuthenticationError(
						`Network error: ${error.message}`,
						'NETWORK_ERROR'
					)
				);
			});

			if (options.body) {
				req.write(JSON.stringify(options.body));
			}

			req.end();
		});
	}

	/**
	 * Generate PKCE parameters for OAuth flow
	 */
	private generatePKCEParams(): {
		codeVerifier: string;
		codeChallenge: string;
		state: string;
	} {
		// Generate code verifier (43-128 characters)
		const codeVerifier = crypto.randomBytes(32).toString('base64url');

		// Generate code challenge using SHA256
		const codeChallenge = crypto
			.createHash('sha256')
			.update(codeVerifier)
			.digest('base64url');

		// Generate state for CSRF protection
		const state = crypto.randomBytes(16).toString('base64url');

		return { codeVerifier, codeChallenge, state };
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
	 * Start OAuth 2.0 Authorization Code Flow with PKCE
	 */
	async startOAuthFlow(): Promise<AuthCredentials> {
		const { codeVerifier, codeChallenge, state } = this.generatePKCEParams();
		const port = await this.getRandomPort();
		const redirectUri = `http://127.0.0.1:${port}/callback`;

		return new Promise((resolve, reject) => {
			let serverClosed = false;

			// Create local HTTP server for OAuth callback
			const server = http.createServer(async (req, res) => {
				const url = new URL(req.url!, `http://127.0.0.1:${port}`);

				if (url.pathname === '/callback') {
					const code = url.searchParams.get('code');
					const returnedState = url.searchParams.get('state');
					const error = url.searchParams.get('error');
					const errorDescription = url.searchParams.get('error_description');

					// Send response to browser
					res.writeHead(200, { 'Content-Type': 'text/html' });

					if (error) {
						res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Authentication Failed</title>
                  <style>
                    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                    .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #dc3545; }
                    p { color: #666; margin-top: 1rem; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>❌ Authentication Failed</h1>
                    <p>${errorDescription || error}</p>
                    <p>You can close this window and try again.</p>
                  </div>
                </body>
              </html>
            `);

						if (!serverClosed) {
							serverClosed = true;
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

					// Verify state parameter
					if (returnedState !== state) {
						res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Security Error</title>
                  <style>
                    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                    .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #dc3545; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>⚠️ Security Error</h1>
                    <p>Invalid state parameter. Please try again.</p>
                  </div>
                </body>
              </html>
            `);

						if (!serverClosed) {
							serverClosed = true;
							server.close();
							reject(
								new AuthenticationError(
									'Invalid state parameter',
									'INVALID_STATE'
								)
							);
						}
						return;
					}

					if (code) {
						res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                    .container { text-align: center; padding: 3rem; background: white; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                    h1 { color: #28a745; margin-bottom: 1rem; }
                    p { color: #666; margin-top: 1rem; }
                    .checkmark { width: 80px; height: 80px; margin: 0 auto 1rem; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="25" fill="none" stroke="#28a745" stroke-width="2"/>
                      <path fill="none" stroke="#28a745" stroke-width="3" d="M14 27l7 7 16-16"/>
                    </svg>
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to your terminal.</p>
                    <p style="color: #999; font-size: 0.9rem; margin-top: 2rem;">Task Master CLI</p>
                  </div>
                </body>
              </html>
            `);

						try {
							// Exchange authorization code for tokens
							const tokens = await this.exchangeCodeForTokens(
								code,
								codeVerifier,
								redirectUri
							);

							if (!serverClosed) {
								serverClosed = true;
								server.close();
								resolve(tokens);
							}
						} catch (error) {
							if (!serverClosed) {
								serverClosed = true;
								server.close();
								reject(error);
							}
						}
					}
				} else {
					// Handle other paths (favicon, etc.)
					res.writeHead(404);
					res.end();
				}
			});

			// Start server on localhost only
			server.listen(port, '127.0.0.1', () => {
				// Build authorization URL
				const authUrl = new URL(`${API_BASE_URL.replace('/api', '')}/auth/cli`);
				authUrl.searchParams.append('client_id', 'task-master-cli');
				authUrl.searchParams.append('redirect_uri', redirectUri);
				authUrl.searchParams.append('response_type', 'code');
				authUrl.searchParams.append('code_challenge', codeChallenge);
				authUrl.searchParams.append('code_challenge_method', 'S256');
				authUrl.searchParams.append('state', state);
				authUrl.searchParams.append('scope', 'offline_access'); // Request refresh token

				// Store auth URL for browser opening
				(this as any).authorizationUrl = authUrl.toString();
			});

			// Set timeout for authentication
			setTimeout(
				() => {
					if (!serverClosed) {
						serverClosed = true;
						server.close();
						reject(
							new AuthenticationError('Authentication timeout', 'AUTH_TIMEOUT')
						);
					}
				},
				5 * 60 * 1000
			); // 5 minute timeout
		});
	}

	/**
	 * Exchange authorization code for tokens using PKCE
	 */
	private async exchangeCodeForTokens(
		code: string,
		codeVerifier: string,
		redirectUri: string
	): Promise<AuthCredentials> {
		try {
			const response = (await this.makeApiRequest('/auth/token', {
				method: 'POST',
				body: {
					grant_type: 'authorization_code',
					client_id: 'task-master-cli',
					code,
					code_verifier: codeVerifier,
					redirect_uri: redirectUri
				}
			})) as AuthResponse;

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

			this.saveCredentials(authData);
			return authData;
		} catch (error) {
			throw new AuthenticationError(
				`Failed to exchange code for tokens: ${(error as Error).message}`,
				'TOKEN_EXCHANGE_FAILED'
			);
		}
	}

	/**
	 * Get the authorization URL (for browser opening)
	 */
	getAuthorizationUrl(): string | null {
		return (this as any).authorizationUrl || null;
	}

	/**
	 * Authenticate with email and password
	 */
	async authenticateWithCredentials(
		email: string,
		password: string
	): Promise<AuthCredentials> {
		try {
			const response = (await this.makeApiRequest('/auth/login', {
				method: 'POST',
				body: { email, password }
			})) as AuthResponse;

			// Save authentication data
			const authData: AuthCredentials = {
				token: response.token,
				refreshToken: response.refreshToken,
				userId: response.userId,
				email: email,
				expiresAt: response.expiresAt,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			this.saveCredentials(authData);

			return authData;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Authenticate with API key
	 */
	async authenticateWithApiKey(apiKey: string): Promise<AuthCredentials> {
		try {
			const response = (await this.makeApiRequest('/auth/validate', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`
				}
			})) as AuthResponse;

			// Save authentication data
			const authData: AuthCredentials = {
				token: apiKey,
				tokenType: 'api_key',
				userId: response.userId,
				email: response.email,
				expiresAt: undefined, // API keys don't expire
				savedAt: new Date().toISOString()
			};

			this.saveCredentials(authData);

			return authData;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Refresh authentication token
	 */
	async refreshToken(): Promise<AuthCredentials> {
		const authData = this.getCredentials();

		if (!authData || !authData.refreshToken) {
			throw new AuthenticationError(
				'No refresh token available',
				'NO_REFRESH_TOKEN'
			);
		}

		try {
			const response = (await this.makeApiRequest('/auth/refresh', {
				method: 'POST',
				body: {
					refreshToken: authData.refreshToken
				}
			})) as AuthResponse;

			// Update authentication data
			const newAuthData: AuthCredentials = {
				...authData,
				token: response.token,
				expiresAt: response.expiresAt,
				savedAt: new Date().toISOString()
			};

			this.saveCredentials(newAuthData);

			return newAuthData;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Logout and clear credentials
	 */
	logout(): void {
		try {
			if (fs.existsSync(AUTH_CONFIG_FILE)) {
				fs.unlinkSync(AUTH_CONFIG_FILE);
			}
		} catch (error) {
			throw new AuthenticationError(
				`Failed to logout: ${(error as Error).message}`,
				'LOGOUT_FAILED'
			);
		}
	}

	/**
	 * Check if authenticated
	 */
	isAuthenticated(): boolean {
		// Fast check for environment variable
		if (process.env.TASKMASTER_ACCESS_TOKEN) {
			return true;
		}

		const authData = this.getCredentials();
		return authData !== null;
	}

	/**
	 * Get authorization headers
	 */
	getAuthHeaders(): Record<string, string> {
		const authData = this.getCredentials();

		if (!authData) {
			throw new AuthenticationError(
				'Not authenticated. Please authenticate first.',
				'NOT_AUTHENTICATED'
			);
		}

		return {
			Authorization: `Bearer ${authData.token}`
		};
	}
}
