/**
 * Centralized authentication configuration
 */

import os from 'os';
import path from 'path';
import { AuthConfig } from './types';

// Use build-time value if available, otherwise use runtime env or default
// Build-time: process.env.TM_PUBLIC_BASE_DOMAIN gets replaced by tsup's env option
// Runtime: TM_BASE_DOMAIN or HAMSTER_BASE_URL from user's environment
// Default: https://tryhamster.com for production
const BASE_DOMAIN =
	process.env.TM_PUBLIC_BASE_DOMAIN || // This gets replaced at build time by tsup
	'https://tryhamster.com';

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
