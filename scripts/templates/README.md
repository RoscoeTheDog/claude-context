# Configuration Templates

This directory contains pre-configured templates for different use cases of the claude-context MCP server.

## Available Templates

### `config-minimal.json`
**Simplest setup** - Only API keys required
- OpenAI for embeddings
- Zilliz Cloud for vector storage
- Default settings for everything else

### `config-openai-zilliz.json`  
**Recommended production setup**
- OpenAI embeddings with `text-embedding-3-small`
- Zilliz Cloud vector database
- Backup enabled, verbose logging disabled

### `config-voyageai.json`
**VoyageAI embeddings**
- VoyageAI `voyage-3-large` model for high-quality embeddings
- Zilliz Cloud vector database
- Good for production workloads requiring best embedding quality

### `config-ollama-local.json`
**Fully local setup**
- Ollama for local embeddings
- Local Milvus instance
- Development-friendly with verbose logging
- No cloud dependencies

### `config-development.json`
**Development configuration**
- Uses environment variables for API keys
- Verbose logging and debug mode
- Development server name
- Detailed error reporting

## Usage

1. **Copy a template** that matches your needs:
   ```bash
   cp scripts/templates/config-openai-zilliz.json scripts/install-config.json
   ```

2. **Edit the configuration** with your actual API keys:
   ```bash
   # Edit scripts/install-config.json
   # Add your OpenAI API key and Zilliz token
   ```

3. **Run the installer**:
   ```bash
   node scripts/install.js
   ```

## Configuration Options

### API Keys
- `apiKeys.openai`: OpenAI API key (starts with `sk-`)
- `apiKeys.zilliz`: Zilliz Cloud token
- `apiKeys.voyageai`: VoyageAI API key (starts with `pa-`)

### Embedding Providers
- `OpenAI`: text-embedding-3-small, text-embedding-3-large
- `VoyageAI`: voyage-3-large, voyage-3-medium
- `Gemini`: gemini-embedding-001
- `Ollama`: mxbai-embed-large, nomic-embed-text, etc.

### Vector Databases
- **Zilliz Cloud**: Use `apiKeys.zilliz` token (recommended)
- **Local Milvus**: Set `milvusAddress: "localhost:19530"`
- **Custom Milvus**: Set `milvusAddress` to your server

### Installation Options
- `installation.verbose`: Show detailed build output
- `installation.createBackup`: Backup existing Claude config
- `installation.skipTests`: Skip post-installation verification

## Examples

### Quick Setup (OpenAI + Zilliz)
```json
{
  "apiKeys": {
    "openai": "sk-proj-abc123...",
    "zilliz": "your-zilliz-token"
  }
}
```

### Local Development
```json
{
  "apiKeys": {
    "zilliz": ""
  },
  "embeddingProvider": "Ollama",
  "embeddingModel": "mxbai-embed-large", 
  "milvusAddress": "localhost:19530",
  "installation": {
    "verbose": true
  }
}
```

### Production with VoyageAI
```json
{
  "apiKeys": {
    "voyageai": "pa-xyz789...",
    "zilliz": "your-production-token"
  },
  "embeddingProvider": "VoyageAI",
  "embeddingModel": "voyage-3-large"
}
```

## Custom Configuration

You can create your own configuration file by:

1. Starting with an existing template
2. Modifying the options as needed  
3. Using the schema file for validation:
   ```bash
   # The install-config.schema.json provides validation
   # Most editors will show hints and validation
   ```

## Environment Variables

All templates support falling back to environment variables:
- `OPENAI_API_KEY`
- `ZILLIZ_API_KEY`  
- `VOYAGEAI_API_KEY`
- `GEMINI_API_KEY`

If an API key is not specified in the config file, the installer will check environment variables automatically.

## Troubleshooting

**Template not working?**
1. Verify your API keys are correct
2. Run with verbose mode: set `"installation.verbose": true`
3. Check the verification script: `node scripts/verify.js --verbose`

**Need help choosing?**
- **Beginners**: Use `config-minimal.json`
- **Production**: Use `config-openai-zilliz.json`
- **Local development**: Use `config-ollama-local.json`
- **Best quality**: Use `config-voyageai.json`