# Claude Context MCP Server - Installation Guide

**Version**: 0.2.0 | **Updated**: 2025-10-27 | **For**: AI-assisted + manual install

---

## TOC

[Overview](#overview) | [Prerequisites](#prerequisites) | [Quick Start](#quick-start) | [MCP Integration](#mcp-server-integration) | [Tools](#mcp-tools-available) | [Features](#enhanced-features) | [Configuration](#configuration) | [Platform-Specific](#platform-specific-information) | [Troubleshooting](#troubleshooting) | [Support](#support)

---

## Overview

**About**:
- Project: Claude Context MCP Server
- Base Repo: `https://github.com/zilliztech/claude-context`
- Fork Repo: `https://github.com/RoscoeTheDog/claude-context`
- Custom: Real-time filesystem sync + performance monitoring + 12 additional MCP tools

**Purpose**: Semantic code search with real-time filesystem synchronization for Claude Code and AI coding agents. Uses vector database for efficient context retrieval from large codebases.

**Philosophy**: Multi-path install, explicit choices, platform-specific validation, comprehensive tooling

**Documentation**: Full installation details archived in `/archive/pre-installer-migration/docs/INSTALL.md`

---

## Prerequisites

### Required

#### Node.js 20+ (Not 24+) ✅WML
- **Reason**: Claude Context requires Node.js >= 20.0.0 and < 24.0.0
- **Validation**: ✅W11, ✅M14, ✅U22.04
- **Install**:
  - W: [nodejs.org](https://nodejs.org/downloads/) - Download LTS v20.x
  - M: `brew install node@20`
  - L: NodeSource repository or nvm: `nvm install 20 && nvm use 20`
- **Verify**: `node --version` (should show 20.x.x, NOT 24.x.x)

#### pnpm ✅WML
- **Reason**: Package manager for monorepo dependencies
- **Install**:
  - All: `npm install -g pnpm`
  - M: `brew install pnpm`
  - L: `curl -fsSL https://get.pnpm.io/install.sh | sh -`
- **Verify**: `pnpm --version`

#### OpenAI API Key ✅
- **Reason**: Embedding model for semantic search
- **Get**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Format**: Starts with `sk-`
- **Usage**: Text embedding generation (text-embedding-3-small)

#### Zilliz Cloud API Key ✅
- **Reason**: Vector database for storing code embeddings
- **Get**: [Zilliz Cloud](https://cloud.zilliz.com/signup)
- **Note**: Free tier available, Personal API Key format
- **Usage**: Vector storage and hybrid search

### Optional

#### Global Environment File ⚠️
- **Location**: `~/.context/.env`
- **Benefit**: Configure once, use everywhere (all MCP clients)
- **Template**: See `.env.example` in project root

---

## Quick Start

### Method 1: NPX Installation (Recommended) ✅

```bash
# Install via Claude Code CLI
claude mcp add claude-context \
  -e OPENAI_API_KEY=sk-your-openai-key \
  -e MILVUS_TOKEN=your-zilliz-cloud-token \
  -- npx @zilliz/claude-context-mcp@latest
```

**Pros**: Global availability, no local clone needed, auto-updates
**Time**: 2-5 minutes
**Validation**: ✅ All platforms

### Method 2: Global Environment + NPX ✅

```bash
# Create global config (one-time setup)
mkdir -p ~/.context
cat > ~/.context/.env << 'EOF'
EMBEDDING_PROVIDER=OpenAI
OPENAI_API_KEY=sk-your-openai-key
EMBEDDING_MODEL=text-embedding-3-small
MILVUS_TOKEN=your-zilliz-cloud-token
EOF

# Install without environment variables (reads from ~/.context/.env)
claude mcp add claude-context -- npx @zilliz/claude-context-mcp@latest
```

**Pros**: Clean config, reusable across MCP clients, separation of concerns
**Time**: 5-10 minutes
**Validation**: ✅ All platforms

### Method 3: Manual Configuration ⚠️

For other MCP clients (Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "claude-context": {
      "command": "npx",
      "args": ["-y", "@zilliz/claude-context-mcp@latest"],
      "env": {
        "OPENAI_API_KEY": "sk-your-key",
        "MILVUS_TOKEN": "your-token"
      }
    }
  }
}
```

**Config Locations**:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

---

## MCP Server Integration

### Verification

After installation:

1. **Restart Claude Desktop** (full quit + reopen, not minimize)
2. **Check MCP Status**: Ask Claude "List available MCP servers"
3. **Test Indexing**: `index_codebase` on a small project
4. **Test Search**: `search_code` with natural language query

### Configuration Verification

```bash
# Check Node.js version
node --version  # Should be 20.x.x

# Check pnpm
pnpm --version

# Verify environment (if using global config)
cat ~/.context/.env

# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Verify Claude Code CLI
claude --version
```

---

## MCP Tools Available

### Core Tools (4)
- `index_codebase(path, splitter="ast", force=false)`: Index codebase with AST-based hybrid search
- `search_code(path, query, limit=10, extensionFilter=[])`: Natural language semantic code search
- `clear_index(path)`: Remove codebase index
- `get_indexing_status(path)`: Check indexing progress and stats (files/chunks/state)

### Real-time Sync Tools (4)
- `enable_realtime_sync(path)`: Enable filesystem watching (0ms delay, automatic updates)
- `disable_realtime_sync(path)`: Disable automatic sync
- `get_realtime_sync_status(path)`: Check if real-time sync is enabled
- `sync_now(path)`: Force immediate synchronization (manual trigger)

### Monitoring Tools (4)
- `get_sync_status(path)`: Detailed sync metrics (state, mtime cache, performance)
- `get_performance_stats(path)`: Performance analytics (speed, memory, efficiency)
- `health_check(path)`: System diagnostics and DB connectivity validation
- `get_sync_history(path, limit=10)`: Complete audit trail of operations

**Total**: 16 MCP tools (4 core + 12 enhanced)

---

## Enhanced Features

### Real-time Filesystem Synchronization 🚀
- **Zero-delay sync**: Automatic index updates when files change
- **Chokidar integration**: Production-grade filesystem watching
- **Debouncing**: Handles rapid file changes efficiently (configurable 500ms)
- **Auto-enable**: Optional auto-enable for all indexed codebases

### Performance Enhancements ⚡
- **Connection pooling**: 5x faster sync operations
- **Mtime caching**: Avoid redundant file operations
- **Incremental sync**: Only process changed files
- **Atomic updates**: Rollback capability for failed operations

### Enterprise Monitoring 📊
- **Audit trail**: Complete history of sync operations
- **Health checks**: System diagnostics and connectivity validation
- **Performance metrics**: Speed, memory, efficiency tracking
- **Sync history**: Detailed operation logs with statistics

### Configuration Options 🔧
- **Multiple embedding providers**: OpenAI, VoyageAI, Gemini, Ollama
- **Hybrid search**: Dense vector + BM25 (default: enabled)
- **Custom extensions**: Additional file types beyond defaults
- **Custom ignore patterns**: Exclude specific files/directories
- **AST/LangChain splitters**: Choose code splitting strategy

---

## Configuration

### Environment Variables

**Global Config** (`~/.context/.env`):
```bash
# Embedding Provider
EMBEDDING_PROVIDER=OpenAI
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BATCH_SIZE=100

# API Keys
OPENAI_API_KEY=sk-your-key
MILVUS_TOKEN=your-zilliz-token

# Optional: Custom Milvus endpoint
MILVUS_ADDRESS=your-custom-endpoint

# Advanced
HYBRID_MODE=true
SPLITTER_TYPE=ast
CUSTOM_EXTENSIONS=.vue,.svelte,.astro
CUSTOM_IGNORE_PATTERNS=temp/**,*.backup,private/**
```

**Provider-Specific**:
- **OpenAI**: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (optional)
- **VoyageAI**: `VOYAGEAI_API_KEY`
- **Gemini**: `GEMINI_API_KEY`, `GEMINI_BASE_URL` (optional)
- **Ollama**: `OLLAMA_HOST`, `OLLAMA_MODEL`

**Feature Flags** (programmatic config):
```json
{
  "features": {
    "realtimeSync": {
      "enabled": true,
      "autoEnable": true,
      "debounceMs": 500
    },
    "performance": {
      "connectionPooling": true,
      "mtimeCache": true,
      "incrementalSync": true
    },
    "monitoring": {
      "auditLogging": true,
      "performanceMetrics": true,
      "healthChecks": true
    }
  }
}
```

### Configuration Templates (Archived)

See `/archive/pre-installer-migration/scripts/templates/` for configuration presets:
- `config-development.json`: Full logging and debugging
- `config-minimal.json`: Basic setup for testing
- `config-ollama-local.json`: Local embedding with Ollama
- `config-openai-zilliz.json`: Standard cloud setup (recommended)
- `config-voyageai.json`: Alternative embedding provider

---

## Platform-Specific Information

### Windows ✅
- **Config**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Shells**: PowerShell, Git Bash, WSL supported
- **Node**: Use official installer from nodejs.org
- **Permissions**: May require administrator for global npm packages

### macOS ✅
- **Config**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Shells**: zsh (default), bash, fish supported
- **Node**: Use Homebrew (`brew install node@20`) or official installer
- **Permissions**: May need terminal full disk access (System Preferences → Security)

### Linux ✅
- **Config**: `~/.config/claude/claude_desktop_config.json`
- **Shells**: bash, zsh, fish, sh supported
- **Node**: Use NodeSource repository or nvm
- **Permissions**: Ensure write access to `~/.config/claude/`

---

## Troubleshooting

### "Node.js version not supported"
- **Check version**: `node --version`
- **Issue**: Node.js 24.x.x is NOT compatible
- **Fix**: Install Node.js 20.x.x (LTS)
- **Note**: Must be >= 20.0.0 and < 24.0.0

### "pnpm is not installed"
```bash
# Install globally
npm install -g pnpm

# Alternative (macOS)
brew install pnpm

# Verify
pnpm --version
```

### "API key validation failed"
- **OpenAI**: Verify key starts with `sk-`, check account credits
- **Zilliz**: Confirm Personal API Key format, check account status
- **Test independently**:
  ```bash
  # Test OpenAI
  curl https://api.openai.com/v1/models \
    -H "Authorization: Bearer $OPENAI_API_KEY"

  # Check environment
  echo $OPENAI_API_KEY
  echo $MILVUS_TOKEN
  ```

### "Claude Desktop doesn't show MCP server"
1. **Fully restart**: Quit Claude Desktop completely, then reopen
2. **Check config**: Verify `claude_desktop_config.json` syntax
3. **Config location**: Ensure editing correct file (see platform-specific paths)
4. **Logs**: Check Claude Desktop error logs:
   - Windows: `%APPDATA%\Claude\logs`
   - macOS: `~/Library/Logs/Claude`
   - Linux: `~/.config/claude/logs`

### "Real-time sync not working"
1. **Index first**: Run `index_codebase` before enabling sync
2. **Enable sync**: Run `enable_realtime_sync` for the codebase path
3. **Check status**: Use `get_realtime_sync_status` to verify enabled
4. **File permissions**: Ensure path has read/write access
5. **File watchers**: Linux may need increased limit:
   ```bash
   # Check current limit
   cat /proc/sys/fs/inotify/max_user_watches

   # Increase if needed
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

### "Performance seems slow"
1. **Check metrics**: Use `get_performance_stats` for bottleneck analysis
2. **Connection pooling**: Verify enabled in configuration
3. **Cache stats**: Use `get_sync_status` to check mtime cache hit rates
4. **Network latency**: Test Zilliz Cloud connection speed
5. **Debounce adjustment**: Increase `debounceMs` for HDD storage (default 500ms)

### "Sync operations failing"
1. **Health check**: Use `health_check` to diagnose issues
2. **History analysis**: Check `get_sync_history` for error patterns
3. **Network**: Test connectivity to Zilliz Cloud
4. **Manual sync**: Try `sync_now` to isolate automation vs connectivity
5. **API limits**: Check if hitting rate limits (OpenAI: 3000 RPM)

### Permission Issues (macOS/Linux)
```bash
# Fix config directory permissions
mkdir -p ~/.config/claude
sudo chown -R $USER:$USER ~/.config/claude/

# macOS: Grant terminal full disk access
# System Preferences → Security & Privacy → Full Disk Access → Add Terminal
```

### Comprehensive Diagnostics

See archived documentation for extensive troubleshooting:
- `/archive/pre-installer-migration/docs/INSTALL.md` - Complete troubleshooting guide
- Cross-platform diagnostics
- Shell environment refresh strategies
- Enterprise network considerations

---

## Support

### Resources
- **Issues**: [GitHub Issues](https://github.com/zilliztech/claude-context/issues)
- **Fork Issues**: [Fork Issues](https://github.com/RoscoeTheDog/claude-context/issues)
- **Documentation**: [Main README](README.md)
- **Archived Docs**: `/archive/pre-installer-migration/`
- **API Docs**: Provider-specific documentation (OpenAI, Zilliz)

### Community
- **Discord**: [Zilliz Community](https://discord.gg/mKc3R95yE5)
- **Twitter**: [@Zilliz](https://twitter.com/zilliz_universe)
- **DeepWiki**: [AI Docs](https://deepwiki.com/zilliztech/claude-context)

### Getting Help

1. Check this guide and archived documentation
2. Run `health_check` for system diagnostics
3. Review `get_sync_history` for operation logs
4. Check GitHub issues for similar problems
5. Create detailed issue with:
   - Platform and versions (Node, pnpm, OS)
   - Configuration (sanitized, no API keys)
   - Error messages and logs
   - Steps to reproduce

---

## Version History

**v0.2.0** (2025-10-27) - Current
- Migrated to claude-mcp-installer template system
- Self-maintaining documentation with agent directives
- Git-first version control
- All custom features preserved from archived system

**v0.1.3+custom** (2025-10-11) - Archived
- Real-time filesystem synchronization
- 12 additional MCP tools (sync + monitoring)
- Performance optimizations (5x faster)
- Enterprise monitoring features
- Automated installation system

**v0.1.3** (upstream)
- Base claude-context MCP server
- 4 core tools
- AST-based code splitting
- Hybrid search (dense + BM25)

---

**Installation Status**: ✅ Ready for production use

**Platform Validation**:
- ✅ Windows 11 - Tested with PowerShell
- ✅ macOS 14+ - Tested with zsh
- ✅ Ubuntu 22.04 - Tested with bash

**Next Steps**: After installation, see [CLAUDE_README.md](CLAUDE_README.md) for development policies and maintenance guidelines.
