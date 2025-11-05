# Per-Codebase Configuration System

**Feature**: Database-stored configuration for indexed codebases
**Version Target**: v0.4.0
**Priority**: High
**Status**: DESIGN PHASE
**Created**: 2025-11-04

---

## 🎯 Goals

1. **No filesystem pollution** - Store configs in Milvus, not `.config` directories
2. **Per-codebase settings** - Each indexed codebase has independent configuration
3. **Dynamic updates** - Users can modify configs via MCP tools during runtime
4. **Default to indexing everything** - No ignore patterns by default
5. **Performance optimization as opt-in** - Directory pruning enabled per codebase

---

## 📐 Architecture

### Storage Design

**Collection Name**: `claude_context_configs`
**Schema**:
```typescript
{
    codebase_path: string,           // Primary key (normalized absolute path)
    codebase_hash: string,           // MD5 hash for quick lookup
    config: {
        ignorePatterns: string[],    // Default: []
        enableDirectoryPruning: boolean,  // Default: false
        maxFileSize: number,         // Default: 10MB
        fileExtensions: string[],    // Default: [] (all)
        followSymlinks: boolean,     // Default: false
        indexHiddenFiles: boolean,   // Default: true
        indexBinaryFiles: boolean    // Default: false
    },
    metadata: {
        createdAt: number,
        updatedAt: number,
        version: string              // Config schema version
    }
}
```

### Default Configuration

```typescript
const DEFAULT_CODEBASE_CONFIG = {
    ignorePatterns: [],              // ⭐ No ignores by default
    enableDirectoryPruning: false,   // ⭐ Optimization disabled by default
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    fileExtensions: [],              // All extensions
    followSymlinks: false,
    indexHiddenFiles: true,
    indexBinaryFiles: false
};
```

---

## 🛠️ Implementation Steps

### Phase 1: Core Infrastructure (4-6 hours)

#### Step 1.1: Create Configuration Manager Class

**File**: `packages/core/src/config/codebase-config.ts` (NEW)

```typescript
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import crypto from 'crypto';
import path from 'path';

export interface CodebaseConfig {
    ignorePatterns: string[];
    enableDirectoryPruning: boolean;
    maxFileSize: number;
    fileExtensions: string[];
    followSymlinks: boolean;
    indexHiddenFiles: boolean;
    indexBinaryFiles: boolean;
}

export interface CodebaseConfigDocument {
    codebase_path: string;
    codebase_hash: string;
    config: CodebaseConfig;
    metadata: {
        createdAt: number;
        updatedAt: number;
        version: string;
    };
}

export const DEFAULT_CODEBASE_CONFIG: CodebaseConfig = {
    ignorePatterns: [],
    enableDirectoryPruning: false,
    maxFileSize: 10 * 1024 * 1024,
    fileExtensions: [],
    followSymlinks: false,
    indexHiddenFiles: true,
    indexBinaryFiles: false
};

export class CodebaseConfigManager {
    private client: MilvusClient;
    private collectionName = 'claude_context_configs';
    private configCache = new Map<string, CodebaseConfig>();

    constructor(client: MilvusClient) {
        this.client = client;
    }

    /**
     * Initialize the config collection if it doesn't exist
     */
    async initialize(): Promise<void> {
        const collections = await this.client.listCollections();
        const exists = collections.data?.some(c => c.name === this.collectionName);

        if (!exists) {
            await this.createConfigCollection();
        }
    }

    /**
     * Get configuration for a codebase (from cache or database)
     */
    async getConfig(codebasePath: string): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);

        // Check cache first
        if (this.configCache.has(normalizedPath)) {
            return this.configCache.get(normalizedPath)!;
        }

        // Load from database
        const config = await this.loadConfigFromDB(normalizedPath);

        // Cache it
        this.configCache.set(normalizedPath, config);

        return config;
    }

    /**
     * Update configuration for a codebase
     */
    async updateConfig(
        codebasePath: string,
        updates: Partial<CodebaseConfig>
    ): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);
        const currentConfig = await this.getConfig(normalizedPath);

        // Merge updates with current config
        const newConfig: CodebaseConfig = {
            ...currentConfig,
            ...updates
        };

        // Save to database
        await this.saveConfigToDB(normalizedPath, newConfig);

        // Update cache
        this.configCache.set(normalizedPath, newConfig);

        return newConfig;
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfig(codebasePath: string): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);

        await this.saveConfigToDB(normalizedPath, DEFAULT_CODEBASE_CONFIG);
        this.configCache.set(normalizedPath, DEFAULT_CODEBASE_CONFIG);

        return DEFAULT_CODEBASE_CONFIG;
    }

    /**
     * List all configured codebases
     */
    async listConfigs(): Promise<Array<{ path: string, config: CodebaseConfig }>> {
        // Query all configs from database
        const results = await this.client.query({
            collection_name: this.collectionName,
            filter: 'codebase_hash != ""',
            output_fields: ['codebase_path', 'config', 'metadata']
        });

        return results.data.map(doc => ({
            path: doc.codebase_path,
            config: doc.config
        }));
    }

    /**
     * Delete configuration for a codebase
     */
    async deleteConfig(codebasePath: string): Promise<void> {
        const normalizedPath = path.resolve(codebasePath);
        const hash = this.getCodebaseHash(normalizedPath);

        await this.client.delete({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`
        });

        this.configCache.delete(normalizedPath);
    }

    // Private helper methods

    private async createConfigCollection(): Promise<void> {
        await this.client.createCollection({
            collection_name: this.collectionName,
            fields: [
                { name: 'id', data_type: 'Int64', is_primary_key: true, autoID: true },
                { name: 'codebase_path', data_type: 'VarChar', max_length: 1024 },
                { name: 'codebase_hash', data_type: 'VarChar', max_length: 32 },
                { name: 'config', data_type: 'JSON' },
                { name: 'metadata', data_type: 'JSON' }
            ]
        });

        // Create index on codebase_hash for fast lookup
        await this.client.createIndex({
            collection_name: this.collectionName,
            field_name: 'codebase_hash',
            index_type: 'STL_SORT'
        });

        await this.client.loadCollection({ collection_name: this.collectionName });
    }

    private async loadConfigFromDB(codebasePath: string): Promise<CodebaseConfig> {
        const hash = this.getCodebaseHash(codebasePath);

        const results = await this.client.query({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`,
            output_fields: ['config']
        });

        if (results.data.length > 0) {
            return results.data[0].config;
        }

        // No config found, return defaults
        return { ...DEFAULT_CODEBASE_CONFIG };
    }

    private async saveConfigToDB(codebasePath: string, config: CodebaseConfig): Promise<void> {
        const hash = this.getCodebaseHash(codebasePath);

        // Check if config already exists
        const existing = await this.client.query({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`,
            output_fields: ['id']
        });

        const doc: Partial<CodebaseConfigDocument> = {
            codebase_path: codebasePath,
            codebase_hash: hash,
            config: config,
            metadata: {
                createdAt: existing.data.length > 0 ? existing.data[0].metadata.createdAt : Date.now(),
                updatedAt: Date.now(),
                version: '1.0'
            }
        };

        if (existing.data.length > 0) {
            // Update existing
            await this.client.delete({
                collection_name: this.collectionName,
                filter: `codebase_hash == "${hash}"`
            });
        }

        // Insert new/updated config
        await this.client.insert({
            collection_name: this.collectionName,
            data: [doc]
        });
    }

    private getCodebaseHash(codebasePath: string): string {
        return crypto.createHash('md5').update(codebasePath).digest('hex');
    }
}
```

#### Step 1.2: Integrate with Context Class

**File**: `packages/core/src/context.ts`

**Changes**:
1. Add `configManager: CodebaseConfigManager` property
2. Initialize in constructor
3. Load config before indexing
4. Pass config to `FileSynchronizer`

```typescript
// In Context class
private configManager: CodebaseConfigManager;

constructor(vectorDatabase: VectorDatabase, embedding: Embedding) {
    // ... existing code ...
    this.configManager = new CodebaseConfigManager(vectorDatabase.client);
}

async initialize(): Promise<void> {
    await this.configManager.initialize();
    // ... rest of initialization ...
}

async indexCodebase(codebasePath: string, options?: IndexOptions): Promise<void> {
    // Load config for this codebase
    const config = await this.configManager.getConfig(codebasePath);

    // Use config.ignorePatterns instead of DEFAULT_IGNORE_PATTERNS
    const ignorePatterns = config.ignorePatterns;

    // Pass config.enableDirectoryPruning to synchronizer
    const synchronizer = new FileSynchronizer(
        codebasePath,
        ignorePatterns,
        config  // Pass entire config
    );

    // ... rest of indexing ...
}
```

#### Step 1.3: Update FileSynchronizer

**File**: `packages/core/src/sync/synchronizer.ts`

**Changes**:
1. Accept `config` in constructor
2. Use `config.enableDirectoryPruning` to control optimization
3. Respect other config settings (maxFileSize, fileExtensions, etc.)

```typescript
export class FileSynchronizer {
    private config: CodebaseConfig;

    constructor(
        rootDir: string,
        ignorePatterns: string[] = [],
        config?: CodebaseConfig
    ) {
        this.rootDir = rootDir;
        this.ignorePatterns = ignorePatterns;
        this.config = config || DEFAULT_CODEBASE_CONFIG;
        // ... rest of constructor ...
    }

    private async generateFileHashes(dir: string): Promise<Map<string, string>> {
        // ... existing code ...

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.rootDir, fullPath);

            if (entry.isDirectory()) {
                // ⭐ Only apply optimization if enabled in config
                if (this.config.enableDirectoryPruning && this.shouldIgnore(relativePath, true)) {
                    console.log(`[Synchronizer] Skipping ignored directory: ${relativePath}`);
                    continue;
                }

                // Otherwise recurse normally
                const subHashes = await this.generateFileHashes(fullPath);
                // ... merge hashes ...
            } else if (entry.isFile()) {
                // Check file-level ignores and config
                if (this.shouldIgnore(relativePath, false)) {
                    continue;
                }

                // Check file size
                const stat = await fs.stat(fullPath);
                if (stat.size > this.config.maxFileSize) {
                    console.log(`[Synchronizer] Skipping large file: ${relativePath} (${stat.size} bytes)`);
                    continue;
                }

                // Check file extension
                if (this.config.fileExtensions.length > 0) {
                    const ext = path.extname(fullPath);
                    if (!this.config.fileExtensions.includes(ext)) {
                        continue;
                    }
                }

                // Hash the file
                const hash = await this.hashFileOptimized(fullPath, relativePath);
                fileHashes.set(relativePath, hash);
            }
        }

        return fileHashes;
    }
}
```

---

### Phase 2: MCP Tool Handlers (2-3 hours)

#### Step 2.1: Create Config Handlers

**File**: `packages/mcp/src/handlers.ts`

```typescript
/**
 * Get configuration for a specific codebase
 */
async handleGetCodebaseConfig(args: { path: string }): Promise<MCPResponse> {
    try {
        const config = await this.context.configManager.getConfig(args.path);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    codebasePath: args.path,
                    config: config
                }, null, 2)
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Error getting config: ${error.message}`
            }],
            isError: true
        };
    }
}

/**
 * Update configuration for a specific codebase
 */
async handleUpdateCodebaseConfig(args: {
    path: string,
    ignorePatterns?: string[],
    enableDirectoryPruning?: boolean,
    maxFileSize?: number,
    fileExtensions?: string[],
    followSymlinks?: boolean,
    indexHiddenFiles?: boolean,
    indexBinaryFiles?: boolean
}): Promise<MCPResponse> {
    try {
        const { path: codebasePath, ...updates } = args;

        const newConfig = await this.context.configManager.updateConfig(
            codebasePath,
            updates
        );

        return {
            content: [{
                type: "text",
                text: `✅ Configuration updated for ${codebasePath}\n\n${JSON.stringify(newConfig, null, 2)}`
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Error updating config: ${error.message}`
            }],
            isError: true
        };
    }
}

/**
 * Reset configuration to defaults
 */
async handleResetCodebaseConfig(args: { path: string }): Promise<MCPResponse> {
    try {
        const config = await this.context.configManager.resetConfig(args.path);

        return {
            content: [{
                type: "text",
                text: `✅ Configuration reset to defaults for ${args.path}\n\n${JSON.stringify(config, null, 2)}`
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Error resetting config: ${error.message}`
            }],
            isError: true
        };
    }
}

/**
 * List all configured codebases
 */
async handleListCodebaseConfigs(): Promise<MCPResponse> {
    try {
        const configs = await this.context.configManager.listConfigs();

        return {
            content: [{
                type: "text",
                text: JSON.stringify(configs, null, 2)
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Error listing configs: ${error.message}`
            }],
            isError: true
        };
    }
}
```

#### Step 2.2: Register Tools in Server

**File**: `packages/mcp/src/server.ts`

```typescript
{
    name: "get_codebase_config",
    description: "Get configuration for a specific indexed codebase",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Absolute path to the codebase"
            }
        },
        required: ["path"]
    }
},
{
    name: "update_codebase_config",
    description: "Update configuration for a specific codebase. All parameters are optional - only provided values will be updated.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Absolute path to the codebase"
            },
            ignorePatterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns to ignore (e.g., ['node_modules/**', '*.log'])"
            },
            enableDirectoryPruning: {
                type: "boolean",
                description: "Enable directory pruning optimization (skip ignored dirs early)"
            },
            maxFileSize: {
                type: "number",
                description: "Maximum file size to index (bytes)"
            },
            fileExtensions: {
                type: "array",
                items: { type: "string" },
                description: "Only index files with these extensions (e.g., ['.ts', '.js']). Empty = all extensions"
            },
            followSymlinks: {
                type: "boolean",
                description: "Follow symbolic links during indexing"
            },
            indexHiddenFiles: {
                type: "boolean",
                description: "Index hidden files (starting with .)"
            },
            indexBinaryFiles: {
                type: "boolean",
                description: "Attempt to index binary files"
            }
        },
        required: ["path"]
    }
},
{
    name: "reset_codebase_config",
    description: "Reset configuration to defaults for a specific codebase",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Absolute path to the codebase"
            }
        },
        required: ["path"]
    }
},
{
    name: "list_codebase_configs",
    description: "List all codebases with custom configurations",
    inputSchema: {
        type: "object",
        properties: {}
    }
}
```

---

### Phase 3: Update Defaults (30 min)

#### Step 3.1: Remove DEFAULT_IGNORE_PATTERNS

**File**: `packages/core/src/context.ts`

```typescript
// OLD:
const DEFAULT_IGNORE_PATTERNS = [
    'node_modules/**',
    '.git/**',
    // ... many patterns ...
];

// NEW:
const DEFAULT_IGNORE_PATTERNS: string[] = []; // ⭐ Empty by default
```

#### Step 3.2: Update Documentation

Update all docs to reflect:
- By default, everything is indexed
- Users can add ignore patterns per codebase
- Performance optimization is opt-in via `enableDirectoryPruning`

---

## 📝 Usage Examples

### Example 1: Index Everything (Default)

```typescript
// Just index - no ignores by default
await mcp__claude-context__index_codebase({
    path: "/path/to/codebase"
});

// Everything is indexed, including node_modules
```

### Example 2: Add Ignore Patterns for Performance

```typescript
// Update config to ignore node_modules and enable optimization
await mcp__claude-context__update_codebase_config({
    path: "/path/to/codebase",
    ignorePatterns: ["node_modules/**", ".git/**", "dist/**"],
    enableDirectoryPruning: true
});

// Re-index with new config
await mcp__claude-context__sync_now({
    path: "/path/to/codebase"
});
```

### Example 3: Only Index Specific File Types

```typescript
await mcp__claude-context__update_codebase_config({
    path: "/path/to/codebase",
    fileExtensions: [".ts", ".tsx", ".js", ".jsx"],
    enableDirectoryPruning: true,
    ignorePatterns: ["node_modules/**"]
});
```

### Example 4: Check Current Config

```typescript
await mcp__claude-context__get_codebase_config({
    path: "/path/to/codebase"
});

// Returns:
// {
//   "ignorePatterns": ["node_modules/**"],
//   "enableDirectoryPruning": true,
//   ...
// }
```

---

## 🎯 Benefits

1. **No filesystem pollution** - All configs in database
2. **Per-project flexibility** - Each codebase has independent settings
3. **Performance when needed** - Opt-in optimization
4. **Complete by default** - Index everything unless user specifies otherwise
5. **Runtime reconfiguration** - Change configs without restarting
6. **Persistent** - Configs survive across sessions

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('CodebaseConfigManager', () => {
    test('should return defaults for unconfigured codebase', async () => {
        const config = await manager.getConfig('/new/path');
        expect(config.ignorePatterns).toEqual([]);
        expect(config.enableDirectoryPruning).toBe(false);
    });

    test('should persist config updates', async () => {
        await manager.updateConfig('/path', { ignorePatterns: ['test/**'] });
        const config = await manager.getConfig('/path');
        expect(config.ignorePatterns).toEqual(['test/**']);
    });

    test('should merge partial updates', async () => {
        await manager.updateConfig('/path', { ignorePatterns: ['a/**'] });
        await manager.updateConfig('/path', { enableDirectoryPruning: true });
        const config = await manager.getConfig('/path');
        expect(config.ignorePatterns).toEqual(['a/**']);
        expect(config.enableDirectoryPruning).toBe(true);
    });
});
```

### Integration Tests

```typescript
describe('MCP Config Handlers', () => {
    test('should get default config for new codebase', async () => {
        const response = await handlers.handleGetCodebaseConfig({ path: '/test' });
        expect(response.isError).toBe(false);
    });

    test('should update and retrieve config', async () => {
        await handlers.handleUpdateCodebaseConfig({
            path: '/test',
            ignorePatterns: ['node_modules/**']
        });

        const response = await handlers.handleGetCodebaseConfig({ path: '/test' });
        const config = JSON.parse(response.content[0].text);
        expect(config.config.ignorePatterns).toContain('node_modules/**');
    });
});
```

---

## 🚀 Migration Plan

### For Existing Users

1. **First run after upgrade**: All existing codebases get default config (empty ignores)
2. **Migration tool** (optional): Convert old DEFAULT_IGNORE_PATTERNS to per-codebase config
3. **Documentation update**: Announce new config system

### Backwards Compatibility

- Existing `ignorePatterns` parameter in `index_codebase` still works
- Passed patterns are merged with stored config
- No breaking changes to existing MCP tools

---

## 📊 Success Criteria

- ✅ No `.config` or `.claude-context` directories created
- ✅ Configs persisted in Milvus
- ✅ Default behavior: index everything
- ✅ Users can dynamically configure per codebase
- ✅ Performance optimization available but opt-in
- ✅ All tests passing
- ✅ Documentation updated

---

## 🔗 Related Files

- `packages/core/src/config/codebase-config.ts` (NEW)
- `packages/core/src/context.ts` (MODIFY)
- `packages/core/src/sync/synchronizer.ts` (MODIFY)
- `packages/mcp/src/handlers.ts` (MODIFY)
- `packages/mcp/src/server.ts` (MODIFY)

---

**Ready for implementation?** This design provides:
- Clean separation of concerns
- Database-only storage
- Per-codebase flexibility
- Opt-in performance
- Dynamic runtime configuration
