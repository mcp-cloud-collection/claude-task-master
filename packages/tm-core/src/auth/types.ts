/**
 * Authentication types and interfaces
 */

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

export interface OAuthFlowOptions {
	/** Whether to automatically open the browser. Default: true */
	openBrowser?: boolean;
	/** Timeout for the OAuth flow in milliseconds. Default: 300000 (5 minutes) */
	timeout?: number;
	/** Callback to be invoked with the authorization URL */
	onAuthUrl?: (url: string) => void;
	/** Callback to be invoked when waiting for authentication */
	onWaitingForAuth?: () => void;
	/** Callback to be invoked on successful authentication */
	onSuccess?: (credentials: AuthCredentials) => void;
	/** Callback to be invoked on authentication error */
	onError?: (error: AuthenticationError) => void;
}

export interface AuthConfig {
	baseUrl: string;
	configDir: string;
	configFile: string;
}

export interface CliData {
	callback: string;
	state: string;
	name: string;
	version: string;
	device?: string;
	user?: string;
	platform?: string;
	timestamp?: number;
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
