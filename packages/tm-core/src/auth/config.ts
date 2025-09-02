/**
 * Centralized authentication configuration
 */

import os from 'os';
import path from 'path';
import { AuthConfig } from './types';

// Centralized URL configuration - change these for different environments
// For production, use: https://tryhamster.com
// For local testing, use: http://localhost:8080
const BASE_DOMAIN = 'http://localhost:8080'; // 'https://tryhamster.com';

/**
 * Default authentication configuration
 * All URL configuration should be managed here
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
	// API endpoint for backend services
	apiBaseUrl: process.env.HAMSTER_API_URL || `${BASE_DOMAIN}/api`,

	// Web URL for OAuth sign-in page
	webBaseUrl: process.env.HAMSTER_WEB_URL || BASE_DOMAIN,

	// Configuration directory and file paths
	configDir: path.join(os.homedir(), '.taskmaster'),
	configFile: path.join(os.homedir(), '.taskmaster', 'auth.json')
};

/**
 * Get merged configuration with optional overrides
 */
export function getAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
	return {
		...DEFAULT_AUTH_CONFIG,
		...overrides
	};
}
