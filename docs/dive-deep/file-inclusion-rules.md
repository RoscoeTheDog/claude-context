# File Inclusion & Exclusion Rules

This document explains how Claude Context determines which files to include in the indexing process and which files to exclude.

## Overview

Claude Context uses a comprehensive rule system that combines multiple sources of file extensions and ignore patterns to determine what gets indexed.

## The Core Rule

```
Final Files = (All Supported Extensions) - (All Ignore Patterns)
```

Where:
- **All Supported Extensions** = Default + MCP Custom + Environment Variable Extensions
- **All Ignore Patterns** = MCP Custom + .gitignore + .xxxignore + Global .contextignore

**⚠️ IMPORTANT**: As of v0.4.0, there are NO default ignore patterns. By default, ALL files are indexed for complete search accuracy. Users must explicitly configure ignore patterns if desired.

## File Inclusion Flow

![File Inclusion Flow](../../assets/docs/file-inclusion-flow.png)

The diagram above shows how different sources contribute to the final file selection process.

## Extension Sources (Additive)

All extension sources are combined together:

### 1. Default Extensions
Built-in supported file extensions including:
- Programming languages: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.hpp`, `.cs`, `.go`, `.rs`, `.php`, `.rb`, `.swift`, `.kt`, `.scala`, `.m`, `.mm`
- Documentation: `.md`, `.markdown`, `.ipynb`

For more details, see [DEFAULT_SUPPORTED_EXTENSIONS](../../packages/core/src/context.ts) in the context.ts file.


### 2. MCP Custom Extensions
Additional extensions passed dynamically via MCP `customExtensions` parameter:
```json
{
  "customExtensions": [".vue", ".svelte", ".astro"]
}
```
Just dynamically tell the agent what extensions you want to index to invoke this parameter. For example:
```
"Index this codebase, and include .vue, .svelte, .astro files"
```

### 3. Environment Variable Extensions
Extensions from `CUSTOM_EXTENSIONS` environment variable:
```bash
export CUSTOM_EXTENSIONS=".vue,.svelte,.astro"
```
See [Environment Variables](../getting-started/environment-variables.md) for more details about how to set environment variables.

## Ignore Pattern Sources (Additive)

All ignore pattern sources are combined together:

### 1. ~~Default Ignore Patterns~~ (REMOVED in v0.4.0)

**⚠️ BREAKING CHANGE**: As of v0.4.0, there are NO default ignore patterns.

- **Previous behavior** (v0.3.0 and earlier): Automatically ignored `node_modules/**`, `.git/**`, `dist/**`, and ~40 other patterns
- **New behavior** (v0.4.0+): By default, ALL files and directories are indexed for complete search accuracy
- **Why changed**: Prioritizes search completeness and accuracy over performance
- **Migration**: Configure ignore patterns explicitly using MCP tools (see below)

### 2. MCP Custom Ignore Patterns
Additional patterns passed dynamically via MCP `ignorePatterns` parameter:
```json
{
  "ignorePatterns": ["temp/**", "*.backup", "private/**"]
}
```
Just dynamically tell the agent what patterns you want to exclude to invoke this parameter. For example:
```
"Index this codebase, and exclude temp/**, *.backup, private/** files"
```

### 3. ~~Environment Variable Ignore Patterns~~ (REMOVED in v0.4.0)

**⚠️ BREAKING CHANGE**: The `CUSTOM_IGNORE_PATTERNS` environment variable is no longer supported as of v0.4.0.

- **Migration**: Use per-codebase configuration stored in the database instead (coming in future release)
- **Current workaround**: Pass `ignorePatterns` via MCP parameters directly

### 4. .gitignore Files
Standard Git ignore patterns in codebase root.

### 5. .xxxignore Files
Any file in codebase root matching pattern `.xxxignore`:
- `.cursorignore`
- `.codeiumignore` 
- `.contextignore`
- etc.

### 6. Global .contextignore
User-wide patterns in `~/.context/.contextignore`.
