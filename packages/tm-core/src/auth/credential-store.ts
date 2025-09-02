/**
 * Credential storage and management
 */

import fs from 'fs';
import { AuthCredentials, AuthenticationError, AuthConfig } from './types';
import { getAuthConfig } from './config';
import { getLogger } from '../logger';

export class CredentialStore {
	private logger = getLogger('CredentialStore');
	private config: AuthConfig;

	constructor(config?: Partial<AuthConfig>) {
		this.config = getAuthConfig(config);
	}

	/**
	 * Get stored authentication credentials
	 */
	getCredentials(): AuthCredentials | null {
		try {
			// Check for environment variable override (useful for CI/CD)
			if (process.env.TASKMASTER_ACCESS_TOKEN) {
				return {
					token: process.env.TASKMASTER_ACCESS_TOKEN,
					userId: process.env.TASKMASTER_USER_ID || 'env-user',
					email: process.env.TASKMASTER_EMAIL,
					tokenType: 'api_key',
					savedAt: new Date().toISOString()
				};
			}

			if (!fs.existsSync(this.config.configFile)) {
				return null;
			}

			const authData = JSON.parse(
				fs.readFileSync(this.config.configFile, 'utf-8')
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
	saveCredentials(authData: AuthCredentials): void {
		try {
			// Ensure directory exists
			if (!fs.existsSync(this.config.configDir)) {
				fs.mkdirSync(this.config.configDir, { recursive: true });
			}

			// Add timestamp
			authData.savedAt = new Date().toISOString();

			// Save credentials
			fs.writeFileSync(
				this.config.configFile,
				JSON.stringify(authData, null, 2)
			);

			// Set file permissions to read/write for owner only
			fs.chmodSync(this.config.configFile, 0o600);
		} catch (error) {
			throw new AuthenticationError(
				`Failed to save auth credentials: ${(error as Error).message}`,
				'SAVE_FAILED'
			);
		}
	}

	/**
	 * Clear stored credentials
	 */
	clearCredentials(): void {
		try {
			if (fs.existsSync(this.config.configFile)) {
				fs.unlinkSync(this.config.configFile);
			}
		} catch (error) {
			throw new AuthenticationError(
				`Failed to clear credentials: ${(error as Error).message}`,
				'CLEAR_FAILED'
			);
		}
	}

	/**
	 * Check if credentials exist and are valid
	 */
	hasValidCredentials(): boolean {
		// Fast check for environment variable
		if (process.env.TASKMASTER_ACCESS_TOKEN) {
			return true;
		}

		const credentials = this.getCredentials();
		return credentials !== null;
	}

	/**
	 * Get configuration
	 */
	getConfig(): AuthConfig {
		return { ...this.config };
	}
}
