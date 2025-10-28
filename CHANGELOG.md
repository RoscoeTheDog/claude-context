# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-10-27

### Added
- **Auto-Enable Real-Time Sync**: New feature to automatically enable real-time filesystem sync after successful indexing
  - Environment variable `REALTIME_SYNC_AUTO_ENABLE` (default: `false`, opt-in)
  - Can be set in MCP server configuration or `~/.context/.env`
  - Graceful error handling - indexing succeeds even if auto-enable fails
  - Detailed logging for debugging
- **Troubleshooting Documentation**: Added comprehensive troubleshooting section for auto-enable feature in `CLAUDE_INSTALL.md`
- **Test Infrastructure**: Created `.testing/` directory with test scripts and sample codebases for validation

### Changed
- Updated `Context.indexCodebase()` to check for auto-enable configuration after successful indexing
- Enhanced `EnvManager` to support reading environment variables from both `process.env` and `~/.context/.env`

### Documentation
- Added auto-enable feature documentation to `CLAUDE_INSTALL.md`
- Updated `.env.example` with `REALTIME_SYNC_AUTO_ENABLE` and `REALTIME_SYNC_DEBOUNCE_MS` variables
- Created test report documenting feature behavior and MCP restart requirement
- Added troubleshooting guide for when auto-enable doesn't work as expected

### Technical Details
- Implementation location: `packages/core/src/context.ts` (lines 304-310, 389-400)
- Policy: P2 (Opt-in default) - Auto-enable must be explicitly enabled for safety
- Policy: P3 (Non-critical) - Indexing succeeds even if auto-enable fails

### Known Issues
- MCP server restart required after adding/modifying `REALTIME_SYNC_AUTO_ENABLE` environment variable
- Workaround: Restart Claude Code CLI or Claude Desktop after configuration changes
- Alternative: Use `~/.context/.env` for persistent configuration

## [0.1.3] - Previous Release

Initial release with core indexing and real-time sync features.
