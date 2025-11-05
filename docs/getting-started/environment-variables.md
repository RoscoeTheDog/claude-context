# Environment Variables Configuration

## 🎯 Global Configuration

Claude Context supports a global configuration file at `~/.context/.env` to simplify MCP setup across different MCP clients.

**Benefits:**
- Configure once, use everywhere
- No need to specify environment variables in each MCP client
- Cleaner MCP configurations

## 📋 Environment Variable Priority

1. **Process Environment Variables** (highest)
2. **Global Configuration File** (`~/.context/.env`)
3. **Default Values** (lowest)

## 🔧 Required Environment Variables

### Embedding Provider
| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_PROVIDER` | Provider: `OpenAI`, `VoyageAI`, `Gemini`, `Ollama` | `OpenAI` |
| `EMBEDDING_MODEL` | Embedding model name (works for all providers) | Provider-specific default |
| `OPENAI_API_KEY` | OpenAI API key | Required for OpenAI |
| `OPENAI_BASE_URL` | OpenAI API base URL (optional, for custom endpoints) | `https://api.openai.com/v1` |
| `VOYAGEAI_API_KEY` | VoyageAI API key | Required for VoyageAI |
| `GEMINI_API_KEY` | Gemini API key | Required for Gemini |
| `GEMINI_BASE_URL` | Gemini API base URL (optional, for custom endpoints) | `https://generativelanguage.googleapis.com/v1beta` |

> **💡 Note:** `EMBEDDING_MODEL` is a universal environment variable that works with all embedding providers. Simply set it to the model name you want to use (e.g., `text-embedding-3-large` for OpenAI, `voyage-code-3` for VoyageAI, etc.).

> **Supported Model Names:**
> 
> - OpenAI Models: See `getSupportedModels` in [`openai-embedding.ts`](https://github.com/zilliztech/claude-context/blob/master/packages/core/src/embedding/openai-embedding.ts) for the full list of supported models.
> 
> - VoyageAI Models: See `getSupportedModels` in [`voyageai-embedding.ts`](https://github.com/zilliztech/claude-context/blob/master/packages/core/src/embedding/voyageai-embedding.ts) for the full list of supported models.
> 
> - Gemini Models: See `getSupportedModels` in [`gemini-embedding.ts`](https://github.com/zilliztech/claude-context/blob/master/packages/core/src/embedding/gemini-embedding.ts) for the full list of supported models.
> 
> - Ollama Models: Depends on the model you install locally.

> **📖 For detailed provider-specific configuration examples and setup instructions, see the [MCP Configuration Guide](../../packages/mcp/README.md#embedding-provider-configuration).**

### Vector Database
| Variable | Description | Default |
|----------|-------------|---------|
| `MILVUS_TOKEN` | Milvus authentication token. Get [Zilliz Personal API Key](https://github.com/zilliztech/claude-context/blob/master/assets/signup_and_get_apikey.png) | Recommended |
| `MILVUS_ADDRESS` | Milvus server address. Optional when using Zilliz Personal API Key | Auto-resolved from token |

### Ollama (Optional)
| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_HOST` | Ollama server URL | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL`(alternative to `EMBEDDING_MODEL`) | Model name |  |


### Advanced Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `HYBRID_MODE` | Enable hybrid search (BM25 + dense vector). Set to `false` for dense-only search | `true` |
| `EMBEDDING_BATCH_SIZE` | Batch size for processing. Larger batch size means less indexing time | `100` |
| `SPLITTER_TYPE` | Code splitter type: `ast`, `langchain` | `ast` |
| `CUSTOM_EXTENSIONS` | Additional file extensions to include (comma-separated, e.g., `.vue,.svelte,.astro`) | None |
| `CUSTOM_IGNORE_PATTERNS` | Additional ignore patterns (comma-separated, e.g., `temp/**,*.backup,private/**`) | None |

### Feature Flags (v0.5.0+)

Feature flags control optional token efficiency enhancements. All flags default to **disabled** for maximum safety and backward compatibility.

| Variable | Description | Default | Version |
|----------|-------------|---------|---------|
| `CC_SMART_RESULTS` | Enable smart adaptive search results with automatic token optimization (40-70% reduction) | `false` | v0.5.0+ |
| `CC_ALLOW_EXPERIMENTAL` | Enable all experimental token efficiency features | `false` | v0.5.0+ |

**Usage Examples:**

```bash
# Enable smart adaptive results
CC_SMART_RESULTS=true npx @zilliz/claude-context-mcp@latest

# Enable all experimental features
CC_ALLOW_EXPERIMENTAL=true npx @zilliz/claude-context-mcp@latest

# Add to global config
echo "CC_SMART_RESULTS=true" >> ~/.context/.env
```

**Accepted Values:**
- Enable: `true`, `1`, `yes` (case-insensitive)
- Disable: `false`, `0`, `no`, or any other value

**Feature Details:**

- **`CC_SMART_RESULTS`** (Story 1): Automatically adapts search result format based on result count:
  - 1-3 results: Full detail (0% savings)
  - 4-10 results: Compact mode (50% token savings)
  - 11-25 results: Summary mode (75% token savings)
  - 26+ results: Locations only (90% token savings)

  When disabled: Always returns full detail (legacy behavior).

**Safety Notes:**
- All features use silent fallback (no errors when disabled)
- Features can be disabled at any time via environment variables
- Default OFF (opt-in) ensures backward compatibility

## 🚀 Quick Setup

### 1. Create Global Config
```bash
mkdir -p ~/.context
cat > ~/.context/.env << 'EOF'
EMBEDDING_PROVIDER=OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
EMBEDDING_MODEL=text-embedding-3-small
MILVUS_TOKEN=your-zilliz-cloud-api-key
EOF
```

See the [Example File](../../.env.example) for more details.

### 2. Simplified MCP Configuration

**Claude Code:**
```bash
claude mcp add claude-context -- npx @zilliz/claude-context-mcp@latest
```

**Cursor/Windsurf/Others:**
```json
{
  "mcpServers": {
    "claude-context": {
      "command": "npx",
      "args": ["-y", "@zilliz/claude-context-mcp@latest"]
    }
  }
}
```

## 📚 Additional Information

For detailed information about file processing rules and how custom patterns work, see:
- [What files does Claude Context decide to embed?](../troubleshooting/faq.md#q-what-files-does-claude-context-decide-to-embed)
 