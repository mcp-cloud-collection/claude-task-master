/**
 * Authentication manager for Task Master CLI
 */

import {
	AuthCredentials,
	OAuthFlowOptions,
	AuthenticationError,
	AuthConfig
} from './types';
import { CredentialStore } from './credential-store';
import { ApiClient } from './api-client';
import { OAuthService } from './oauth-service';

/**
 * Authentication manager class
 */
export class AuthManager {
	private static instance: AuthManager;
	private credentialStore: CredentialStore;
	private apiClient: ApiClient;
	private oauthService: OAuthService;

	private constructor(config?: Partial<AuthConfig>) {
		this.credentialStore = new CredentialStore(config);
		this.apiClient = new ApiClient(config);
		this.oauthService = new OAuthService(
			this.apiClient,
			this.credentialStore,
			config
		);
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(config?: Partial<AuthConfig>): AuthManager {
		if (!AuthManager.instance) {
			AuthManager.instance = new AuthManager(config);
		}
		return AuthManager.instance;
	}

	/**
	 * Get stored authentication credentials
	 */
	getCredentials(): AuthCredentials | null {
		return this.credentialStore.getCredentials();
	}

	/**
	 * Start OAuth 2.0 Authorization Code Flow with browser handling
	 */
	async authenticateWithOAuth(
		options: OAuthFlowOptions = {}
	): Promise<AuthCredentials> {
		return this.oauthService.authenticate(options);
	}

	/**
	 * Get the authorization URL (for browser opening)
	 */
	getAuthorizationUrl(): string | null {
		return this.oauthService.getAuthorizationUrl();
	}

	/**
	 * Authenticate with email and password
	 */
	async authenticateWithCredentials(
		email: string,
		password: string
	): Promise<AuthCredentials> {
		try {
			const response = await this.apiClient.login(email, password);

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

			this.credentialStore.saveCredentials(authData);
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
			const response = await this.apiClient.validateApiKey(apiKey);

			// Save authentication data
			const authData: AuthCredentials = {
				token: apiKey,
				tokenType: 'api_key',
				userId: response.userId,
				email: response.email,
				expiresAt: undefined, // API keys don't expire
				savedAt: new Date().toISOString()
			};

			this.credentialStore.saveCredentials(authData);
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
			const response = await this.apiClient.refreshToken(authData.refreshToken);

			// Update authentication data
			const newAuthData: AuthCredentials = {
				...authData,
				token: response.token,
				expiresAt: response.expiresAt,
				savedAt: new Date().toISOString()
			};

			this.credentialStore.saveCredentials(newAuthData);
			return newAuthData;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Logout and clear credentials
	 */
	logout(): void {
		this.credentialStore.clearCredentials();
	}

	/**
	 * Check if authenticated
	 */
	isAuthenticated(): boolean {
		return this.credentialStore.hasValidCredentials();
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
