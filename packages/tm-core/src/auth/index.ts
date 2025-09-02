/**
 * Authentication module exports
 */

export { AuthManager } from './auth-manager';
export { CredentialStore } from './credential-store';
export { ApiClient } from './api-client';
export { OAuthService } from './oauth-service';

export type {
	AuthCredentials,
	AuthOptions,
	AuthResponse,
	OAuthFlowOptions,
	AuthConfig,
	CliData
} from './types';

export { AuthenticationError } from './types';

export {
	getSuccessHtml,
	getErrorHtml,
	getSecurityErrorHtml
} from './templates';

export {
	DEFAULT_AUTH_CONFIG,
	getAuthConfig
} from './config';
