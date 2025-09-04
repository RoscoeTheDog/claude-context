# Claude Context MCP Server Installation Guide

> **For Claude Code**: This file contains complete installation instructions that Claude Code can execute automatically. Simply ask Claude Code to "read @INSTALL.md and install the Claude Context MCP server".

This guide provides instructions for installing and configuring the Claude Context MCP server for use with Claude Desktop.

## Instructions for Future Agent Updates

**File Purpose**: The INSTALL.md file serves as a comprehensive, automated installation guide for setting up the Claude Context MCP server from the local directory in a **containerized and portable manner** while remaining **globally accessible** to Claude Code.

**Core Requirements When Updating This File**:

### 🎯 **Cross-Platform Support**
- **Windows**: PowerShell, Command Prompt, Git Bash, WSL
- **macOS**: zsh, bash, fish shells
- **Linux**: bash, zsh, fish, sh shells
- **Detection Logic**: Automatically detect platform and available shells

### 🔄 **Graceful Degradation Hierarchy**
1. **Primary**: Full automated installation with environment detection
2. **Secondary**: Manual commands with platform-specific instructions
3. **Tertiary**: Basic installation with user-guided steps
4. **Fallback**: Error messages with troubleshooting links

### 📦 **Dependency Management**
- **Auto-Detection**: Check for required tools (Node.js, pnpm, API keys)
- **Default Locations**: Install dependencies to system defaults unless specified
- **Graceful Handling**: Provide alternative methods if standard installation fails
- **Version Verification**: Ensure minimum required versions are met

### 🔧 **Environment Variable Management**
- **Set Variables**: Use platform-appropriate methods for persistent environment variables
- **Shell Refresh**: Force shell environment reload with fallback methods:
  1. `source ~/.bashrc` / `source ~/.zshrc` / equivalent
  2. `exec $SHELL` to restart shell session
  3. Prompt user to open new terminal/shell
  4. **Final Fallback**: Instruct user to log out/in or restart machine

### 🏗️ **Installation Architecture**
- **Containerized**: All server files remain in project directory
- **Portable**: Installation works when project is moved/cloned
- **Global Registration**: Server appears globally accessible to Claude Code
- **Self-Contained**: No pollution of global system directories

### 🛡️ **Error Handling Standards**
- **Validation**: Verify each step before proceeding
- **Rollback**: Provide cleanup instructions for failed installations
- **Clear Messaging**: User-friendly error messages with next steps
- **Logging**: Capture installation progress for debugging

### 🔒 **Security & Validation**
- **Token Security**: Never log or expose API keys in plain text
- **Binary Verification**: Validate built components before execution
- **File Permissions**: Set appropriate permissions for executables and config files
- **Input Sanitization**: Validate all user inputs and paths

### 🌐 **Network & Enterprise Support**
- **Proxy Detection**: Auto-detect and configure for corporate proxies
- **Offline Mode**: Support installation without internet access when possible
- **Administrator Privileges**: Handle elevation requests appropriately per platform
- **Firewall Considerations**: Document required network access and ports

**Always maintain backward compatibility and test across all supported platforms when making updates.**

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

### Cross-Platform Diagnostics

**Environment Detection Issues:**
- **Windows**: Check PowerShell execution policy: `Get-ExecutionPolicy`
- **macOS**: Verify shell type: `echo $SHELL` and permissions for terminal access
- **Linux**: Ensure bash/zsh compatibility and check `$PATH` variable
- **WSL**: Confirm proper WSL setup and Node.js accessibility from WSL environment

**Shell Environment Refresh:**
If environment variables aren't recognized after setting:
1. **Primary**: `source ~/.bashrc` (Linux) / `source ~/.zshrc` (macOS) / restart PowerShell (Windows)
2. **Secondary**: `exec $SHELL` to restart current shell session  
3. **Tertiary**: Open new terminal/command prompt window
4. **Fallback**: Log out and back in, or restart system

### Common Issues

**"API key validation failed"**
- **Validation Steps**: Test API keys independently before installation
- **Windows**: Use `$env:OPENAI_API_KEY` in PowerShell to verify variable set
- **Unix**: Use `echo $OPENAI_API_KEY` to verify variable set  
- **Proxy Issues**: Check corporate proxy settings may be blocking API calls
- **Credential Format**: Verify OpenAI key starts with `sk-` and Zilliz token format
- **Account Status**: Confirm sufficient credits and valid Zilliz Cloud account

**"pnpm is not installed"**
```bash
# Primary installation method
npm install -g pnpm

# Alternative methods if npm fails
# Windows: winget install pnpm
# macOS: brew install pnpm  
# Linux: curl -fsSL https://get.pnpm.io/install.sh | sh -

# Verify installation
pnpm --version
```

**"Node.js version not supported"**
- **Minimum Version**: Node.js 20+ required - check with `node --version`
- **Windows**: Download from [nodejs.org](https://nodejs.org/) or use `winget install OpenJS.NodeJS`
- **macOS**: Use Homebrew `brew install node@20` or download from nodejs.org
- **Linux**: Use NodeSource repository or nvm: `nvm install 20 && nvm use 20`
- **Version Conflicts**: Use nvm (Node Version Manager) to manage multiple versions

**"Permission denied" on macOS/Linux**
- **Directory Permissions**: Run `ls -la ~/.config/claude/` to check config directory
- **Create Config Directory**: `mkdir -p ~/.config/claude` if missing
- **File Ownership**: `sudo chown -R $USER:$USER ~/.config/claude/`
- **macOS Specific**: Grant terminal full disk access in System Preferences → Security & Privacy
- **Enterprise Systems**: May require administrator privileges for global installations

**"Claude Desktop doesn't show the MCP server"**
- **Configuration Validation**: Check JSON syntax in claude_desktop_config.json
- **File Locations**: 
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
  - Linux: `~/.config/claude/claude_desktop_config.json`
- **Complete Restart**: Fully quit and restart Claude Desktop (not just minimize)
- **Backup Verification**: Check if backup config exists and restore if needed
- **Build Verification**: Confirm `packages/mcp/dist/index.js` exists and is executable

**"Real-time sync not working"**
- **Indexing Prerequisite**: Verify codebase is indexed first with `index_codebase`
- **File System Permissions**: Check path has write/read permissions for file watching
- **Antivirus Interference**: Temporarily disable real-time protection to test
- **Filesystem Type**: Some network drives don't support file watching events
- **Resource Limits**: Check if system has reached max file watchers: `cat /proc/sys/fs/inotify/max_user_watches` (Linux)
- **Diagnostic Tools**: Use `health_check` tool to diagnose filesystem watching issues

**"Performance seems slow"**
- **Metrics Analysis**: Check `get_performance_stats` for bottlenecks and resource usage
- **Connection Pooling**: Verify enabled in configuration file
- **Cache Performance**: Use `get_sync_status` to check mtime cache hit rates
- **Filesystem Optimization**: Consider adjusting `debounceMs` for your storage type (SSD vs HDD)
- **Network Latency**: Test Zilliz Cloud connection speed from your region
- **Resource Monitoring**: Check system CPU/Memory usage during operations

**"Sync operations failing"**
- **System Health**: Use `health_check` to identify configuration and connectivity issues
- **Error Pattern Analysis**: Check `get_sync_history` for recurring failure patterns
- **Network Connectivity**: Test Zilliz Cloud connection: `curl -I https://cloud.zilliz.com`
- **Manual Sync Test**: Try manual sync with `sync_now` to isolate connectivity vs automation issues
- **Authentication Issues**: Verify API keys haven't expired or been revoked
- **Rate Limiting**: Check if hitting API rate limits (OpenAI: 3000 RPM, Zilliz varies)

**"Installation fails during build process"**
- **Build Dependencies**: Clear build cache: `pnpm clean` and rebuild
- **TypeScript Compilation**: Check for TypeScript errors: `pnpm run build --verbose`
- **Network Issues**: Use `pnpm install --network-timeout 100000` for slow connections
- **Disk Space**: Ensure sufficient disk space for dependencies and build artifacts
- **Proxy Configuration**: Set npm/pnpm proxy: `pnpm config set proxy http://your-proxy:port`

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