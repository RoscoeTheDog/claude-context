# Changelog

All notable changes to Claude Context will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
