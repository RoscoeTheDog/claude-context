# Session Handoff: Per-Codebase Configuration System

**Feature**: Database-stored configuration for indexed codebases (replacing env vars)
**Version Target**: v0.4.0
**Priority**: High (Required to complete sync optimization work)
**Status**: PARTIALLY COMPLETE - Ready for Phase 2
**Created**: 2025-11-04

---

## 🎯 Context: What's Been Done

### Phase 1: Cleanup (COMPLETED)

The following changes have been implemented:

1. **Removed DEFAULT_IGNORE_PATTERNS** ✅
   - Changed from ~50 default patterns to empty array `[]`
   - File: `packages/core/src/context.ts:37-40`

2. **Removed Environment Variable Support** ✅
   - Deleted `getCustomIgnorePatternsFromEnv()` method
   - Removed `CUSTOM_IGNORE_PATTERNS` env var loading
   - File: `packages/core/src/context.ts`

3. **Updated Documentation** ✅
   - Updated `CHANGELOG.md` with breaking changes
   - Updated `docs/dive-deep/file-inclusion-rules.md`

4. **Preserved Optimization Code** ✅
   - Directory pruning optimization remains in `FileSynchronizer`
   - Currently inactive (empty ignorePatterns by default)
   - Will activate when users configure ignore patterns

**Current State:**
- System indexes EVERYTHING by default (no ignores)
- No way to configure ignore patterns persistently
- Users must pass `ignorePatterns` parameter on every MCP call
- **BLOCKER**: Need database config system to make this usable

---

## 🎯 Phase 2: Implement Configuration System (TODO)

### Goals

1. Store per-codebase configuration in Milvus (no filesystem pollution)
2. Provide MCP tools for dynamic configuration
3. Make ignore patterns configurable and persistent
4. Enable performance optimization as opt-in feature

### Architecture

**Storage**: Milvus collection `claude_context_configs`
**Scope**: Per-codebase (keyed by absolute path)
**Default**: Index everything (empty ignorePatterns)
**Access**: Via MCP tools and Context class API

---

## 📋 Implementation Plan

### Step 1: Create CodebaseConfigManager Class (2-3 hours)

**File**: `packages/core/src/config/codebase-config.ts` (NEW)

```typescript
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import crypto from 'crypto';
import path from 'path';

export interface CodebaseConfig {
    ignorePatterns: string[];
    enableDirectoryPruning: boolean;  // Currently not used, reserved for future
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
    ignorePatterns: [],              // Empty by default - index everything
    enableDirectoryPruning: true,    // Reserved for future use
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    fileExtensions: [],              // All extensions
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
        try {
            const collections = await this.client.listCollections();
            const exists = collections.data?.some(c => c.name === this.collectionName);

            if (!exists) {
                await this.createConfigCollection();
                console.log('[ConfigManager] Created claude_context_configs collection');
            } else {
                // Load collection into memory
                await this.client.loadCollection({ collection_name: this.collectionName });
                console.log('[ConfigManager] Loaded existing configs collection');
            }
        } catch (error: any) {
            console.warn('[ConfigManager] Failed to initialize:', error.message);
            // Non-fatal - will use defaults
        }
    }

    /**
     * Get configuration for a codebase (from cache or database)
     */
    async getConfig(codebasePath: string): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);

        // Check cache first
        if (this.configCache.has(normalizedPath)) {
            return { ...this.configCache.get(normalizedPath)! };
        }

        // Load from database
        try {
            const config = await this.loadConfigFromDB(normalizedPath);
            this.configCache.set(normalizedPath, config);
            return { ...config };
        } catch (error: any) {
            console.warn(`[ConfigManager] Failed to load config for ${normalizedPath}:`, error.message);
            // Return defaults on error
            return { ...DEFAULT_CODEBASE_CONFIG };
        }
    }

    /**
     * Update configuration for a codebase (merges with existing)
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

        console.log(`[ConfigManager] Updated config for ${normalizedPath}`);
        return { ...newConfig };
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfig(codebasePath: string): Promise<CodebaseConfig> {
        const normalizedPath = path.resolve(codebasePath);

        await this.saveConfigToDB(normalizedPath, DEFAULT_CODEBASE_CONFIG);
        this.configCache.set(normalizedPath, DEFAULT_CODEBASE_CONFIG);

        console.log(`[ConfigManager] Reset config for ${normalizedPath}`);
        return { ...DEFAULT_CODEBASE_CONFIG };
    }

    /**
     * List all configured codebases
     */
    async listConfigs(): Promise<Array<{ path: string, config: CodebaseConfig }>> {
        try {
            const results = await this.client.query({
                collection_name: this.collectionName,
                filter: 'codebase_hash != ""',
                output_fields: ['codebase_path', 'config'],
                limit: 1000
            });

            return results.data.map(doc => ({
                path: doc.codebase_path as string,
                config: doc.config as CodebaseConfig
            }));
        } catch (error: any) {
            console.warn('[ConfigManager] Failed to list configs:', error.message);
            return [];
        }
    }

    /**
     * Delete configuration for a codebase
     */
    async deleteConfig(codebasePath: string): Promise<void> {
        const normalizedPath = path.resolve(codebasePath);
        const hash = this.getCodebaseHash(normalizedPath);

        try {
            await this.client.delete({
                collection_name: this.collectionName,
                filter: `codebase_hash == "${hash}"`
            });

            this.configCache.delete(normalizedPath);
            console.log(`[ConfigManager] Deleted config for ${normalizedPath}`);
        } catch (error: any) {
            console.warn(`[ConfigManager] Failed to delete config:`, error.message);
        }
    }

    // Private helper methods

    private async createConfigCollection(): Promise<void> {
        await this.client.createCollection({
            collection_name: this.collectionName,
            fields: [
                {
                    name: 'id',
                    data_type: 'Int64',
                    is_primary_key: true,
                    autoID: true
                },
                {
                    name: 'codebase_path',
                    data_type: 'VarChar',
                    max_length: 1024
                },
                {
                    name: 'codebase_hash',
                    data_type: 'VarChar',
                    max_length: 32
                },
                {
                    name: 'config',
                    data_type: 'JSON'
                },
                {
                    name: 'metadata',
                    data_type: 'JSON'
                }
            ]
        });

        // Create index on codebase_hash for fast lookup
        await this.client.createIndex({
            collection_name: this.collectionName,
            field_name: 'codebase_hash',
            index_type: 'STL_SORT'
        });

        await this.client.loadCollection({
            collection_name: this.collectionName
        });
    }

    private async loadConfigFromDB(codebasePath: string): Promise<CodebaseConfig> {
        const hash = this.getCodebaseHash(codebasePath);

        const results = await this.client.query({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`,
            output_fields: ['config'],
            limit: 1
        });

        if (results.data.length > 0) {
            return results.data[0].config as CodebaseConfig;
        }

        // No config found, return defaults
        return { ...DEFAULT_CODEBASE_CONFIG };
    }

    private async saveConfigToDB(
        codebasePath: string,
        config: CodebaseConfig
    ): Promise<void> {
        const hash = this.getCodebaseHash(codebasePath);

        // Check if config already exists
        const existing = await this.client.query({
            collection_name: this.collectionName,
            filter: `codebase_hash == "${hash}"`,
            output_fields: ['id', 'metadata'],
            limit: 1
        });

        const now = Date.now();
        const doc: any = {
            codebase_path: codebasePath,
            codebase_hash: hash,
            config: config,
            metadata: {
                createdAt: existing.data.length > 0
                    ? (existing.data[0].metadata as any).createdAt
                    : now,
                updatedAt: now,
                version: '1.0'
            }
        };

        if (existing.data.length > 0) {
            // Delete existing first
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

**Key Features:**
- In-memory caching for performance
- Graceful fallback to defaults on errors
- Merge-based updates (partial updates supported)
- Collection auto-creation on first use

---

### Step 2: Integrate with Context Class (1 hour)

**File**: `packages/core/src/context.ts`

**Changes Needed:**

1. Add import and property:
```typescript
import { CodebaseConfigManager } from './config/codebase-config';

export class Context {
    // ... existing properties ...
    private configManager: CodebaseConfigManager;
```

2. Initialize in constructor:
```typescript
constructor(vectorDatabase: VectorDatabase, embedding: Embedding, config?: ContextConfig) {
    // ... existing initialization ...

    this.configManager = new CodebaseConfigManager(vectorDatabase.getClient());
}
```

3. Add initialization call:
```typescript
async initialize(): Promise<void> {
    await this.configManager.initialize();
    // ... rest of initialization ...
}
```

4. Expose config manager:
```typescript
getConfigManager(): CodebaseConfigManager {
    return this.configManager;
}
```

5. Use config in indexing (modify `indexCodebase` method):
```typescript
async indexCodebase(
    codebasePath: string,
    options?: IndexOptions,
    progressCallback?: ProgressCallback
): Promise<void> {
    // Load config for this codebase
    const config = await this.configManager.getConfig(codebasePath);

    // Merge config ignorePatterns with MCP-provided ones
    const ignorePatterns = [
        ...config.ignorePatterns,
        ...(options?.ignorePatterns || [])
    ];

    // Remove duplicates
    const uniquePatterns = [...new Set(ignorePatterns)];

    console.log(`[Context] Indexing with ${uniquePatterns.length} ignore patterns`);

    // Pass to synchronizer
    const synchronizer = new FileSynchronizer(
        codebasePath,
        uniquePatterns
    );

    // ... rest of indexing logic ...
}
```

---

### Step 3: Create MCP Tool Handlers (1-2 hours)

**File**: `packages/mcp/src/handlers.ts`

Add these handler methods to the `ToolHandlers` class:

```typescript
/**
 * Get configuration for a specific codebase
 */
async handleGetCodebaseConfig(args: { path: string }): Promise<MCPResponse> {
    try {
        const absolutePath = path.resolve(args.path);
        const configManager = this.context.getConfigManager();
        const config = await configManager.getConfig(absolutePath);

        return {
            content: [{
                type: "text",
                text: `Configuration for: ${absolutePath}\n\n${JSON.stringify(config, null, 2)}`
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
    maxFileSize?: number,
    fileExtensions?: string[],
    followSymlinks?: boolean,
    indexHiddenFiles?: boolean,
    indexBinaryFiles?: boolean
}): Promise<MCPResponse> {
    try {
        const { path: codebasePath, ...updates } = args;
        const absolutePath = path.resolve(codebasePath);
        const configManager = this.context.getConfigManager();

        const newConfig = await configManager.updateConfig(absolutePath, updates);

        return {
            content: [{
                type: "text",
                text: `✅ Configuration updated for: ${absolutePath}\n\n${JSON.stringify(newConfig, null, 2)}\n\n💡 Tip: Run sync_now to apply changes to existing index.`
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
        const absolutePath = path.resolve(args.path);
        const configManager = this.context.getConfigManager();
        const config = await configManager.resetConfig(absolutePath);

        return {
            content: [{
                type: "text",
                text: `✅ Configuration reset to defaults for: ${absolutePath}\n\n${JSON.stringify(config, null, 2)}`
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
        const configManager = this.context.getConfigManager();
        const configs = await configManager.listConfigs();

        if (configs.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: "No codebases have custom configurations.\n\nAll codebases are using default settings (index everything)."
                }]
            };
        }

        const output = configs.map((c, i) =>
            `${i + 1}. ${c.path}\n   Ignore patterns: ${c.config.ignorePatterns.length}\n   Patterns: ${c.config.ignorePatterns.slice(0, 3).join(', ')}${c.config.ignorePatterns.length > 3 ? '...' : ''}`
        ).join('\n\n');

        return {
            content: [{
                type: "text",
                text: `Configured Codebases (${configs.length}):\n\n${output}`
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

Then add the routing in the main handler:

```typescript
async handleToolCall(name: string, args: any): Promise<MCPResponse> {
    switch (name) {
        // ... existing cases ...

        case 'get_codebase_config':
            return this.handleGetCodebaseConfig(args);
        case 'update_codebase_config':
            return this.handleUpdateCodebaseConfig(args);
        case 'reset_codebase_config':
            return this.handleResetCodebaseConfig(args);
        case 'list_codebase_configs':
            return this.handleListCodebaseConfigs();

        // ... rest of cases ...
    }
}
```

---

### Step 4: Register MCP Tools (30 min)

**File**: `packages/mcp/src/server.ts`

Add to the tools list in the `listTools` handler:

```typescript
{
    name: "get_codebase_config",
    description: "Get the current configuration for a specific indexed codebase. Returns ignore patterns, file size limits, and other indexing settings.",
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
    description: "Update configuration for a specific codebase. All parameters are optional - only provided values will be updated. Configuration is stored in the database and persists across sessions.",
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
                description: "Patterns to ignore during indexing (e.g., ['node_modules/**', '*.log']). Enables performance optimization when set."
            },
            maxFileSize: {
                type: "number",
                description: "Maximum file size to index in bytes (default: 10MB)"
            },
            fileExtensions: {
                type: "array",
                items: { type: "string" },
                description: "Only index files with these extensions (e.g., ['.ts', '.js']). Empty array = all extensions."
            },
            followSymlinks: {
                type: "boolean",
                description: "Follow symbolic links during indexing (default: false)"
            },
            indexHiddenFiles: {
                type: "boolean",
                description: "Index hidden files starting with . (default: true)"
            },
            indexBinaryFiles: {
                type: "boolean",
                description: "Attempt to index binary files (default: false)"
            }
        },
        required: ["path"]
    }
},
{
    name: "reset_codebase_config",
    description: "Reset configuration to defaults for a specific codebase. This removes all custom ignore patterns and restores default settings (index everything).",
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
    description: "List all codebases that have custom configurations stored in the database.",
    inputSchema: {
        type: "object",
        properties: {},
        required: []
    }
}
```

---

## 📝 Testing Strategy

### Unit Tests

Create `packages/core/src/config/__tests__/codebase-config.test.ts`:

```typescript
import { CodebaseConfigManager, DEFAULT_CODEBASE_CONFIG } from '../codebase-config';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

describe('CodebaseConfigManager', () => {
    let manager: CodebaseConfigManager;
    let mockClient: jest.Mocked<MilvusClient>;

    beforeEach(() => {
        mockClient = {
            listCollections: jest.fn(),
            createCollection: jest.fn(),
            loadCollection: jest.fn(),
            query: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
            createIndex: jest.fn()
        } as any;

        manager = new CodebaseConfigManager(mockClient);
    });

    test('should return defaults for unconfigured codebase', async () => {
        mockClient.listCollections.mockResolvedValue({ data: [{ name: 'claude_context_configs' }] });
        mockClient.loadCollection.mockResolvedValue({} as any);
        mockClient.query.mockResolvedValue({ data: [] });

        const config = await manager.getConfig('/test/path');

        expect(config.ignorePatterns).toEqual([]);
        expect(config.maxFileSize).toBe(10 * 1024 * 1024);
    });

    test('should persist config updates', async () => {
        mockClient.listCollections.mockResolvedValue({ data: [{ name: 'claude_context_configs' }] });
        mockClient.loadCollection.mockResolvedValue({} as any);
        mockClient.query.mockResolvedValue({ data: [] });
        mockClient.insert.mockResolvedValue({} as any);

        await manager.updateConfig('/test/path', {
            ignorePatterns: ['node_modules/**']
        });

        const config = await manager.getConfig('/test/path');
        expect(config.ignorePatterns).toEqual(['node_modules/**']);
    });

    test('should merge partial updates', async () => {
        mockClient.listCollections.mockResolvedValue({ data: [{ name: 'claude_context_configs' }] });
        mockClient.loadCollection.mockResolvedValue({} as any);
        mockClient.query.mockResolvedValue({ data: [] });
        mockClient.insert.mockResolvedValue({} as any);

        await manager.updateConfig('/test/path', {
            ignorePatterns: ['*.log']
        });
        await manager.updateConfig('/test/path', {
            maxFileSize: 5000000
        });

        const config = await manager.getConfig('/test/path');
        expect(config.ignorePatterns).toEqual(['*.log']);
        expect(config.maxFileSize).toBe(5000000);
    });
});
```

### Integration Tests

Add to `packages/mcp/src/__tests__/handlers-integration.test.ts`:

```typescript
describe('Codebase Config MCP Tools', () => {
    test('should get default config for new codebase', async () => {
        const response = await handlers.handleGetCodebaseConfig({
            path: testProjectRoot
        });

        expect(response.isError).toBe(false);
        expect(response.content[0].text).toContain('ignorePatterns');
    });

    test('should update and retrieve config', async () => {
        // Update config
        await handlers.handleUpdateCodebaseConfig({
            path: testProjectRoot,
            ignorePatterns: ['node_modules/**', '*.log']
        });

        // Retrieve config
        const response = await handlers.handleGetCodebaseConfig({
            path: testProjectRoot
        });

        const config = JSON.parse(
            response.content[0].text.split('\n\n')[1]
        );
        expect(config.ignorePatterns).toContain('node_modules/**');
    });

    test('should reset config to defaults', async () => {
        // First set some config
        await handlers.handleUpdateCodebaseConfig({
            path: testProjectRoot,
            ignorePatterns: ['test/**']
        });

        // Reset
        await handlers.handleResetCodebaseConfig({
            path: testProjectRoot
        });

        // Verify reset
        const response = await handlers.handleGetCodebaseConfig({
            path: testProjectRoot
        });
        const config = JSON.parse(
            response.content[0].text.split('\n\n')[1]
        );
        expect(config.ignorePatterns).toEqual([]);
    });
});
```

---

## 📖 Usage Examples

### Example 1: Configure Ignore Patterns for Performance

```typescript
// User wants to skip node_modules for faster indexing
await mcp__claude-context__update_codebase_config({
    path: "/path/to/project",
    ignorePatterns: [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "*.min.js"
    ]
});

// Re-index to apply
await mcp__claude-context__sync_now({
    path: "/path/to/project"
});
```

### Example 2: Only Index TypeScript Files

```typescript
await mcp__claude-context__update_codebase_config({
    path: "/path/to/project",
    fileExtensions: [".ts", ".tsx"],
    ignorePatterns: ["node_modules/**"]
});
```

### Example 3: Check Current Configuration

```typescript
await mcp__claude-context__get_codebase_config({
    path: "/path/to/project"
});

// Returns:
// Configuration for: /path/to/project
// {
//   "ignorePatterns": ["node_modules/**"],
//   "maxFileSize": 10485760,
//   "fileExtensions": [],
//   ...
// }
```

### Example 4: Reset to Defaults

```typescript
// Remove all custom config, back to indexing everything
await mcp__claude-context__reset_codebase_config({
    path: "/path/to/project"
});
```

---

## 🎯 Success Criteria

- ✅ No filesystem pollution (no `.config` dirs)
- ✅ Configs stored in Milvus
- ✅ Default: index everything (empty ignorePatterns)
- ✅ Users can configure per codebase via MCP tools
- ✅ Performance optimization works when ignorePatterns set
- ✅ Configuration persists across sessions
- ✅ All tests passing
- ✅ Documentation updated

---

## 🔗 Files to Modify/Create

### Create New Files
- `packages/core/src/config/codebase-config.ts`
- `packages/core/src/config/__tests__/codebase-config.test.ts`

### Modify Existing Files
- `packages/core/src/context.ts` - Add config manager integration
- `packages/core/src/index.ts` - Export config classes
- `packages/mcp/src/handlers.ts` - Add config handlers
- `packages/mcp/src/server.ts` - Register new tools
- `packages/mcp/src/__tests__/handlers-integration.test.ts` - Add tests

---

## ⏱️ Estimated Effort

- **Step 1** (CodebaseConfigManager): 2-3 hours
- **Step 2** (Context integration): 1 hour
- **Step 3** (MCP handlers): 1-2 hours
- **Step 4** (Tool registration): 30 minutes
- **Testing**: 1 hour
- **Documentation**: 30 minutes

**Total**: ~6-8 hours

---

## 📊 Migration Path for Users

For users upgrading from v0.3.0:

1. **First run**: All codebases use defaults (no ignores)
2. **To restore old behavior**: Run for each codebase:
   ```typescript
   mcp__claude-context__update_codebase_config({
     path: "/path/to/project",
     ignorePatterns: [
       "node_modules/**", ".git/**", "dist/**",
       "build/**", "coverage/**", ".vscode/**"
       // ... other patterns they want
     ]
   })
   ```
3. **Run sync**: Apply changes with `sync_now`

---

**Ready to implement Phase 2?** This will complete the configuration system and make the codebase fully functional with user-configurable ignore patterns stored in the database.
