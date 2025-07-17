// Kiro profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { createProfile } from './base-profile.js';

// Minimal lifecycle function to handle MCP config transformation
function onPostConvertRulesProfile(targetDir, assetsDir) {
	// Move MCP config from .kiro/mcp.json to .kiro/settings/mcp.json and add inclusion patterns
	const baseMcpConfigPath = path.join(targetDir, '.kiro', 'mcp.json');
	const finalMcpConfigPath = path.join(
		targetDir,
		'.kiro',
		'settings',
		'mcp.json'
	);

	if (!fs.existsSync(baseMcpConfigPath)) {
		return; // No MCP config to transform
	}

	try {
		// Create settings directory
		const settingsDir = path.join(targetDir, '.kiro', 'settings');
		if (!fs.existsSync(settingsDir)) {
			fs.mkdirSync(settingsDir, { recursive: true });
		}

		// Read and transform the MCP config
		const mcpConfigContent = fs.readFileSync(baseMcpConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		// Add inclusion patterns to each server if they don't exist
		if (mcpConfig.mcpServers) {
			for (const [serverName, serverConfig] of Object.entries(
				mcpConfig.mcpServers
			)) {
				if (!serverConfig.inclusion) {
					serverConfig.inclusion = {
						fileMatchPattern: '**/*'
					};
				}
			}
		}

		// Write to final location and remove original
		fs.writeFileSync(
			finalMcpConfigPath,
			JSON.stringify(mcpConfig, null, '\t') + '\n'
		);
		fs.rmSync(baseMcpConfigPath, { force: true });
	} catch (error) {
		// Silently fail - not critical
	}
}

// Create and export kiro profile using the base factory
export const kiroProfile = createProfile({
	name: 'kiro',
	displayName: 'Kiro',
	url: 'kiro.dev',
	docsUrl: 'kiro.dev/docs',
	profileDir: '.kiro',
	rulesDir: '.kiro/steering', // Kiro rules location (full path)
	mcpConfig: true,
	mcpConfigName: 'mcp.json',
	includeDefaultRules: true, // Include default rules to get all the standard files
	targetExtension: '.md',
	fileMap: {
		// Override specific mappings - the base profile will create:
		// 'rules/cursor_rules.mdc': 'kiro_rules.md'
		// 'rules/dev_workflow.mdc': 'dev_workflow.md'
		// 'rules/self_improve.mdc': 'self_improve.md'
		// 'rules/taskmaster.mdc': 'taskmaster.md'
		// We can add additional custom mappings here if needed
	},
	customReplacements: [
		// Core Kiro directory structure changes
		{ from: /\.cursor\/rules/g, to: '.kiro/steering' },
		{ from: /\.cursor\/mcp\.json/g, to: '.kiro/settings/mcp.json' },

		// Fix any remaining kiro/rules references that might be created during transformation
		{ from: /\.kiro\/rules/g, to: '.kiro/steering' },

		// Essential markdown link transformations for Kiro structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.kiro/steering/$2.md)'
		},

		// Kiro specific terminology
		{ from: /rules directory/g, to: 'steering directory' },
		{ from: /cursor rules/gi, to: 'Kiro steering files' }
	],
	onPostConvert: onPostConvertRulesProfile
});
