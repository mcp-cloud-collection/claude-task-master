# VS Code Extension CI/CD Setup

This document explains the CI/CD setup for the Task Master VS Code extension.

## 🔄 Workflows Overview

### 1. Extension CI (`extension-ci.yml`)
**Triggers:**
- Push to `main` or `next` branches (only when extension files change)
- Pull requests to `main` or `next` (only when extension files change)

**What it does:**
- ✅ Lints and type-checks the extension code
- 🔨 Builds the extension (`pnpm run build`)
- 📦 Creates a clean package (`pnpm run package`)
- 🧪 Runs tests with VS Code test framework
- 📋 Creates a test VSIX package to verify packaging works
- 💾 Uploads build artifacts for inspection

### 2. Extension Release (`extension-release.yml`)
**Triggers:**
- Push to `main` branch (only when extension files change AND version changes)
- Manual trigger with `workflow_dispatch` (with optional force publish)

**What it does:**
- 🔍 Checks if the extension version changed
- 🧪 Runs full test suite (lint, typecheck, tests)
- 🔨 Builds and packages the extension
- 📤 Publishes to VS Code Marketplace
- 🌍 Publishes to Open VSX Registry (for VSCodium, Gitpod, etc.)
- 🏷️ Creates a GitHub release with the VSIX file
- 📊 Uploads release artifacts

## 🔑 Required Secrets

To use the release workflow, you need to set up these GitHub repository secrets:

### `VSCE_PAT` (VS Code Marketplace Personal Access Token)
1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with your Microsoft account
3. Create a Personal Access Token:
   - **Name**: VS Code Extension Publishing
   - **Organization**: All accessible organizations
   - **Expiration**: Custom (recommend 1 year)
   - **Scopes**: Custom defined → **Marketplace** → **Manage**
4. Copy the token and add it to GitHub Secrets as `VSCE_PAT`

### `OVSX_PAT` (Open VSX Registry Personal Access Token)
1. Go to [Open VSX Registry](https://open-vsx.org/)
2. Sign in with your GitHub account
3. Go to your [User Settings](https://open-vsx.org/user-settings/tokens)
4. Create a new Access Token:
   - **Description**: VS Code Extension Publishing
   - **Scopes**: Leave default (full access)
5. Copy the token and add it to GitHub Secrets as `OVSX_PAT`

### `GITHUB_TOKEN` (automatically provided)
This is automatically available in GitHub Actions - no setup required.

## 🚀 Publishing Process

### Automatic Publishing (Recommended)
1. **Make changes** to the extension code
2. **Update version** in both:
   - `apps/extension/package.json`
   - `apps/extension/package.publish.json`
3. **Commit and push** to `main` branch
4. **CI automatically triggers** and publishes if version changed

### Manual Publishing
1. Go to **Actions** tab in GitHub
2. Select **Extension Release** workflow
3. Click **Run workflow**
4. Check **"Force publish even without version changes"** if needed
5. Click **Run workflow**

## 📋 Version Management

### Version Sync Checklist
When updating the extension version, ensure these fields match in both files:

**`package.json` and `package.publish.json`:**
```json
{
  "version": "1.0.2",                    // ⚠️ MUST MATCH
  "publisher": "DavidMaliglowka",        // ⚠️ MUST MATCH  
  "displayName": "Task Master Kanban",   // ⚠️ MUST MATCH
  "description": "...",                  // ⚠️ MUST MATCH
  "engines": { "vscode": "^1.93.0" },   // ⚠️ MUST MATCH
  "categories": [...],                   // ⚠️ MUST MATCH
  "contributes": { ... }                 // ⚠️ MUST MATCH
}
```

### Version Detection Logic
The release workflow only publishes when:
- Extension files changed in the push, AND
- Version field changed in `package.json` or `package.publish.json`

## 🔍 Monitoring Builds

### CI Status
- **Green ✅**: Extension builds and tests successfully
- **Red ❌**: Build/test failures - check logs for details
- **Yellow 🟡**: Partial success - some jobs may have warnings

### Release Status
- **Published 🎉**: Extension live on VS Code Marketplace
- **Skipped ℹ️**: No version changes detected
- **Failed ❌**: Check logs - often missing secrets or build issues

### Artifacts
Both workflows upload artifacts that you can download:
- **CI**: Test results, built files, and VSIX package
- **Release**: Final VSIX package and build artifacts (90-day retention)

## 🛠️ Troubleshooting

### Common Issues

**"VSCE_PAT is not set" Error**
- Ensure `VSCE_PAT` secret is added to repository
- Check token hasn't expired
- Verify token has Marketplace > Manage permissions

**"OVSX_PAT is not set" Error**
- Ensure `OVSX_PAT` secret is added to repository
- Check token hasn't expired
- Verify you're signed in to Open VSX Registry with GitHub

**"Version not changed" Skipped Release**
- Update version in both `package.json` AND `package.publish.json`
- Ensure files are committed and pushed
- Use manual trigger with force publish if needed

**Build Failures**
- Check extension code compiles locally: `cd apps/extension && pnpm run build`
- Verify tests pass locally: `pnpm run test`
- Check for TypeScript errors: `pnpm run check-types`

**Packaging Failures**
- Ensure clean package builds: `pnpm run package`
- Check vsix-build structure is correct
- Verify package.publish.json has correct fields

## 📁 File Structure Impact

The CI workflows respect the 3-file packaging system:
- **Development**: Uses `package.json` for dependencies and scripts
- **Release**: Uses `package.publish.json` for clean marketplace package
- **Build**: Uses `package.mjs` to create `vsix-build/` for final packaging

This ensures clean, conflict-free publishing to both VS Code Marketplace and Open VSX Registry! 🚀

## 🌍 **Dual Registry Publishing**

Your extension will be automatically published to both:
- **VS Code Marketplace** - For official VS Code users
- **Open VSX Registry** - For Cursor, Windsurf, VSCodium, Gitpod, Eclipse Theia, and other compatible editors