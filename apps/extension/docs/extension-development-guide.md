# VS Code Extension Development Guide

## 📁 File Structure Overview

This VS Code extension uses a **3-file packaging system** to avoid dependency conflicts during publishing:

```
apps/extension/
├── package.json           # Development configuration
├── package.publish.json   # Clean publishing configuration  
├── package.mjs           # Build script for packaging
├── .vscodeignore         # Files to exclude from extension package
└── vsix-build/           # Generated clean package directory
```

## 📋 File Purposes

### `package.json` (Development)
- **Purpose**: Development environment with all build tools
- **Contains**: 
  - All `devDependencies` needed for building
  - Development scripts (`build`, `watch`, `lint`, etc.)
  - Development package name: `"taskr"`
- **Used for**: Local development, building, testing

### `package.publish.json` (Publishing)
- **Purpose**: Clean distribution version for VS Code Marketplace
- **Contains**:
  - **No devDependencies** (avoids dependency conflicts)
  - Publishing metadata (`keywords`, `repository`, `categories`)
  - Marketplace package name: `"taskr-kanban"`
  - VS Code extension configuration
- **Used for**: Final extension packaging

### `package.mjs` (Build Script)
- **Purpose**: Creates clean package for distribution
- **Process**:
  1. Builds the extension (`build:js` + `build:css`)
  2. Creates clean `vsix-build/` directory
  3. Copies only essential files (no source code)
  4. Renames `package.publish.json` → `package.json`
  5. Ready for `vsce package`

## 🚀 Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Start development with hot reload
pnpm run watch

# Run just JavaScript build
pnpm run build:js

# Run just CSS build  
pnpm run build:css

# Full production build
pnpm run build

# Type checking
pnpm run check-types

# Linting
pnpm run lint
```

### Testing in VS Code
1. Press `F5` in VS Code to launch Extension Development Host
2. Test your extension functionality in the new window
3. Use `Developer: Reload Window` to reload after changes

## 📦 Production Packaging

### Step 1: Build Clean Package
```bash
pnpm run package
```
This creates `vsix-build/` with clean distribution files.

### Step 2: Create VSIX
```bash
cd vsix-build
pnpm exec vsce package --no-dependencies
```
Creates: `taskr-kanban-1.0.1.vsix`

### Alternative: One Command
```bash
pnpm run package && cd vsix-build && pnpm exec vsce package --no-dependencies
```

## 🔄 Keeping Files in Sync

### Critical Fields to Sync Between Files

When updating extension metadata, ensure these fields match between `package.json` and `package.publish.json`:

#### Version & Identity
```json
{
  "version": "1.0.1",                    // ⚠️ MUST MATCH
  "publisher": "DavidMaliglowka",        // ⚠️ MUST MATCH  
  "displayName": "taskr: Task Master Kanban", // ⚠️ MUST MATCH
  "description": "A visual Kanban board...",  // ⚠️ MUST MATCH
}
```

#### VS Code Configuration
```json
{
  "engines": { "vscode": "^1.101.0" },   // ⚠️ MUST MATCH
  "categories": [...],                    // ⚠️ MUST MATCH
  "activationEvents": [...],              // ⚠️ MUST MATCH
  "main": "./dist/extension.js",          // ⚠️ MUST MATCH
  "contributes": { ... }                  // ⚠️ MUST MATCH EXACTLY
}
```

### Key Differences (Should NOT Match)
```json
// package.json (dev)
{
  "name": "taskr",                       // ✅ Short dev name
  "devDependencies": { ... },            // ✅ Only in dev file
  "scripts": { ... }                     // ✅ Build scripts
}

// package.publish.json (publishing)
{
  "name": "taskr-kanban",               // ✅ Marketplace name
  "keywords": [...],                     // ✅ Only in publish file
  "repository": "https://github.com/...", // ✅ Only in publish file
  // NO devDependencies                  // ✅ Clean for publishing
  // NO build scripts                    // ✅ Not needed in package
}
```

## 🔍 Troubleshooting

### Dependency Conflicts
**Problem**: `vsce package` fails with missing dependencies
**Solution**: Use the 3-file system - never run `vsce package` from root

### Build Failures
**Problem**: Extension not working after build
**Check**:
1. All files copied to `vsix-build/dist/`
2. `package.publish.json` has correct `main` field
3. VS Code engine version compatibility

### Sync Issues
**Problem**: Extension works locally but fails when packaged
**Check**: Ensure critical fields are synced between package files

## 📝 Version Release Checklist

1. **Update version** in both `package.json` and `package.publish.json`
2. **Update CHANGELOG.md** with new features/fixes
3. **Test locally** with `F5` in VS Code
4. **Build clean package**: `pnpm run package`
5. **Test packaged extension**: Install `.vsix` file
6. **Publish**: Upload to marketplace or distribute `.vsix`

## 🎯 Why This System?

- **Avoids dependency conflicts**: VS Code doesn't see dev dependencies
- **Clean distribution**: Only essential files in final package
- **Faster packaging**: No dependency resolution during `vsce package`
- **Maintainable**: Clear separation of dev vs. production configs
- **Reliable**: Consistent, conflict-free packaging process

---

**Remember**: Always use `pnpm run package` → `cd vsix-build` → `vsce package --no-dependencies` for production builds! 🚀 