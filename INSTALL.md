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

## Installation Steps

The installation script performs these steps automatically:

1. **API Key Validation**: Validates your OpenAI and Zilliz credentials
2. **Dependency Check**: Verifies Node.js 20+ and pnpm are installed
3. **Build Process**: Installs dependencies and builds the MCP server
4. **Configuration**: Creates Claude Desktop configuration file
5. **Testing**: Verifies the MCP server starts correctly

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

After installation, verify everything works:

```bash
# Run the verification script
node scripts/verify.js

# Or manually test the MCP server
node packages/mcp/dist/index.js --help
```

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

### Getting Help

1. Run the verification script: `node scripts/verify.js`
2. Check the installation log output for specific error messages
3. Verify your API keys are working independently
4. Check Claude Desktop's error logs (platform-specific locations)

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

## Security Considerations

- API keys are stored in the Claude Desktop configuration file
- Configuration files should be secured with appropriate file permissions  
- Never commit API keys to version control
- Regularly rotate your API keys as recommended by providers

## Support

- **Issues**: Report bugs at [GitHub Issues](https://github.com/zilliztech/claude-context/issues)
- **Documentation**: See the main [README.md](../README.md) for usage instructions
- **API Documentation**: Check provider documentation for API key setup

---

For more information about using the claude-context MCP server once installed, see the main project [README.md](../README.md).