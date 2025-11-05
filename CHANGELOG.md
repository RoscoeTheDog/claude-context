# Changelog

All notable changes to Claude Context will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Smart Adaptive Search Results (v0.5.0 Story 1)**: Automatic token optimization for `search_code` MCP tool
  - **Zero-thought token savings**: Automatically adapts result format based on result count (no agent configuration required)
  - **Progressive detail levels** with auto-detection thresholds:
    - **1-3 results**: Full detail with code snippets (0% savings, baseline)
    - **4-10 results**: Compact format with truncated code (~50% token reduction)
    - **11-25 results**: Summary format with descriptions only (~75% token reduction)
    - **26+ results**: Locations only with file paths (~90% token reduction)
  - **Power user overrides**: Optional `detail` parameter to force specific format (`full`, `compact`, `summary`, `locations`)
  - **Self-documenting tool schema**: Enhanced MCP tool description with USE WHEN/DON'T USE guidance and progressive examples
  - **Backward compatible**: Existing calls work unchanged, all features opt-in via `CC_SMART_RESULTS=true`
  - **Implementation**: New `formatters/` module with 4 specialized formatters + auto-detection orchestrator
  - **Comprehensive testing**: 35 unit tests covering auto-detection, formatters, token efficiency, and feature flags

- **Feature Flag Infrastructure (v0.5.0)**: Centralized system for controlling optional token efficiency enhancements
  - **2 feature flags** with environment variable support:
    - `CC_SMART_RESULTS` - Smart adaptive search results (40-70% token reduction, Story 1)
    - `CC_ALLOW_EXPERIMENTAL` - Global experimental features toggle
  - **Safety-first design**: All flags default to OFF (disabled) for backward compatibility
  - **Silent fallback behavior**: Features gracefully fallback to legacy behavior when disabled (no errors thrown)
  - **Health check integration**: Feature flag status visible in `health_check` MCP tool output
  - **Comprehensive testing**: 24 unit tests covering flag parsing, environment variables, and fallback behavior
  - **Documentation**: Detailed usage guide in environment-variables.md with examples
  - **Implementation**: New `feature-flags.ts` module with helper functions:
    - `FEATURE_FLAGS` - Immutable flag configuration object
    - `isFeatureEnabled()` - Check if specific feature is enabled
    - `getAllFeatureFlags()` - Get all flags as object (for logging/debugging)
    - `getFeatureFlagsSummary()` - Get human-readable status summary

- **Self-Documenting Tool Descriptions (v0.5.0 Story 3)**: Enhanced all MCP tool descriptions for agent discoverability
  - **Junior dev discovery pattern**: Tools now answer "What?", "When?", "When NOT?", "How?", "Options?", "Examples?"
  - **Updated 15 MCP tools** with consistent formatting:
    - Emoji + one-line summary for quick identification
    - USE WHEN section (positive use cases)
    - DON'T USE section with redirects to correct tools (prevents misuse)
    - BASIC usage example with minimal parameters
    - RETURNS section explaining what agents should expect
    - OPTIONAL PARAMS listing with defaults
    - Progressive EXAMPLES (basic → intermediate → advanced)
  - **Cross-references**: Clear guidance on when to use Claude Context vs Serena tools
  - **Token efficient**: All descriptions under 500 chars (avg: 406 chars)
  - **Prevents tool misuse**: Clear anti-patterns reduce wasted token usage from incorrect tool selection
  - **Zero learning curve**: Agents discover tool capabilities from schema alone (no external docs required)

---

## [0.4.0] - 2025-11-04

### ⚠️ BREAKING CHANGES

- **Removed DEFAULT_IGNORE_PATTERNS**: The system no longer ignores any directories by default
  - **Previous behavior**: Automatically ignored `node_modules/**`, `.git/**`, `dist/**`, and ~40 other patterns
  - **New behavior**: By default, ALL files and directories are indexed for complete search accuracy
  - **Migration**: If you relied on default ignores, use MCP tools to configure per-codebase ignore patterns:
    ```typescript
    mcp__claude-context__update_codebase_config({
      path: "/path/to/codebase",
      ignorePatterns: ["node_modules/**", ".git/**", "dist/**"],
      enableDirectoryPruning: true  // Enable performance optimization
    })
    ```

- **Removed environment variable configuration**: `CUSTOM_IGNORE_PATTERNS` environment variable is no longer supported
  - **Migration**: Use per-codebase configuration stored in the database instead (see above)

### Added

- **Per-Codebase Configuration System**: New database-backed configuration for indexed codebases
  - **4 new MCP tools** for managing codebase-specific settings:
    - `get_codebase_config` - View current configuration for a codebase
    - `update_codebase_config` - Update configuration (supports partial updates)
    - `reset_codebase_config` - Reset configuration to defaults
    - `list_codebase_configs` - List all configured codebases
  - **Storage**: Configurations stored in Milvus database (no filesystem pollution)
  - **Persistent**: Settings survive across sessions
  - **Per-codebase**: Each indexed codebase has independent configuration
  - **Configurable options**:
    - `ignorePatterns` - Patterns to exclude during indexing
    - `maxFileSize` - Maximum file size to index (default: 10MB)
    - `fileExtensions` - Only index specific extensions (empty = all)
    - `followSymlinks` - Follow symbolic links (default: false)
    - `indexHiddenFiles` - Index hidden files (default: true)
    - `indexBinaryFiles` - Attempt to index binary files (default: false)

- **Performance optimization (opt-in)**: Early directory pruning for faster sync operations
  - Available when `ignorePatterns` are configured for a codebase
  - Skips ignored directories before traversing them
  - Can reduce sync time by 90-95% on large codebases with node_modules
  - **Default**: Disabled (indexes everything for accuracy)
  - **To enable**: Configure ignore patterns via `update_codebase_config`

### Changed

- **Default indexing behavior**: Now indexes ALL files by default (including node_modules, .git, etc.)
  - Prioritizes search completeness over performance
  - Users can opt-in to performance optimizations via per-codebase configuration
  - Configuration system now available for easy management of indexing behavior

### Technical Details
- Added `CodebaseConfigManager` class for database-backed configuration storage
- Implemented `getClient()` method in `VectorDatabase` interface and implementations
- Added `Context.initialize()` async method for config manager setup
- Modified `Context.loadIgnorePatterns()` to load from database config first
- Added 4 new MCP tool handlers in `ToolHandlers` class
- Registered 4 new MCP tools in server tool list
- Removed `DEFAULT_IGNORE_PATTERNS` constant from context.ts
- Removed `getCustomIgnorePatternsFromEnv()` method
- Modified `FileSynchronizer.generateFileHashes()` to support early directory pruning
- Added comments clarifying opt-in nature of optimization

## [0.3.0] - 2025-11-04

### Added
- **Index Tree Viewer**: New `get_index_tree` MCP tool for visualizing indexed directory structure with file and chunk statistics
  - **Tree format**: Classic tree view with box-drawing characters and statistics
  - **List format**: Flat list output for easy parsing and programmatic processing
  - **Subdirectory filtering**: Focus on specific areas using `relative_path` parameter
  - **Depth control**: Limit tree depth to manage output size (default: 3 levels)
  - **Flexible display**: Options to show/hide files and statistics
- Parameters:
  - `path` (required): Absolute path to indexed codebase
  - `relative_path` (optional): Filter to specific subdirectory
  - `depth` (optional): Maximum depth to display (default: 3, -1 = unlimited)
  - `format` (optional): "tree" or "list" output format (default: "tree")
  - `show_files` (optional): Show individual files or directories only (default: true)
  - `include_stats` (optional): Include file and chunk counts (default: true)

### Use Cases
- Verify what files have been indexed
- Understand codebase structure before searching
- Navigate large codebases efficiently
- Generate architecture overviews
- Token-efficient alternative to multiple file operations

### Improved
- Token efficiency: 80-90% reduction vs bash `tree` + multiple `ls` commands
- Performance: Fast metadata-only queries (no content loading)
- User experience: Single tool call replaces 3-5 separate operations

### Technical Details
- Implemented `buildTreeFromPaths()` for efficient tree construction
- Added `calculateStats()` for recursive file/chunk aggregation
- Created `renderTree()` and `renderList()` formatters with depth limiting
- Path normalization handles Windows/Unix separators correctly
- 47 new test cases (111 total tests, all passing)
- Integration tests cover all major use cases and error scenarios

### Backward Compatibility
- Fully backward compatible - no breaking changes to existing tools
- New tool is opt-in and doesn't affect existing workflows

---

## [0.2.0] - 2025-11-04

### Added
- **Smart Parent Index Detection**: `index_codebase` now automatically detects and reuses parent directory indexes, preventing duplicate indexing and saving 85-90% tokens in subdirectory sessions
- **scope Parameter**: New optional `scope` parameter for `index_codebase` ("auto" | "local") to control parent detection behavior
  - `"auto"` (default): Automatically detect and reuse parent indexes (recommended)
  - `"local"`: Force indexing only the specified directory
- Cross-platform parent traversal with support for Windows, macOS, and Linux filesystem roots
- Detection priority system: `.claude-context/` directory → snapshot check → `.git/` boundary → filesystem root
- Added `reused` flag to index response metadata for improved agent decision-making

### Improved
- Token efficiency: Reduced runtime token usage by ~350-850 tokens per session for subdirectory operations
- User experience: Seamless search across entire projects from any subdirectory location
- Storage efficiency: Single index per project eliminates duplicate indexes and wasted compute
- Cross-platform compatibility: Handles Unix `/`, Windows `C:\`, and UNC paths correctly

### Technical Details
- Implemented `findParentIndex()` utility for upward directory traversal
- Added `isFilesystemRoot()`, `resolveRealPath()`, and `directoryExists()` helper functions
- Symlink resolution for accurate path handling on all platforms
- Comprehensive error handling for permission errors and edge cases
- 74 test cases covering unit, integration, and cross-platform scenarios

### Backward Compatibility
- All existing `index_codebase` calls work without changes
- `scope` parameter defaults to "auto" (smart detection enabled)
- `force=true` preserves existing re-index behavior (skips parent detection)
- Response format extended with optional `reused` flag (non-breaking)

### Breaking Changes
None - this release is fully backward compatible

---

## [0.1.4] - 2025-11-02

### Added
- Automatic real-time sync enablement after indexing completes

### Improved
- Better user experience with automatic sync activation

---

## [0.1.3] - Previous Release

### Added
- Real-time filesystem synchronization with zero-delay index updates
- 8 new MCP tools for comprehensive sync management and monitoring
- Connection pooling and mtime caching for 5x performance improvement
- Comprehensive monitoring, health checks, and audit trails

### Improved
- Performance optimizations across all core operations
- Enhanced error handling and reliability

---

For older changelog entries, see the Git history or individual package changelogs.
