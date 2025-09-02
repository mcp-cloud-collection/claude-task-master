/**
 * Supabase client for authentication
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthenticationError } from '../auth/types';
import { getLogger } from '../logger';

export class SupabaseAuthClient {
	private client: SupabaseClient | null = null;
	private logger = getLogger('SupabaseAuthClient');

	/**
	 * Initialize Supabase client
	 */
	private getClient(): SupabaseClient {
		if (!this.client) {
			// Get Supabase configuration from environment
			const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8080';
			const supabaseAnonKey =
				process.env.SUPABASE_ANON_KEY ||
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

			if (!supabaseUrl || !supabaseAnonKey) {
				throw new AuthenticationError(
					'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.',
					'CONFIG_MISSING'
				);
			}

			this.client = createClient(supabaseUrl, supabaseAnonKey, {
				auth: {
					autoRefreshToken: true,
					persistSession: false, // We handle persistence ourselves
					detectSessionInUrl: false
				}
			});
		}

		return this.client;
	}

	/**
	 * Note: Code exchange is now handled server-side
	 * The server returns tokens directly to avoid PKCE issues
	 * This method is kept for potential future use
	 */
	async exchangeCodeForSession(_code: string): Promise<{
		token: string;
		refreshToken?: string;
		userId: string;
		email?: string;
		expiresAt?: string;
	}> {
		throw new AuthenticationError(
			'Code exchange is handled server-side. CLI receives tokens directly.',
			'NOT_SUPPORTED'
		);
	}

	/**
	 * Refresh an access token
	 */
	async refreshSession(refreshToken: string): Promise<{
		token: string;
		refreshToken?: string;
		expiresAt?: string;
	}> {
		try {
			const client = this.getClient();

			this.logger.info('Refreshing session...');

			// Set the session with refresh token
			const { data, error } = await client.auth.refreshSession({
				refresh_token: refreshToken
			});

			if (error) {
				this.logger.error('Failed to refresh session:', error);
				throw new AuthenticationError(
					`Failed to refresh session: ${error.message}`,
					'REFRESH_FAILED'
				);
			}

			if (!data.session) {
				throw new AuthenticationError(
					'No session data returned',
					'INVALID_RESPONSE'
				);
			}

			this.logger.info('Successfully refreshed session');

			return {
				token: data.session.access_token,
				refreshToken: data.session.refresh_token,
				expiresAt: data.session.expires_at
					? new Date(data.session.expires_at * 1000).toISOString()
					: undefined
			};
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}

			throw new AuthenticationError(
				`Failed to refresh session: ${(error as Error).message}`,
				'REFRESH_FAILED'
			);
		}
	}

	/**
	 * Get user details from token
	 */
	async getUser(token: string): Promise<User | null> {
		try {
			const client = this.getClient();

			// Get user with the token
			const { data, error } = await client.auth.getUser(token);

			if (error) {
				this.logger.warn('Failed to get user:', error);
				return null;
			}

			return data.user;
		} catch (error) {
			this.logger.error('Error getting user:', error);
			return null;
		}
	}

	/**
	 * Sign out (revoke tokens)
	 */
	async signOut(token: string): Promise<void> {
		try {
			const client = this.getClient();

			// Sign out using the token
			const { error } = await client.auth.admin.signOut(token);

			if (error) {
				this.logger.warn('Failed to sign out:', error);
			}
		} catch (error) {
			this.logger.error('Error during sign out:', error);
		}
	}
}
