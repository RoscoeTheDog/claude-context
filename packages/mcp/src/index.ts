#!/usr/bin/env node

// CRITICAL: Redirect console outputs to stderr IMMEDIATELY to avoid interfering with MCP JSON protocol
// Only MCP protocol messages should go to stdout
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
    process.stderr.write('[LOG] ' + args.join(' ') + '\n');
};

console.warn = (...args: any[]) => {
    process.stderr.write('[WARN] ' + args.join(' ') + '\n');
};

// console.error already goes to stderr by default

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { Context } from "@zilliz/claude-context-core";
import { MilvusVectorDatabase } from "@zilliz/claude-context-core";

// Import our modular components
import { createMcpConfig, logConfigurationSummary, showHelpMessage, ContextMcpConfig } from "./config.js";
import { createEmbeddingInstance, logEmbeddingProviderInfo } from "./embedding.js";
import { SnapshotManager } from "./snapshot.js";
import { SyncManager } from "./sync.js";
import { ToolHandlers } from "./handlers.js";

class ContextMcpServer {
    private server: Server;
    private context: Context;
    private snapshotManager: SnapshotManager;
    private syncManager: SyncManager;
    private toolHandlers: ToolHandlers;

    constructor(config: ContextMcpConfig) {
        // Initialize MCP server
        this.server = new Server(
            {
                name: config.name,
                version: config.version
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        // Initialize embedding provider
        console.log(`[EMBEDDING] Initializing embedding provider: ${config.embeddingProvider}`);
        console.log(`[EMBEDDING] Using model: ${config.embeddingModel}`);

        const embedding = createEmbeddingInstance(config);
        logEmbeddingProviderInfo(config, embedding);

        // Initialize vector database
        const vectorDatabase = new MilvusVectorDatabase({
            address: config.milvusAddress,
            ...(config.milvusToken && { token: config.milvusToken })
        });

        // Initialize Claude Context
        this.context = new Context({
            embedding,
            vectorDatabase
        });

        // Initialize managers
        this.snapshotManager = new SnapshotManager();
        this.syncManager = new SyncManager(this.context, this.snapshotManager);
        this.toolHandlers = new ToolHandlers(this.context, this.snapshotManager);

        // Load existing codebase snapshot on startup
        this.snapshotManager.loadCodebaseSnapshot();

        this.setupTools();
    }

    private setupTools() {
        const index_description = `
📚 Index a codebase to enable semantic search

USE WHEN: First time using search_code or after major codebase changes
DON'T USE: Repeatedly on same path (use sync_now for updates)

BASIC USAGE:
  index_codebase({ path: "/absolute/path/to/project" })

RETURNS: Indexing status with progress updates
  • Automatically detects parent indexes (avoids duplicates)
  • AST-based splitting (syntax-aware, default)
  • Indexes in background (non-blocking)

OPTIONAL PARAMS:
  • force: Re-index even if exists (default: false)
  • scope: "auto" (detect parent) or "local" (this dir only)
  • splitter: "ast" (syntax-aware) or "langchain" (text-based)

EXAMPLES:
  Basic:    index_codebase({ path: "." })
  Force:    index_codebase({ path: ".", force: true })
  Custom:   index_codebase({ path: ".", customExtensions: [".vue"] })

⚠️ ABSOLUTE paths required. Use pwd or __dirname.
✨ Conflict detected? Prompt user before force=true.
`;


        const search_description = `
🔍 Semantic code search with automatic token optimization

USE WHEN: Looking for code by concept ("authentication logic", "error handling")
DON'T USE: Searching for known symbols (use Serena's find_symbol instead)

BASIC USAGE:
  search_code({ path: ".", query: "how is auth handled?" })

RETURNS: Automatically optimized based on result count
  • 1-3 results: Full code details (0% savings)
  • 4-10 results: Compact summaries (~50% smaller)
  • 11-25 results: High-level summaries (~75% smaller)
  • 26+ results: File paths only (~90% smaller)

OPTIONAL PARAMS:
  • limit: Max results (default: 10)
  • detail: Override auto-format ("full"|"compact"|"summary"|"locations")
  • extensionFilter: File types (e.g., [".ts", ".js"])

EXAMPLES:
  Basic:    search_code({ path: ".", query: "JWT token generation" })
  Limited:  search_code({ path: "src/", query: "error handling", limit: 5 })
  Paths:    search_code({ path: ".", query: "API routes", detail: "locations" })

⚠️ IMPORTANT: You MUST provide an absolute path.
✨ If the codebase is not indexed, use index_codebase first.
`;

        // Define available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "index_codebase",
                        description: index_description,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to index.`
                                },
                                force: {
                                    type: "boolean",
                                    description: "Force re-indexing even if already indexed",
                                    default: false
                                },
                                scope: {
                                    type: "string",
                                    enum: ["auto", "local"],
                                    description: "Index scope: 'auto' (detect parent, default) or 'local' (index only this directory)",
                                    default: "auto"
                                },
                                splitter: {
                                    type: "string",
                                    description: "Code splitter to use: 'ast' for syntax-aware splitting with automatic fallback, 'langchain' for character-based splitting",
                                    enum: ["ast", "langchain"],
                                    default: "ast"
                                },
                                customExtensions: {
                                    type: "array",
                                    items: {
                                        type: "string"
                                    },
                                    description: "Optional: Additional file extensions to include beyond defaults (e.g., ['.vue', '.svelte', '.astro']). Extensions should include the dot prefix or will be automatically added",
                                    default: []
                                },
                                ignorePatterns: {
                                    type: "array",
                                    items: {
                                        type: "string"
                                    },
                                    description: "Optional: Additional ignore patterns to exclude specific files/directories beyond defaults. Only include this parameter if the user explicitly requests custom ignore patterns (e.g., ['static/**', '*.tmp', 'private/**'])",
                                    default: []
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "search_code",
                        description: search_description,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to search in.`
                                },
                                query: {
                                    type: "string",
                                    description: "Natural language query to search for in the codebase"
                                },
                                limit: {
                                    type: "number",
                                    description: "Maximum number of results to return",
                                    default: 10,
                                    maximum: 50
                                },
                                detail: {
                                    type: "string",
                                    enum: ["auto", "full", "compact", "summary", "locations"],
                                    description: "Result detail level: 'auto' (detect based on count, default), 'full' (complete code), 'compact' (50% smaller), 'summary' (75% smaller), 'locations' (90% smaller, paths only)",
                                    default: "auto"
                                },
                                extensionFilter: {
                                    type: "array",
                                    items: {
                                        type: "string"
                                    },
                                    description: "Optional: List of file extensions to filter results. (e.g., ['.ts','.py']).",
                                    default: []
                                }
                            },
                            required: ["path", "query"]
                        }
                    },
                    {
                        name: "clear_index",
                        description: `
🗑️ Clear search index for a codebase

USE WHEN: Removing old project or fixing corrupted index
DON'T USE: For updates (use sync_now instead)

BASIC USAGE:
  clear_index({ path: "/absolute/path/to/project" })

RETURNS: Confirmation of index deletion
  ⚠️ DESTRUCTIVE: Cannot be undone
  ⚠️ Requires re-indexing to search again

EXAMPLE:
  clear_index({ path: "." })

⚠️ ABSOLUTE paths required. Prompts for confirmation recommended.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to clear.`
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "get_indexing_status",
                        description: `
📊 Check indexing progress for a codebase

USE WHEN: After calling index_codebase (monitoring progress)
DON'T USE: For sync status (use get_sync_status instead)

BASIC USAGE:
  get_indexing_status({ path: "/absolute/path/to/project" })

RETURNS: Progress status
  • indexing: Shows % complete (e.g., "45% complete")
  • completed: Index ready for searches
  • not_indexed: Path not indexed yet

EXAMPLE:
  get_indexing_status({ path: "." })

⚠️ ABSOLUTE paths required.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to check status for.`
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "get_index_tree",
                        description: `
🌳 View indexed file tree with statistics

USE WHEN: Exploring indexed structure
DON'T USE: For filesystem tree (use bash 'tree')

BASIC: get_index_tree({ path: "." })

RETURNS: Tree of indexed files with chunk stats
OPTIONAL: depth (default: 3), relative_path (focus subdir), show_files

EXAMPLES:
  Basic:  get_index_tree({ path: "." })
  Subdir: get_index_tree({ path: ".", relative_path: "src/" })

⚠️ ABSOLUTE paths required.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: "ABSOLUTE path to the indexed codebase"
                                },
                                relative_path: {
                                    type: "string",
                                    description: "Optional: Show tree starting from this subdirectory (e.g., 'src/components')"
                                },
                                depth: {
                                    type: "number",
                                    description: "Maximum depth to show (default: 3, -1 = unlimited)",
                                    default: 3
                                },
                                show_files: {
                                    type: "boolean",
                                    description: "Show files or just directories (default: true)",
                                    default: true
                                },
                                format: {
                                    type: "string",
                                    enum: ["tree", "list"],
                                    description: "Output format (default: 'tree')",
                                    default: "tree"
                                },
                                include_stats: {
                                    type: "boolean",
                                    description: "Include file and chunk counts (default: true)",
                                    default: true
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "enable_realtime_sync",
                        description: `
🔄 Enable auto-sync when files change

USE WHEN: Active development
DON'T USE: One-time searches or read-only codebases

BASIC: enable_realtime_sync({ path: "." })

RETURNS: Sync enabled, watches file changes, updates index automatically

⚠️ ABSOLUTE paths required. Disable with disable_realtime_sync.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to enable real-time sync for.`
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "disable_realtime_sync",
                        description: `
⏸️ Stop auto-sync for a codebase

USE WHEN: Finished with active development or reducing resource usage
DON'T USE: During active development (miss updates)

BASIC USAGE:
  disable_realtime_sync({ path: "/absolute/path/to/project" })

RETURNS: Sync disabled confirmation
  • Stops filesystem watching
  • Index remains (not deleted)
  • Use sync_now for manual updates

EXAMPLE:
  disable_realtime_sync({ path: "." })

⚠️ ABSOLUTE paths required.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to disable real-time sync for.`
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "get_realtime_sync_status",
                        description: `
📡 Check if auto-sync is enabled

USE WHEN: Verifying sync state
DON'T USE: For indexing progress (use get_indexing_status)

BASIC: get_realtime_sync_status({ path: "." }) or get_realtime_sync_status({}) for all

RETURNS: enabled/disabled status for one or all codebases

⚠️ ABSOLUTE paths required (if providing path).
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `Optional: ABSOLUTE path to the codebase directory to check status for. If not provided, shows status for all codebases.`
                                }
                            },
                            required: []
                        }
                    },
                    {
                        name: "get_sync_status",
                        description: `
📈 Detailed sync metrics for a codebase

USE WHEN: Debugging sync issues or checking performance
DON'T USE: For simple enabled/disabled check (use get_realtime_sync_status)

BASIC USAGE:
  get_sync_status({ path: "/absolute/path/to/project" })

RETURNS: Comprehensive sync data
  • Realtime sync state (enabled/disabled)
  • Last sync time and duration
  • Cache hit/miss rates
  • Performance statistics

EXAMPLE:
  get_sync_status({ path: "." })

⚠️ ABSOLUTE paths required.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to check sync status for.`
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "sync_now",
                        description: `
⚡ Force immediate index update

USE WHEN: After bulk file changes or when sync disabled
DON'T USE: When realtime sync is active (redundant)

BASIC USAGE:
  sync_now({ path: "/absolute/path/to/project" })

RETURNS: Sync operation results
  • Files added/modified/deleted
  • Sync duration and performance
  • Bypasses sync intervals (immediate)

EXAMPLE:
  sync_now({ path: "." })

⚠️ ABSOLUTE paths required. Prefer enable_realtime_sync for auto-updates.
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `ABSOLUTE path to the codebase directory to sync immediately.`
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "get_performance_stats",
                        description: `
📊 Performance metrics for sync operations

USE WHEN: Analyzing performance bottlenecks
DON'T USE: For basic status (use get_sync_status)

BASIC: get_performance_stats({ path: "." }) or get_performance_stats({}) for global

RETURNS: Cache hit/miss, timings, resource utilization

⚠️ ABSOLUTE paths required (if providing path).
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `Optional: ABSOLUTE path to get stats for a specific codebase. If not provided, shows global statistics.`
                                }
                            },
                            required: []
                        }
                    },
                    {
                        name: "health_check",
                        description: `
🏥 System health diagnostics

USE WHEN: Troubleshooting issues
DON'T USE: For routine status (use get_sync_status)

BASIC: health_check({ path: "." }) or health_check({}) for global

RETURNS: ✅healthy / ⚠️warnings / ❌errors, feature flags status

⚠️ ABSOLUTE paths required (if providing path).
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `Optional: ABSOLUTE path to check health for a specific codebase. If not provided, performs global health check.`
                                }
                            },
                            required: []
                        }
                    },
                    {
                        name: "get_sync_history",
                        description: `
📜 Audit trail of sync operations

USE WHEN: Debugging sync issues
DON'T USE: For current status (use get_sync_status)

BASIC: get_sync_history({ path: ".", limit: 10 }) or get_sync_history({}) for global

RETURNS: Timestamp, duration, files changed, success/failure per operation
OPTIONAL: limit (default: 10, max: 50)

⚠️ ABSOLUTE paths required (if providing path).
`,
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: `Optional: ABSOLUTE path to get history for a specific codebase. If not provided, shows global history summary.`
                                },
                                limit: {
                                    type: "number",
                                    description: `Number of recent entries to show (default: 10, max: 50)`,
                                    default: 10,
                                    maximum: 50
                                }
                            },
                            required: []
                        }
                    },
                    {
                        name: "get_codebase_config",
                        description: `
⚙️ View codebase indexing configuration

USE WHEN: Checking current ignore patterns or indexing settings
DON'T USE: For general status (use health_check)

BASIC USAGE:
  get_codebase_config({ path: "/absolute/path/to/project" })

RETURNS: Configuration details
  • Ignore patterns (e.g., node_modules/**)
  • File size limits
  • Extension filters
  • Indexing options (symlinks, hidden files)

EXAMPLE:
  get_codebase_config({ path: "." })

⚠️ ABSOLUTE paths required.
`,
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
                        description: `
🔧 Modify indexing configuration

USE WHEN: Customizing ignore patterns or indexing behavior
DON'T USE: For re-indexing (use index_codebase with force)

BASIC: update_codebase_config({ path: ".", ignorePatterns: ["*.log"] })

OPTIONAL: ignorePatterns, maxFileSize, fileExtensions
Stored in DB, persists across sessions. Run sync_now to apply.

⚠️ ABSOLUTE paths required.
`,
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
                        description: `
🔄 Reset configuration to defaults

USE WHEN: Removing custom settings
DON'T USE: For clearing index (use clear_index)

BASIC: reset_codebase_config({ path: "." })

RETURNS: Removes custom patterns, restores defaults. Run sync_now to apply.

⚠️ ABSOLUTE paths required.
`,
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
                        description: `
📋 List codebases with custom configurations

USE WHEN: Discovering which codebases have custom settings
DON'T USE: For checking single codebase (use get_codebase_config)

BASIC USAGE:
  list_codebase_configs({})

RETURNS: List of configured codebases
  • Shows all codebases with custom settings
  • Paths and summary of configuration
  • Excludes default/unconfigured codebases

EXAMPLE:
  list_codebase_configs({})
`,
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: []
                        }
                    }
                ]
            };
        });

        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            switch (name) {
                case "index_codebase":
                    return await this.toolHandlers.handleIndexCodebase(args);
                case "search_code":
                    return await this.toolHandlers.handleSearchCode(args);
                case "clear_index":
                    return await this.toolHandlers.handleClearIndex(args);
                case "get_indexing_status":
                    return await this.toolHandlers.handleGetIndexingStatus(args);
                case "get_index_tree":
                    return await this.toolHandlers.handleGetIndexTree(args);
                case "enable_realtime_sync":
                    return await this.toolHandlers.handleEnableRealtimeSync(args);
                case "disable_realtime_sync":
                    return await this.toolHandlers.handleDisableRealtimeSync(args);
                case "get_realtime_sync_status":
                    return await this.toolHandlers.handleGetRealtimeSyncStatus(args);
                case "get_sync_status":
                    return await this.toolHandlers.handleGetSyncStatus(args);
                case "sync_now":
                    return await this.toolHandlers.handleSyncNow(args);
                case "get_performance_stats":
                    return await this.toolHandlers.handleGetPerformanceStats(args);
                case "health_check":
                    return await this.toolHandlers.handleHealthCheck(args);
                case "get_sync_history":
                    return await this.toolHandlers.handleGetSyncHistory(args);
                case "get_codebase_config":
                    return await this.toolHandlers.handleGetCodebaseConfig(args as any);
                case "update_codebase_config":
                    return await this.toolHandlers.handleUpdateCodebaseConfig(args as any);
                case "reset_codebase_config":
                    return await this.toolHandlers.handleResetCodebaseConfig(args as any);
                case "list_codebase_configs":
                    return await this.toolHandlers.handleListCodebaseConfigs();

                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        });
    }

    async start() {
        console.log('[SYNC-DEBUG] MCP server start() method called');
        console.log('Starting Context MCP server...');

        // Initialize context (including config manager)
        await this.context.initialize();
        console.log('[SYNC-DEBUG] Context initialized');

        const transport = new StdioServerTransport();
        console.log('[SYNC-DEBUG] StdioServerTransport created, attempting server connection...');

        await this.server.connect(transport);
        console.log("MCP server started and listening on stdio.");
        console.log('[SYNC-DEBUG] Server connection established successfully');

        // Start background sync after server is connected
        console.log('[SYNC-DEBUG] Initializing background sync...');
        this.syncManager.startBackgroundSync();
        console.log('[SYNC-DEBUG] MCP server initialization complete');
    }
}

// Main execution
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Show help if requested
    if (args.includes('--help') || args.includes('-h')) {
        showHelpMessage();
        process.exit(0);
    }

    // Create configuration
    const config = createMcpConfig();
    logConfigurationSummary(config);

    const server = new ContextMcpServer(config);
    await server.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.error("Received SIGINT, shutting down gracefully...");
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error("Received SIGTERM, shutting down gracefully...");
    process.exit(0);
});

// Always start the server - this is designed to be the main entry point
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});