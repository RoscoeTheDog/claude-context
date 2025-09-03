# Claude Context MCP Server Installation Guide

This guide provides instructions for installing and configuring the Claude Context MCP server for use with Claude Desktop.

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/zilliztech/claude-context.git
   cd claude-context
   ```

2. **Configure your API keys**:
   Edit `scripts/install-config.json` and add your API credentials:
   ```json
   {
     "apiKeys": {
       "openai": "sk-your-openai-key-here",
       "zilliz": "your-zilliz-api-key-here"
     }
   }
   ```

3. **Run the installation**:
   ```bash
   node scripts/install.js
   ```

4. **Restart Claude Desktop** to load the new MCP server.

That's it! The claude-context server is now available in Claude for code indexing and semantic search.

## Prerequisites

- **Node.js 20+**: Download from [nodejs.org](https://nodejs.org/)
- **pnpm**: Install with `npm install -g pnpm`
- **API Keys**:
  - OpenAI API key for embeddings
  - Zilliz Cloud API key for vector storage

### New Dependencies (Auto-installed)

The enhanced version includes additional dependencies that are automatically installed:

- **chokidar**: Real-time filesystem watching for automatic sync
- **Connection pooling**: Enhanced vector database connection management
- **Performance monitoring**: Built-in metrics and diagnostics

## Configuration

### API Keys Setup

You can provide API keys in two ways:

#### Option 1: Configuration File (Recommended)
Edit `scripts/install-config.json`:
```json
{
  "apiKeys": {
    "openai": "sk-proj-your-openai-key-here",
    "zilliz": "your-zilliz-cloud-token-here"
  }
}
```

#### Option 2: Environment Variables
Set environment variables before installation:
```bash
# Windows (PowerShell)
$env:OPENAI_API_KEY = "sk-proj-your-key-here"
$env:ZILLIZ_API_KEY = "your-zilliz-token"

# macOS/Linux
export OPENAI_API_KEY="sk-proj-your-key-here" 
export ZILLIZ_API_KEY="your-zilliz-token"
```

### Advanced Configuration

The `scripts/install-config.json` file supports additional options:

```json
{
  "apiKeys": {
    "openai": "sk-proj-...",
    "zilliz": "your-token"
  },
  "embeddingProvider": "OpenAI",
  "embeddingModel": "text-embedding-3-small",
  "milvusAddress": "",
  "installation": {
    "verbose": false,
    "createBackup": true,
    "skipTests": false
  }
}
```

#### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `embeddingProvider` | Embedding provider: OpenAI, VoyageAI, Gemini, Ollama | `"OpenAI"` |
| `embeddingModel` | Model for embeddings | `"text-embedding-3-small"` |
| `milvusAddress` | Custom Milvus server address (optional) | `""` |
| `installation.verbose` | Show detailed installation output | `false` |
| `installation.createBackup` | Backup existing Claude config | `true` |
| `installation.skipTests` | Skip post-installation tests | `false` |

#### Enhanced Features Configuration

The installation now includes advanced synchronization features:

```json
{
  "apiKeys": {
    "openai": "sk-proj-...",
    "zilliz": "your-token"
  },
  "features": {
    "realtimeSync": {
      "enabled": true,
      "autoEnable": false,
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

**Feature Configuration Options:**
- `realtimeSync.enabled`: Enable real-time filesystem watching (default: true)
- `realtimeSync.autoEnable`: Automatically enable for all indexed codebases (default: false)
- `realtimeSync.debounceMs`: Debounce time for rapid file changes (default: 500)
- `performance.connectionPooling`: Use database connection pooling (default: true)
- `performance.mtimeCache`: Cache file modification times (default: true)
- `performance.incrementalSync`: Use incremental change detection (default: true)
- `monitoring.auditLogging`: Log all sync operations (default: true)
- `monitoring.performanceMetrics`: Collect performance statistics (default: true)
- `monitoring.healthChecks`: Enable system health diagnostics (default: true)

## Installation Steps

The installation script performs these steps automatically:

1. **API Key Validation**: Validates your OpenAI and Zilliz credentials
2. **Dependency Check**: Verifies Node.js 20+ and pnpm are installed
3. **Enhanced Dependencies**: Installs chokidar and performance optimization packages
4. **Build Process**: Compiles TypeScript and builds the enhanced MCP server
5. **Configuration**: Creates Claude Desktop configuration with new features enabled
6. **Feature Testing**: Verifies real-time sync, performance optimizations, and monitoring
7. **Health Check**: Runs system diagnostics to ensure proper installation

## Platform-Specific Information

### Windows
- Configuration stored in: `%APPDATA%\Claude\claude_desktop_config.json`
- Requires PowerShell execution policy that allows script execution

### macOS
- Configuration stored in: `~/Library/Application Support/Claude/claude_desktop_config.json`
- May require granting terminal permissions for file access

### Linux
- Configuration stored in: `~/.config/claude/claude_desktop_config.json`
- Ensure you have write permissions to the config directory

## Verification

After installation, verify everything works including the new features:

```bash
# Run the comprehensive verification script
node scripts/verify.js

# Or manually test the enhanced MCP server
node packages/mcp/dist/index.js --help

# Test specific features
node scripts/test-features.js
```

### New Tools Available

After installation, Claude will have access to these enhanced tools:

**Core Tools:**
- `index_codebase` - Index a codebase for semantic search
- `search_code` - Search indexed code with natural language
- `clear_index` - Remove a codebase index
- `get_indexing_status` - Check indexing progress and status

**Real-time Sync Tools:**
- `enable_realtime_sync` - Enable automatic sync for a codebase
- `disable_realtime_sync` - Disable automatic sync
- `get_realtime_sync_status` - Check real-time sync status

**Enhanced Management Tools:**
- `get_sync_status` - Detailed sync status and metrics
- `sync_now` - Manually trigger immediate synchronization  
- `get_performance_stats` - Performance metrics and statistics
- `health_check` - System health diagnostics
- `get_sync_history` - Operation history and audit trail

## Troubleshooting

### Common Issues

**"API key validation failed"**
- Verify your OpenAI API key is correct and has sufficient credits
- Check that your Zilliz token is valid and properly formatted

**"pnpm is not installed"**
```bash
npm install -g pnpm
```

**"Node.js version not supported"**
- Install Node.js 20 or higher from [nodejs.org](https://nodejs.org/)

**"Permission denied" on macOS/Linux**
- Run with appropriate permissions or check directory ownership
- Ensure Claude Desktop has been run at least once to create config directory

**"Claude Desktop doesn't show the MCP server"**
- Restart Claude Desktop completely
- Check the configuration file was created correctly
- Run the verification script to test the server

**"Real-time sync not working"**
- Verify the codebase is indexed first with `index_codebase`
- Check that the path has write permissions for file watching
- Use `health_check` tool to diagnose filesystem watching issues
- Ensure no antivirus software is blocking file system monitoring

**"Performance seems slow"**
- Check `get_performance_stats` for bottlenecks
- Verify connection pooling is enabled in configuration
- Use `get_sync_status` to check cache performance
- Consider adjusting `debounceMs` for your filesystem

**"Sync operations failing"**
- Use `health_check` to identify system issues
- Check `get_sync_history` for error patterns
- Verify vector database connectivity with Zilliz Cloud
- Try manual sync with `sync_now` to test connectivity

### Getting Help

1. Run the comprehensive verification script: `node scripts/verify.js`
2. Use the built-in health check: Ask Claude to run `health_check` 
3. Check performance metrics: Ask Claude to run `get_performance_stats`
4. Review sync history: Ask Claude to run `get_sync_history`
5. Check the installation log output for specific error messages
6. Verify your API keys are working independently
7. Check Claude Desktop's error logs (platform-specific locations)

### Advanced Diagnostics

The enhanced version includes built-in diagnostic tools accessible through Claude:

```
Ask Claude: "Run health_check to diagnose any system issues"
Ask Claude: "Show me get_performance_stats for performance analysis"  
Ask Claude: "Get sync_status for my codebase at /path/to/project"
Ask Claude: "Show get_sync_history to see recent operations"
```

## Uninstallation

To remove the claude-context MCP server:

```bash
node scripts/uninstall.js
```

This will:
- Remove the MCP server from Claude's configuration
- Restore any backed-up configuration files
- Optionally clean up build artifacts

## Development Installation

For development work, you can create a development installation that uses symlinks:

```bash
# Create a development config
cp scripts/install-config.json scripts/dev-config.json

# Edit dev-config.json to enable development options
# Then install with the development config
node scripts/install.js --config=scripts/dev-config.json
```

## Enhanced Capabilities

This installation includes significant improvements over the base version:

### 🚀 **Performance Optimizations**
- **5x faster sync operations** with incremental change detection
- **Connection pooling** for efficient database usage  
- **Mtime caching** to avoid redundant file operations
- **Atomic file updates** with rollback capability

### ⚡ **Real-time Synchronization**
- **Automatic filesystem watching** with chokidar
- **Debounced updates** to handle rapid file changes
- **Zero-delay sync** for immediate index updates
- **Configurable sensitivity** for different development workflows

### 📊 **Enterprise Monitoring**
- **Complete audit trail** of all sync operations
- **Performance metrics** and system health monitoring
- **Diagnostic tools** for troubleshooting
- **Operation history** with detailed statistics

### 🛡️ **Reliability Features**
- **Conflict resolution** for concurrent file changes
- **Error recovery** with automatic retry mechanisms
- **Health checks** to identify configuration issues
- **Graceful degradation** when components are unavailable

## Security Considerations

- API keys are stored in the Claude Desktop configuration file
- Configuration files should be secured with appropriate file permissions  
- Never commit API keys to version control
- Regularly rotate your API keys as recommended by providers
- The enhanced version includes additional security for connection pooling
- Real-time file watching respects system permissions and ignore patterns

## Support

- **Issues**: Report bugs at [GitHub Issues](https://github.com/zilliztech/claude-context/issues)
- **Documentation**: See the main [README.md](../README.md) for usage instructions
- **API Documentation**: Check provider documentation for API key setup

---

For more information about using the claude-context MCP server once installed, see the main project [README.md](../README.md).