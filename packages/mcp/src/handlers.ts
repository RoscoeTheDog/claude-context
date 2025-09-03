import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Context, COLLECTION_LIMIT_MESSAGE } from "@zilliz/claude-context-core";
import { SnapshotManager } from "./snapshot.js";
import { ensureAbsolutePath, truncateContent, trackCodebasePath } from "./utils.js";

export class ToolHandlers {
    private context: Context;
    private snapshotManager: SnapshotManager;
    private indexingStats: { indexedFiles: number; totalChunks: number } | null = null;
    private currentWorkspace: string;
    private lastSyncCache = new Map<string, { timestamp: number; hasChanges: boolean }>();
    
    // Phase 5: Audit logging and history tracking
    private syncHistory = new Map<string, Array<{
        timestamp: number;
        operation: string;
        result: { added: number; modified: number; removed: number };
        duration: number;
        trigger: 'manual' | 'realtime' | 'scheduled' | 'pre-search';
    }>>();
    private readonly MAX_HISTORY_ENTRIES = 50;

    constructor(context: Context, snapshotManager: SnapshotManager) {
        this.context = context;
        this.snapshotManager = snapshotManager;
        this.currentWorkspace = process.cwd();
        console.log(`[WORKSPACE] Current workspace: ${this.currentWorkspace}`);
        
        // Set up periodic cache cleanup (every 5 minutes)
        setInterval(() => {
            this.clearSyncCache();
        }, 300000); // 5 minutes
    }

    /**
     * Quick sync check with caching to avoid redundant operations
     * Returns whether the index needs to be updated before search
     */
    private async quickSyncCheck(codebasePath: string): Promise<{
        hasChanges: boolean;
        changedFiles: string[];
        syncTime: number;
        fromCache: boolean;
    }> {
        const startTime = Date.now();
        const now = Date.now();
        const cacheEntry = this.lastSyncCache.get(codebasePath);
        
        // Use cache if less than 2 seconds old to avoid redundant checks
        if (cacheEntry && (now - cacheEntry.timestamp) < 2000) {
            return {
                hasChanges: cacheEntry.hasChanges,
                changedFiles: [],
                syncTime: Date.now() - startTime,
                fromCache: true
            };
        }

        const collectionName = this.context.getCollectionName(codebasePath);
        const synchronizer = this.context.getSynchronizers().get(collectionName);

        if (!synchronizer) {
            // Cache no-synchronizer result
            this.lastSyncCache.set(codebasePath, {
                timestamp: now,
                hasChanges: false
            });
            return { hasChanges: false, changedFiles: [], syncTime: Date.now() - startTime, fromCache: false };
        }

        try {
            // Phase 3: Use incremental change detection if available
            const changes = typeof (synchronizer as any).checkForChangesIncremental === 'function'
                ? await (synchronizer as any).checkForChangesIncremental()
                : await synchronizer.checkForChanges();
            
            const hasChanges = changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0;
            const changedFiles = [...changes.added, ...changes.modified, ...changes.removed];

            // Cache the result
            this.lastSyncCache.set(codebasePath, {
                timestamp: now,
                hasChanges
            });

            return {
                hasChanges,
                changedFiles,
                syncTime: Date.now() - startTime,
                fromCache: false
            };
        } catch (error) {
            console.warn(`[PRE-SEARCH] Quick sync check failed for ${codebasePath}:`, error);
            // Cache false to avoid repeated failures
            this.lastSyncCache.set(codebasePath, {
                timestamp: now,
                hasChanges: false
            });
            return { hasChanges: false, changedFiles: [], syncTime: Date.now() - startTime, fromCache: false };
        }
    }

    /**
     * Clear sync cache for a specific codebase (called after indexing operations)
     */
    private clearSyncCache(codebasePath?: string): void {
        if (codebasePath) {
            this.lastSyncCache.delete(codebasePath);
        } else {
            // Clear all cache entries older than 5 minutes
            const cutoff = Date.now() - 300000; // 5 minutes
            for (const [path, entry] of this.lastSyncCache.entries()) {
                if (entry.timestamp < cutoff) {
                    this.lastSyncCache.delete(path);
                }
            }
        }
    }

    /**
     * Get sync cache statistics for debugging
     */
    public getSyncCacheStats(): { cacheSize: number; entries: Array<{ path: string; timestamp: Date; hasChanges: boolean }> } {
        const entries = Array.from(this.lastSyncCache.entries()).map(([path, entry]) => ({
            path,
            timestamp: new Date(entry.timestamp),
            hasChanges: entry.hasChanges
        }));
        
        return {
            cacheSize: this.lastSyncCache.size,
            entries
        };
    }

    /**
     * Sync indexed codebases from Zilliz Cloud collections
     * This method fetches all collections from the vector database,
     * gets the first document from each collection to extract codebasePath from metadata,
     * and updates the snapshot with discovered codebases.
     * 
     * Logic: Compare mcp-codebase-snapshot.json with zilliz cloud collections
     * - If local snapshot has extra directories (not in cloud), remove them
     * - If local snapshot is missing directories (exist in cloud), ignore them
     */
    private async syncIndexedCodebasesFromCloud(): Promise<void> {
        try {
            console.log(`[SYNC-CLOUD] 🔄 Syncing indexed codebases from Zilliz Cloud...`);

            // Get all collections using the interface method
            const vectorDb = this.context.getVectorDatabase();

            // Use the new listCollections method from the interface
            const collections = await vectorDb.listCollections();

            console.log(`[SYNC-CLOUD] 📋 Found ${collections.length} collections in Zilliz Cloud`);

            if (collections.length === 0) {
                console.log(`[SYNC-CLOUD] ✅ No collections found in cloud`);
                // If no collections in cloud, remove all local codebases
                const localCodebases = this.snapshotManager.getIndexedCodebases();
                if (localCodebases.length > 0) {
                    console.log(`[SYNC-CLOUD] 🧹 Removing ${localCodebases.length} local codebases as cloud has no collections`);
                    for (const codebasePath of localCodebases) {
                        this.snapshotManager.removeIndexedCodebase(codebasePath);
                        console.log(`[SYNC-CLOUD] ➖ Removed local codebase: ${codebasePath}`);
                    }
                    this.snapshotManager.saveCodebaseSnapshot();
                    console.log(`[SYNC-CLOUD] 💾 Updated snapshot to match empty cloud state`);
                }
                return;
            }

            const cloudCodebases = new Set<string>();

            // Check each collection for codebase path
            for (const collectionName of collections) {
                try {
                    // Skip collections that don't match the code_chunks pattern (support both legacy and new collections)
                    if (!collectionName.startsWith('code_chunks_') && !collectionName.startsWith('hybrid_code_chunks_')) {
                        console.log(`[SYNC-CLOUD] ⏭️  Skipping non-code collection: ${collectionName}`);
                        continue;
                    }

                    console.log(`[SYNC-CLOUD] 🔍 Checking collection: ${collectionName}`);

                    // Query the first document to get metadata
                    const results = await vectorDb.query(
                        collectionName,
                        '', // Empty filter to get all results
                        ['metadata'], // Only fetch metadata field
                        1 // Only need one result to extract codebasePath
                    );

                    if (results && results.length > 0) {
                        const firstResult = results[0];
                        const metadataStr = firstResult.metadata;

                        if (metadataStr) {
                            try {
                                const metadata = JSON.parse(metadataStr);
                                const codebasePath = metadata.codebasePath;

                                if (codebasePath && typeof codebasePath === 'string') {
                                    console.log(`[SYNC-CLOUD] 📍 Found codebase path: ${codebasePath} in collection: ${collectionName}`);
                                    cloudCodebases.add(codebasePath);
                                } else {
                                    console.warn(`[SYNC-CLOUD] ⚠️  No codebasePath found in metadata for collection: ${collectionName}`);
                                }
                            } catch (parseError) {
                                console.warn(`[SYNC-CLOUD] ⚠️  Failed to parse metadata JSON for collection ${collectionName}:`, parseError);
                            }
                        } else {
                            console.warn(`[SYNC-CLOUD] ⚠️  No metadata found in collection: ${collectionName}`);
                        }
                    } else {
                        console.log(`[SYNC-CLOUD] ℹ️  Collection ${collectionName} is empty`);
                    }
                } catch (collectionError: any) {
                    console.warn(`[SYNC-CLOUD] ⚠️  Error checking collection ${collectionName}:`, collectionError.message || collectionError);
                    // Continue with next collection
                }
            }

            console.log(`[SYNC-CLOUD] 📊 Found ${cloudCodebases.size} valid codebases in cloud`);

            // Get current local codebases
            const localCodebases = new Set(this.snapshotManager.getIndexedCodebases());
            console.log(`[SYNC-CLOUD] 📊 Found ${localCodebases.size} local codebases in snapshot`);

            let hasChanges = false;

            // Remove local codebases that don't exist in cloud
            for (const localCodebase of localCodebases) {
                if (!cloudCodebases.has(localCodebase)) {
                    this.snapshotManager.removeIndexedCodebase(localCodebase);
                    hasChanges = true;
                    console.log(`[SYNC-CLOUD] ➖ Removed local codebase (not in cloud): ${localCodebase}`);
                }
            }

            // Note: We don't add cloud codebases that are missing locally (as per user requirement)
            console.log(`[SYNC-CLOUD] ℹ️  Skipping addition of cloud codebases not present locally (per sync policy)`);

            if (hasChanges) {
                this.snapshotManager.saveCodebaseSnapshot();
                console.log(`[SYNC-CLOUD] 💾 Updated snapshot to match cloud state`);
            } else {
                console.log(`[SYNC-CLOUD] ✅ Local snapshot already matches cloud state`);
            }

            console.log(`[SYNC-CLOUD] ✅ Cloud sync completed successfully`);
        } catch (error: any) {
            console.error(`[SYNC-CLOUD] ❌ Error syncing codebases from cloud:`, error.message || error);
            // Don't throw - this is not critical for the main functionality
        }
    }

    /**
     * Phase 5: Log sync operation for audit trail
     */
    private logSyncOperation(
        codebasePath: string,
        operation: string,
        result: { added: number; modified: number; removed: number },
        duration: number,
        trigger: 'manual' | 'realtime' | 'scheduled' | 'pre-search'
    ): void {
        const absolutePath = ensureAbsolutePath(codebasePath);
        
        if (!this.syncHistory.has(absolutePath)) {
            this.syncHistory.set(absolutePath, []);
        }
        
        const history = this.syncHistory.get(absolutePath)!;
        
        // Add new entry
        history.push({
            timestamp: Date.now(),
            operation,
            result,
            duration,
            trigger
        });
        
        // Maintain history size limit
        if (history.length > this.MAX_HISTORY_ENTRIES) {
            history.splice(0, history.length - this.MAX_HISTORY_ENTRIES);
        }
        
        console.log(`[SYNC-AUDIT] ${trigger.toUpperCase()}: ${operation} on ${absolutePath} - ${result.added}A/${result.modified}M/${result.removed}R in ${duration}ms`);
    }

    public async handleIndexCodebase(args: any) {
        const { path: codebasePath, force, splitter, customExtensions, ignorePatterns } = args;
        const forceReindex = force || false;
        const splitterType = splitter || 'ast'; // Default to AST
        const customFileExtensions = customExtensions || [];
        const customIgnorePatterns = ignorePatterns || [];

        try {
            // Sync indexed codebases from cloud first
            await this.syncIndexedCodebasesFromCloud();

            // Validate splitter parameter
            if (splitterType !== 'ast' && splitterType !== 'langchain') {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Invalid splitter type '${splitterType}'. Must be 'ast' or 'langchain'.`
                    }],
                    isError: true
                };
            }
            // Force absolute path resolution - warn if relative path provided
            const absolutePath = ensureAbsolutePath(codebasePath);

            // Validate path exists
            if (!fs.existsSync(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' does not exist. Original input: '${codebasePath}'`
                    }],
                    isError: true
                };
            }

            // Check if it's a directory
            const stat = fs.statSync(absolutePath);
            if (!stat.isDirectory()) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' is not a directory`
                    }],
                    isError: true
                };
            }

            // Check if already indexing
            if (this.snapshotManager.getIndexingCodebases().includes(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Codebase '${absolutePath}' is already being indexed in the background. Please wait for completion.`
                    }],
                    isError: true
                };
            }

            //Check if the snapshot and cloud index are in sync
            if (this.snapshotManager.getIndexedCodebases().includes(absolutePath) !== await this.context.hasIndex(absolutePath)) {
                console.warn(`[INDEX-VALIDATION] ❌ Snapshot and cloud index mismatch: ${absolutePath}`);
            }

            // Check if already indexed (unless force is true)
            if (!forceReindex && this.snapshotManager.getIndexedCodebases().includes(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Codebase '${absolutePath}' is already indexed. Use force=true to re-index.`
                    }],
                    isError: true
                };
            }

            // If force reindex and codebase is already indexed, remove it
            if (forceReindex) {
                if (this.snapshotManager.getIndexedCodebases().includes(absolutePath)) {
                    console.log(`[FORCE-REINDEX] 🔄 Removing '${absolutePath}' from indexed list for re-indexing`);
                    this.snapshotManager.removeIndexedCodebase(absolutePath);
                }
                if (await this.context.hasIndex(absolutePath)) {
                    console.log(`[FORCE-REINDEX] 🔄 Clearing index for '${absolutePath}'`);
                    await this.context.clearIndex(absolutePath);
                }
            }

            // CRITICAL: Pre-index collection creation validation
            try {
                console.log(`[INDEX-VALIDATION] 🔍 Validating collection creation capability`);
                const canCreateCollection = await this.context.getVectorDatabase().checkCollectionLimit();

                if (!canCreateCollection) {
                    console.error(`[INDEX-VALIDATION] ❌ Collection limit validation failed: ${absolutePath}`);

                    // CRITICAL: Immediately return the COLLECTION_LIMIT_MESSAGE to MCP client
                    return {
                        content: [{
                            type: "text",
                            text: COLLECTION_LIMIT_MESSAGE
                        }],
                        isError: true
                    };
                }

                console.log(`[INDEX-VALIDATION] ✅  Collection creation validation completed`);
            } catch (validationError: any) {
                // Handle other collection creation errors
                console.error(`[INDEX-VALIDATION] ❌ Collection creation validation failed:`, validationError);
                return {
                    content: [{
                        type: "text",
                        text: `Error validating collection creation: ${validationError.message || validationError}`
                    }],
                    isError: true
                };
            }

            // Add custom extensions if provided
            if (customFileExtensions.length > 0) {
                console.log(`[CUSTOM-EXTENSIONS] Adding ${customFileExtensions.length} custom extensions: ${customFileExtensions.join(', ')}`);
                this.context.addCustomExtensions(customFileExtensions);
            }

            // Add custom ignore patterns if provided (before loading file-based patterns)
            if (customIgnorePatterns.length > 0) {
                console.log(`[IGNORE-PATTERNS] Adding ${customIgnorePatterns.length} custom ignore patterns: ${customIgnorePatterns.join(', ')}`);
                this.context.addCustomIgnorePatterns(customIgnorePatterns);
            }

            // Check current status and log if retrying after failure
            const currentStatus = this.snapshotManager.getCodebaseStatus(absolutePath);
            if (currentStatus === 'indexfailed') {
                const failedInfo = this.snapshotManager.getCodebaseInfo(absolutePath) as any;
                console.log(`[BACKGROUND-INDEX] Retrying indexing for previously failed codebase. Previous error: ${failedInfo?.errorMessage || 'Unknown error'}`);
            }

            // Set to indexing status and save snapshot immediately
            this.snapshotManager.setCodebaseIndexing(absolutePath, 0);
            this.snapshotManager.saveCodebaseSnapshot();

            // Track the codebase path for syncing
            trackCodebasePath(absolutePath);

            // Start background indexing - now safe to proceed
            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType);

            const pathInfo = codebasePath !== absolutePath
                ? `\nNote: Input path '${codebasePath}' was resolved to absolute path '${absolutePath}'`
                : '';

            const extensionInfo = customFileExtensions.length > 0
                ? `\nUsing ${customFileExtensions.length} custom extensions: ${customFileExtensions.join(', ')}`
                : '';

            const ignoreInfo = customIgnorePatterns.length > 0
                ? `\nUsing ${customIgnorePatterns.length} custom ignore patterns: ${customIgnorePatterns.join(', ')}`
                : '';

            return {
                content: [{
                    type: "text",
                    text: `Started background indexing for codebase '${absolutePath}' using ${splitterType.toUpperCase()} splitter.${pathInfo}${extensionInfo}${ignoreInfo}\n\nIndexing is running in the background. You can search the codebase while indexing is in progress, but results may be incomplete until indexing completes.`
                }]
            };

        } catch (error: any) {
            // Enhanced error handling to prevent MCP service crash
            console.error('Error in handleIndexCodebase:', error);

            // Ensure we always return a proper MCP response, never throw
            return {
                content: [{
                    type: "text",
                    text: `Error starting indexing: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    private async startBackgroundIndexing(codebasePath: string, forceReindex: boolean, splitterType: string) {
        const absolutePath = codebasePath;
        let lastSaveTime = 0; // Track last save timestamp

        try {
            console.log(`[BACKGROUND-INDEX] Starting background indexing for: ${absolutePath}`);

            // Note: If force reindex, collection was already cleared during validation phase
            if (forceReindex) {
                console.log(`[BACKGROUND-INDEX] ℹ️  Force reindex mode - collection was already cleared during validation`);
            }

            // Use the existing Context instance for indexing.
            let contextForThisTask = this.context;
            if (splitterType !== 'ast') {
                console.warn(`[BACKGROUND-INDEX] Non-AST splitter '${splitterType}' requested; falling back to AST splitter`);
            }

            // Load ignore patterns from files first (including .ignore, .gitignore, etc.)
            await this.context.getLoadedIgnorePatterns(absolutePath);

            // Initialize file synchronizer with proper ignore patterns (including project-specific patterns)
            const { FileSynchronizer } = await import("@zilliz/claude-context-core");
            const ignorePatterns = this.context.getIgnorePatterns() || [];
            console.log(`[BACKGROUND-INDEX] Using ignore patterns: ${ignorePatterns.join(', ')}`);
            const synchronizer = new FileSynchronizer(absolutePath, ignorePatterns);
            await synchronizer.initialize();

            // Store synchronizer in the context (let context manage collection names)
            await this.context.getPreparedCollection(absolutePath);
            const collectionName = this.context.getCollectionName(absolutePath);
            this.context.setSynchronizer(collectionName, synchronizer);
            if (contextForThisTask !== this.context) {
                contextForThisTask.setSynchronizer(collectionName, synchronizer);
            }

            console.log(`[BACKGROUND-INDEX] Starting indexing with ${splitterType} splitter for: ${absolutePath}`);

            // Log embedding provider information before indexing
            const embeddingProvider = this.context.getEmbedding();
            console.log(`[BACKGROUND-INDEX] 🧠 Using embedding provider: ${embeddingProvider.getProvider()} with dimension: ${embeddingProvider.getDimension()}`);

            // Start indexing with the appropriate context and progress tracking
            console.log(`[BACKGROUND-INDEX] 🚀 Beginning codebase indexing process...`);
            const stats = await contextForThisTask.indexCodebase(absolutePath, (progress) => {
                // Update progress in snapshot manager using new method
                this.snapshotManager.setCodebaseIndexing(absolutePath, progress.percentage);

                // Save snapshot periodically (every 2 seconds to avoid too frequent saves)
                const currentTime = Date.now();
                if (currentTime - lastSaveTime >= 2000) { // 2 seconds = 2000ms
                    this.snapshotManager.saveCodebaseSnapshot();
                    lastSaveTime = currentTime;
                    console.log(`[BACKGROUND-INDEX] 💾 Saved progress snapshot at ${progress.percentage.toFixed(1)}%`);
                }

                console.log(`[BACKGROUND-INDEX] Progress: ${progress.phase} - ${progress.percentage}% (${progress.current}/${progress.total})`);
            });
            console.log(`[BACKGROUND-INDEX] ✅ Indexing completed successfully! Files: ${stats.indexedFiles}, Chunks: ${stats.totalChunks}`);

            // Set codebase to indexed status with complete statistics
            this.snapshotManager.setCodebaseIndexed(absolutePath, stats);
            this.indexingStats = { indexedFiles: stats.indexedFiles, totalChunks: stats.totalChunks };

            // Clear sync cache after successful indexing to ensure fresh checks
            this.clearSyncCache(absolutePath);

            // Save snapshot after updating codebase lists
            this.snapshotManager.saveCodebaseSnapshot();

            let message = `Background indexing completed for '${absolutePath}' using ${splitterType.toUpperCase()} splitter.\nIndexed ${stats.indexedFiles} files, ${stats.totalChunks} chunks.`;
            if (stats.status === 'limit_reached') {
                message += `\n⚠️  Warning: Indexing stopped because the chunk limit (450,000) was reached. The index may be incomplete.`;
            }

            console.log(`[BACKGROUND-INDEX] ${message}`);

        } catch (error: any) {
            console.error(`[BACKGROUND-INDEX] Error during indexing for ${absolutePath}:`, error);

            // Get the last attempted progress
            const lastProgress = this.snapshotManager.getIndexingProgress(absolutePath);

            // Set codebase to failed status with error information
            const errorMessage = error.message || String(error);
            this.snapshotManager.setCodebaseIndexFailed(absolutePath, errorMessage, lastProgress);
            this.snapshotManager.saveCodebaseSnapshot();

            // Log error but don't crash MCP service - indexing errors are handled gracefully
            console.error(`[BACKGROUND-INDEX] Indexing failed for ${absolutePath}: ${errorMessage}`);
        }
    }

    public async handleSearchCode(args: any) {
        const { path: codebasePath, query, limit = 10, extensionFilter } = args;
        const resultLimit = limit || 10;

        try {
            // Sync indexed codebases from cloud first
            await this.syncIndexedCodebasesFromCloud();

            // Force absolute path resolution - warn if relative path provided
            const absolutePath = ensureAbsolutePath(codebasePath);

            // Validate path exists
            if (!fs.existsSync(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' does not exist. Original input: '${codebasePath}'`
                    }],
                    isError: true
                };
            }

            // Check if it's a directory
            const stat = fs.statSync(absolutePath);
            if (!stat.isDirectory()) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' is not a directory`
                    }],
                    isError: true
                };
            }

            trackCodebasePath(absolutePath);

            // Check if this codebase is indexed or being indexed
            const isIndexed = this.snapshotManager.getIndexedCodebases().includes(absolutePath);
            const isIndexing = this.snapshotManager.getIndexingCodebases().includes(absolutePath);

            if (!isIndexed && !isIndexing) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Codebase '${absolutePath}' is not indexed. Please index it first using the index_codebase tool.`
                    }],
                    isError: true
                };
            }

            // NEW: Pre-search sync check to guarantee fresh index (controlled by ENABLE_PRE_SEARCH_SYNC)
            const preSearchSyncEnabled = process.env.ENABLE_PRE_SEARCH_SYNC !== 'false'; // Default to true
            if (isIndexed && !isIndexing && preSearchSyncEnabled) {
                const syncResult = await this.quickSyncCheck(absolutePath);
                
                if (syncResult.hasChanges) {
                    console.log(`[PRE-SEARCH] Detected ${syncResult.changedFiles.length} changed files (${syncResult.fromCache ? 'cached' : 'fresh check'} in ${syncResult.syncTime}ms)`);
                    console.log(`[PRE-SEARCH] Updating index before search...`);
                    
                    try {
                        const updateStart = Date.now();
                        await this.context.reindexByChange(absolutePath);
                        const updateTime = Date.now() - updateStart;
                        console.log(`[PRE-SEARCH] Index updated successfully in ${updateTime}ms`);
                        
                        // Clear cache after successful update
                        this.lastSyncCache.delete(absolutePath);
                    } catch (error) {
                        console.warn(`[PRE-SEARCH] WARNING: Index update failed, continuing with existing index:`, error);
                    }
                } else if (!syncResult.fromCache) {
                    console.log(`[PRE-SEARCH] Index is up-to-date (verified in ${syncResult.syncTime}ms)`);
                }
            } else if (!preSearchSyncEnabled) {
                console.log(`[PRE-SEARCH] Pre-search sync disabled by ENABLE_PRE_SEARCH_SYNC=false`);
            }

            // Show indexing status if codebase is being indexed
            let indexingStatusMessage = '';
            if (isIndexing) {
                indexingStatusMessage = `\n⚠️  **Indexing in Progress**: This codebase is currently being indexed in the background. Search results may be incomplete until indexing completes.`;
            }

            console.log(`[SEARCH] Searching in codebase: ${absolutePath}`);
            console.log(`[SEARCH] Query: "${query}"`);
            console.log(`[SEARCH] Indexing status: ${isIndexing ? 'In Progress' : 'Completed'}`);

            // Log embedding provider information before search
            const embeddingProvider = this.context.getEmbedding();
            console.log(`[SEARCH] 🧠 Using embedding provider: ${embeddingProvider.getProvider()} for search`);
            console.log(`[SEARCH] 🔍 Generating embeddings for query using ${embeddingProvider.getProvider()}...`);

            // Build filter expression from extensionFilter list
            let filterExpr: string | undefined = undefined;
            if (Array.isArray(extensionFilter) && extensionFilter.length > 0) {
                const cleaned = extensionFilter
                    .filter((v: any) => typeof v === 'string')
                    .map((v: string) => v.trim())
                    .filter((v: string) => v.length > 0);
                const invalid = cleaned.filter((e: string) => !(e.startsWith('.') && e.length > 1 && !/\s/.test(e)));
                if (invalid.length > 0) {
                    return {
                        content: [{ type: 'text', text: `Error: Invalid file extensions in extensionFilter: ${JSON.stringify(invalid)}. Use proper extensions like '.ts', '.py'.` }],
                        isError: true
                    };
                }
                const quoted = cleaned.map((e: string) => `'${e}'`).join(', ');
                filterExpr = `fileExtension in [${quoted}]`;
            }

            // Search in the specified codebase
            const searchResults = await this.context.semanticSearch(
                absolutePath,
                query,
                Math.min(resultLimit, 50),
                0.3,
                filterExpr
            );

            console.log(`[SEARCH] ✅ Search completed! Found ${searchResults.length} results using ${embeddingProvider.getProvider()} embeddings`);

            if (searchResults.length === 0) {
                let noResultsMessage = `No results found for query: "${query}" in codebase '${absolutePath}'`;
                if (isIndexing) {
                    noResultsMessage += `\n\nNote: This codebase is still being indexed. Try searching again after indexing completes, or the query may not match any indexed content.`;
                }
                return {
                    content: [{
                        type: "text",
                        text: noResultsMessage
                    }]
                };
            }

            // Format results
            const formattedResults = searchResults.map((result: any, index: number) => {
                const location = `${result.relativePath}:${result.startLine}-${result.endLine}`;
                const context = truncateContent(result.content, 5000);
                const codebaseInfo = path.basename(absolutePath);

                return `${index + 1}. Code snippet (${result.language}) [${codebaseInfo}]\n` +
                    `   Location: ${location}\n` +
                    `   Rank: ${index + 1}\n` +
                    `   Context: \n\`\`\`${result.language}\n${context}\n\`\`\`\n`;
            }).join('\n');

            let resultMessage = `Found ${searchResults.length} results for query: "${query}" in codebase '${absolutePath}'${indexingStatusMessage}\n\n${formattedResults}`;

            if (isIndexing) {
                resultMessage += `\n\n💡 **Tip**: This codebase is still being indexed. More results may become available as indexing progresses.`;
            }

            return {
                content: [{
                    type: "text",
                    text: resultMessage
                }]
            };
        } catch (error) {
            // Check if this is the collection limit error
            // Handle both direct string throws and Error objects containing the message
            const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));

            if (errorMessage === COLLECTION_LIMIT_MESSAGE || errorMessage.includes(COLLECTION_LIMIT_MESSAGE)) {
                // Return the collection limit message as a successful response
                // This ensures LLM treats it as final answer, not as retryable error
                return {
                    content: [{
                        type: "text",
                        text: COLLECTION_LIMIT_MESSAGE
                    }]
                };
            }

            return {
                content: [{
                    type: "text",
                    text: `Error searching code: ${errorMessage} Please check if the codebase has been indexed first.`
                }],
                isError: true
            };
        }
    }

    public async handleClearIndex(args: any) {
        const { path: codebasePath } = args;

        if (this.snapshotManager.getIndexedCodebases().length === 0 && this.snapshotManager.getIndexingCodebases().length === 0) {
            return {
                content: [{
                    type: "text",
                    text: "No codebases are currently indexed or being indexed."
                }]
            };
        }

        try {
            // Force absolute path resolution - warn if relative path provided
            const absolutePath = ensureAbsolutePath(codebasePath);

            // Validate path exists
            if (!fs.existsSync(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' does not exist. Original input: '${codebasePath}'`
                    }],
                    isError: true
                };
            }

            // Check if it's a directory
            const stat = fs.statSync(absolutePath);
            if (!stat.isDirectory()) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' is not a directory`
                    }],
                    isError: true
                };
            }

            // Check if this codebase is indexed or being indexed
            const isIndexed = this.snapshotManager.getIndexedCodebases().includes(absolutePath);
            const isIndexing = this.snapshotManager.getIndexingCodebases().includes(absolutePath);

            if (!isIndexed && !isIndexing) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Codebase '${absolutePath}' is not indexed or being indexed.`
                    }],
                    isError: true
                };
            }

            console.log(`[CLEAR] Clearing codebase: ${absolutePath}`);

            try {
                await this.context.clearIndex(absolutePath);
                console.log(`[CLEAR] Successfully cleared index for: ${absolutePath}`);
            } catch (error: any) {
                const errorMsg = `Failed to clear ${absolutePath}: ${error.message}`;
                console.error(`[CLEAR] ${errorMsg}`);
                return {
                    content: [{
                        type: "text",
                        text: errorMsg
                    }],
                    isError: true
                };
            }

            // Completely remove the cleared codebase from snapshot
            this.snapshotManager.removeCodebaseCompletely(absolutePath);

            // Reset indexing stats if this was the active codebase
            this.indexingStats = null;

            // Save snapshot after clearing index
            this.snapshotManager.saveCodebaseSnapshot();

            let resultText = `Successfully cleared codebase '${absolutePath}'`;

            const remainingIndexed = this.snapshotManager.getIndexedCodebases().length;
            const remainingIndexing = this.snapshotManager.getIndexingCodebases().length;

            if (remainingIndexed > 0 || remainingIndexing > 0) {
                resultText += `\n${remainingIndexed} other indexed codebase(s) and ${remainingIndexing} indexing codebase(s) remain`;
            }

            return {
                content: [{
                    type: "text",
                    text: resultText
                }]
            };
        } catch (error) {
            // Check if this is the collection limit error
            // Handle both direct string throws and Error objects containing the message
            const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));

            if (errorMessage === COLLECTION_LIMIT_MESSAGE || errorMessage.includes(COLLECTION_LIMIT_MESSAGE)) {
                // Return the collection limit message as a successful response
                // This ensures LLM treats it as final answer, not as retryable error
                return {
                    content: [{
                        type: "text",
                        text: COLLECTION_LIMIT_MESSAGE
                    }]
                };
            }

            return {
                content: [{
                    type: "text",
                    text: `Error clearing index: ${errorMessage}`
                }],
                isError: true
            };
        }
    }

    public async handleGetIndexingStatus(args: any) {
        const { path: codebasePath } = args;

        try {
            // Force absolute path resolution
            const absolutePath = ensureAbsolutePath(codebasePath);

            // Validate path exists
            if (!fs.existsSync(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' does not exist. Original input: '${codebasePath}'`
                    }],
                    isError: true
                };
            }

            // Check if it's a directory
            const stat = fs.statSync(absolutePath);
            if (!stat.isDirectory()) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' is not a directory`
                    }],
                    isError: true
                };
            }

            // Check indexing status using new status system
            const status = this.snapshotManager.getCodebaseStatus(absolutePath);
            const info = this.snapshotManager.getCodebaseInfo(absolutePath);

            let statusMessage = '';

            switch (status) {
                case 'indexed':
                    if (info && 'indexedFiles' in info) {
                        const indexedInfo = info as any;
                        statusMessage = `✅ Codebase '${absolutePath}' is fully indexed and ready for search.`;
                        statusMessage += `\n📊 Statistics: ${indexedInfo.indexedFiles} files, ${indexedInfo.totalChunks} chunks`;
                        statusMessage += `\n📅 Status: ${indexedInfo.indexStatus}`;
                        statusMessage += `\n🕐 Last updated: ${new Date(indexedInfo.lastUpdated).toLocaleString()}`;
                    } else {
                        statusMessage = `✅ Codebase '${absolutePath}' is fully indexed and ready for search.`;
                    }
                    break;

                case 'indexing':
                    if (info && 'indexingPercentage' in info) {
                        const indexingInfo = info as any;
                        const progressPercentage = indexingInfo.indexingPercentage || 0;
                        statusMessage = `🔄 Codebase '${absolutePath}' is currently being indexed. Progress: ${progressPercentage.toFixed(1)}%`;

                        // Add more detailed status based on progress
                        if (progressPercentage < 10) {
                            statusMessage += ' (Preparing and scanning files...)';
                        } else if (progressPercentage < 100) {
                            statusMessage += ' (Processing files and generating embeddings...)';
                        }
                        statusMessage += `\n🕐 Last updated: ${new Date(indexingInfo.lastUpdated).toLocaleString()}`;
                    } else {
                        statusMessage = `🔄 Codebase '${absolutePath}' is currently being indexed.`;
                    }
                    break;

                case 'indexfailed':
                    if (info && 'errorMessage' in info) {
                        const failedInfo = info as any;
                        statusMessage = `❌ Codebase '${absolutePath}' indexing failed.`;
                        statusMessage += `\n🚨 Error: ${failedInfo.errorMessage}`;
                        if (failedInfo.lastAttemptedPercentage !== undefined) {
                            statusMessage += `\n📊 Failed at: ${failedInfo.lastAttemptedPercentage.toFixed(1)}% progress`;
                        }
                        statusMessage += `\n🕐 Failed at: ${new Date(failedInfo.lastUpdated).toLocaleString()}`;
                        statusMessage += `\n💡 You can retry indexing by running the index_codebase command again.`;
                    } else {
                        statusMessage = `❌ Codebase '${absolutePath}' indexing failed. You can retry indexing.`;
                    }
                    break;

                case 'not_found':
                default:
                    statusMessage = `❌ Codebase '${absolutePath}' is not indexed. Please use the index_codebase tool to index it first.`;
                    break;
            }

            const pathInfo = codebasePath !== absolutePath
                ? `\nNote: Input path '${codebasePath}' was resolved to absolute path '${absolutePath}'`
                : '';

            return {
                content: [{
                    type: "text",
                    text: statusMessage + pathInfo
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting indexing status: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Enable real-time filesystem sync for a codebase
     */
    public async handleEnableRealtimeSync(args: any) {
        try {
            const { path: codebasePath } = args;
            
            if (!codebasePath) {
                return {
                    content: [{
                        type: "text",
                        text: "Error: 'path' parameter is required"
                    }],
                    isError: true
                };
            }

            const absolutePath = ensureAbsolutePath(codebasePath);
            
            if (!fs.existsSync(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' does not exist`
                    }],
                    isError: true
                };
            }

            // Check if codebase is indexed first
            const hasIndex = await this.context.hasIndex(absolutePath);
            if (!hasIndex) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Codebase '${absolutePath}' must be indexed before enabling real-time sync. Please run index_codebase first.`
                    }],
                    isError: true
                };
            }

            await this.context.enableRealtimeSync(absolutePath);
            
            return {
                content: [{
                    type: "text",
                    text: `Real-time filesystem sync enabled for: ${absolutePath}`
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error enabling real-time sync: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Disable real-time filesystem sync for a codebase
     */
    public async handleDisableRealtimeSync(args: any) {
        try {
            const { path: codebasePath } = args;
            
            if (!codebasePath) {
                return {
                    content: [{
                        type: "text",
                        text: "Error: 'path' parameter is required"
                    }],
                    isError: true
                };
            }

            const absolutePath = ensureAbsolutePath(codebasePath);
            
            await this.context.disableRealtimeSync(absolutePath);
            
            return {
                content: [{
                    type: "text",
                    text: `Real-time filesystem sync disabled for: ${absolutePath}`
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error disabling real-time sync: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Get real-time sync status and statistics
     */
    public async handleGetRealtimeSyncStatus(args: any) {
        try {
            const { path: codebasePath } = args;
            
            if (codebasePath) {
                const absolutePath = ensureAbsolutePath(codebasePath);
                const isEnabled = this.context.isRealtimeSyncEnabled(absolutePath);
                
                return {
                    content: [{
                        type: "text",
                        text: `Real-time sync for '${absolutePath}': ${isEnabled ? 'ENABLED' : 'DISABLED'}`
                    }]
                };
            } else {
                // Get status for all codebases
                const stats = this.context.getRealtimeSyncStats();
                
                if (stats.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: "No real-time sync watchers are currently active."
                        }]
                    };
                }

                const statusLines = stats.map(stat => 
                    `${stat.codebasePath}: ${stat.isEnabled ? 'ENABLED' : 'DISABLED'} ` +
                    `(${stat.pendingOperations} pending, ${stat.watchedPaths.length} watched paths)`
                );

                return {
                    content: [{
                        type: "text",
                        text: `Real-time sync status:\n${statusLines.join('\n')}`
                    }]
                };
            }

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting real-time sync status: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Phase 5: Enhanced sync status with detailed metrics
     */
    public async handleGetSyncStatus(args: any) {
        try {
            const { path: codebasePath } = args;
            
            if (!codebasePath) {
                return {
                    content: [{
                        type: "text",
                        text: "Error: 'path' parameter is required"
                    }],
                    isError: true
                };
            }

            const absolutePath = ensureAbsolutePath(codebasePath);
            
            // Gather comprehensive status information
            const hasIndex = await this.context.hasIndex(absolutePath);
            const isRealtimeEnabled = this.context.isRealtimeSyncEnabled(absolutePath);
            const collectionName = this.context.getCollectionName(absolutePath);
            
            // Get sync cache information
            const syncCache = this.lastSyncCache.get(absolutePath);
            const lastSyncTime = syncCache ? new Date(syncCache.timestamp).toLocaleString() : 'Never';
            
            // Get real-time sync statistics if enabled
            let realtimeStats = '';
            if (isRealtimeEnabled) {
                const stats = this.context.getRealtimeSyncStats();
                const currentStats = stats.find(stat => stat.codebasePath === absolutePath);
                if (currentStats) {
                    realtimeStats = `\n• Pending operations: ${currentStats.pendingOperations}\n• Watched paths: ${currentStats.watchedPaths.length}`;
                }
            }

            // Get file synchronizer stats
            let synchronizerStats = '';
            const synchronizer = this.context.getSynchronizers().get(collectionName);
            if (synchronizer && typeof (synchronizer as any).mtimeCache !== 'undefined') {
                const mtimeCacheSize = (synchronizer as any).mtimeCache?.size || 0;
                synchronizerStats = `\n• Cached file mtimes: ${mtimeCacheSize}`;
            }

            const statusText = `Sync Status for '${absolutePath}':\n` +
                             `• Index status: ${hasIndex ? 'Ready' : 'Not indexed'}\n` +
                             `• Real-time sync: ${isRealtimeEnabled ? 'Enabled' : 'Disabled'}\n` +
                             `• Last sync check: ${lastSyncTime}` +
                             realtimeStats +
                             synchronizerStats;

            return {
                content: [{
                    type: "text",
                    text: statusText
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting sync status: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Phase 5: Manual sync trigger with detailed reporting
     */
    public async handleSyncNow(args: any) {
        try {
            const { path: codebasePath } = args;
            
            if (!codebasePath) {
                return {
                    content: [{
                        type: "text",
                        text: "Error: 'path' parameter is required"
                    }],
                    isError: true
                };
            }

            const absolutePath = ensureAbsolutePath(codebasePath);
            
            if (!fs.existsSync(absolutePath)) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Path '${absolutePath}' does not exist`
                    }],
                    isError: true
                };
            }

            // Check if indexed
            const hasIndex = await this.context.hasIndex(absolutePath);
            if (!hasIndex) {
                return {
                    content: [{
                        type: "text",
                        text: `Error: Codebase '${absolutePath}' is not indexed. Please run index_codebase first.`
                    }],
                    isError: true
                };
            }

            const startTime = Date.now();
            console.log(`[MANUAL-SYNC] Starting manual sync for ${absolutePath}`);
            
            const result = await this.context.reindexByChange(absolutePath);
            const syncTime = Date.now() - startTime;
            
            // Phase 5: Log sync operation for audit trail
            this.logSyncOperation(absolutePath, 'sync_now', result, syncTime, 'manual');
            
            // Clear sync cache to force fresh check next time
            this.lastSyncCache.delete(absolutePath);
            
            const hasChanges = result.added > 0 || result.modified > 0 || result.removed > 0;
            
            let statusText = `Manual sync completed in ${syncTime}ms:\n` +
                           `• Added: ${result.added} files\n` +
                           `• Modified: ${result.modified} files\n` +
                           `• Removed: ${result.removed} files`;
            
            if (!hasChanges) {
                statusText += `\n• No changes detected - index is up to date`;
            }

            return {
                content: [{
                    type: "text",
                    text: statusText
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error during manual sync: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Phase 5: Performance metrics and statistics
     */
    public async handleGetPerformanceStats(args: any) {
        try {
            const { path: codebasePath } = args;

            if (codebasePath) {
                // Stats for specific codebase
                const absolutePath = ensureAbsolutePath(codebasePath);
                const collectionName = this.context.getCollectionName(absolutePath);
                const synchronizer = this.context.getSynchronizers().get(collectionName);
                
                let stats = `Performance Stats for '${absolutePath}':\n`;
                
                if (synchronizer) {
                    // File synchronizer performance metrics
                    const mtimeCacheSize = (synchronizer as any).mtimeCache?.size || 0;
                    const lastFullScan = (synchronizer as any).lastFullScan || 0;
                    const timeSinceFullScan = lastFullScan ? Date.now() - lastFullScan : 0;
                    
                    stats += `\n• FileSynchronizer:\n`;
                    stats += `  - Cached file mtimes: ${mtimeCacheSize}\n`;
                    stats += `  - Last full scan: ${lastFullScan ? new Date(lastFullScan).toLocaleString() : 'Never'}\n`;
                    stats += `  - Time since full scan: ${Math.round(timeSinceFullScan / 1000)}s\n`;
                }

                // Real-time sync stats
                const isRealtimeEnabled = this.context.isRealtimeSyncEnabled(absolutePath);
                if (isRealtimeEnabled) {
                    const realtimeStats = this.context.getRealtimeSyncStats();
                    const currentStats = realtimeStats.find(stat => stat.codebasePath === absolutePath);
                    if (currentStats) {
                        stats += `\n• Real-time Sync:\n`;
                        stats += `  - Status: Enabled\n`;
                        stats += `  - Pending operations: ${currentStats.pendingOperations}\n`;
                        stats += `  - Watched paths: ${currentStats.watchedPaths.length}\n`;
                    }
                }

                // Sync cache stats
                const syncCache = this.lastSyncCache.get(absolutePath);
                if (syncCache) {
                    stats += `\n• Sync Cache:\n`;
                    stats += `  - Last check: ${new Date(syncCache.timestamp).toLocaleString()}\n`;
                    stats += `  - Had changes: ${syncCache.hasChanges ? 'Yes' : 'No'}\n`;
                }

                return {
                    content: [{
                        type: "text",
                        text: stats
                    }]
                };

            } else {
                // Global performance stats
                const totalCaches = this.lastSyncCache.size;
                const realtimeStats = this.context.getRealtimeSyncStats();
                const totalWatchers = realtimeStats.length;
                const totalSynchronizers = this.context.getSynchronizers().size;

                let globalStats = `Global Performance Statistics:\n\n`;
                globalStats += `• System Overview:\n`;
                globalStats += `  - Active synchronizers: ${totalSynchronizers}\n`;
                globalStats += `  - Real-time watchers: ${totalWatchers}\n`;
                globalStats += `  - Sync caches: ${totalCaches}\n`;

                if (realtimeStats.length > 0) {
                    const totalPending = realtimeStats.reduce((sum, stat) => sum + stat.pendingOperations, 0);
                    const totalWatched = realtimeStats.reduce((sum, stat) => sum + stat.watchedPaths.length, 0);
                    
                    globalStats += `\n• Real-time Sync Totals:\n`;
                    globalStats += `  - Total pending operations: ${totalPending}\n`;
                    globalStats += `  - Total watched paths: ${totalWatched}\n`;
                }

                return {
                    content: [{
                        type: "text",
                        text: globalStats
                    }]
                };
            }

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting performance stats: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Phase 5: System health check and diagnostics
     */
    public async handleHealthCheck(args: any) {
        try {
            const { path: codebasePath } = args;
            const startTime = Date.now();
            let healthReport = `System Health Check Report:\n`;
            let issues: string[] = [];
            let warnings: string[] = [];

            if (codebasePath) {
                // Health check for specific codebase
                const absolutePath = ensureAbsolutePath(codebasePath);
                healthReport += `\nTarget: ${absolutePath}\n`;

                // Check 1: Path exists
                if (!fs.existsSync(absolutePath)) {
                    issues.push(`Path does not exist: ${absolutePath}`);
                } else {
                    healthReport += `• Path exists: OK\n`;
                }

                // Check 2: Index status
                const hasIndex = await this.context.hasIndex(absolutePath);
                if (!hasIndex) {
                    warnings.push(`Codebase is not indexed`);
                } else {
                    healthReport += `• Index status: OK\n`;
                }

                // Check 3: Synchronizer status
                const collectionName = this.context.getCollectionName(absolutePath);
                const synchronizer = this.context.getSynchronizers().get(collectionName);
                if (!synchronizer) {
                    warnings.push(`No synchronizer found`);
                } else {
                    healthReport += `• Synchronizer: OK\n`;
                    
                    // Check mtime cache health
                    const mtimeCacheSize = (synchronizer as any).mtimeCache?.size || 0;
                    if (mtimeCacheSize === 0) {
                        warnings.push(`Mtime cache is empty (may impact performance)`);
                    } else {
                        healthReport += `• Mtime cache: OK (${mtimeCacheSize} entries)\n`;
                    }
                }

                // Check 4: Real-time sync status
                const isRealtimeEnabled = this.context.isRealtimeSyncEnabled(absolutePath);
                if (isRealtimeEnabled) {
                    healthReport += `• Real-time sync: Enabled\n`;
                    
                    const stats = this.context.getRealtimeSyncStats();
                    const currentStats = stats.find(stat => stat.codebasePath === absolutePath);
                    if (currentStats && currentStats.pendingOperations > 10) {
                        warnings.push(`High number of pending operations (${currentStats.pendingOperations})`);
                    }
                } else {
                    healthReport += `• Real-time sync: Disabled\n`;
                }

            } else {
                // Global system health check
                healthReport += `\nGlobal System Status:\n`;

                // Check memory usage and performance
                const totalSynchronizers = this.context.getSynchronizers().size;
                const totalCaches = this.lastSyncCache.size;
                const realtimeStats = this.context.getRealtimeSyncStats();
                
                healthReport += `• Active synchronizers: ${totalSynchronizers}\n`;
                healthReport += `• Sync caches: ${totalCaches}\n`;
                healthReport += `• Real-time watchers: ${realtimeStats.length}\n`;

                // Check for resource issues
                if (totalCaches > 50) {
                    warnings.push(`High number of sync caches (${totalCaches}) - consider cleanup`);
                }

                const totalPending = realtimeStats.reduce((sum, stat) => sum + stat.pendingOperations, 0);
                if (totalPending > 20) {
                    warnings.push(`High total pending operations (${totalPending})`);
                }
            }

            // Summary
            const checkTime = Date.now() - startTime;
            healthReport += `\nHealth Check Summary:\n`;
            healthReport += `• Check completed in: ${checkTime}ms\n`;
            healthReport += `• Issues found: ${issues.length}\n`;
            healthReport += `• Warnings: ${warnings.length}\n`;

            if (issues.length > 0) {
                healthReport += `\nISSUES:\n${issues.map(issue => `  - ${issue}`).join('\n')}\n`;
            }

            if (warnings.length > 0) {
                healthReport += `\nWARNINGS:\n${warnings.map(warning => `  - ${warning}`).join('\n')}\n`;
            }

            if (issues.length === 0 && warnings.length === 0) {
                healthReport += `\nAll systems operational!`;
            }

            return {
                content: [{
                    type: "text",
                    text: healthReport
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error during health check: ${error.message || error}`
                }],
                isError: true
            };
        }
    }

    /**
     * Phase 5: Get sync history and audit trail
     */
    public async handleGetSyncHistory(args: any) {
        try {
            const { path: codebasePath, limit = 10 } = args;
            
            if (!codebasePath) {
                // Get global sync history summary
                const allPaths = Array.from(this.syncHistory.keys());
                let globalSummary = `Sync History Summary:\n\n`;
                
                if (allPaths.length === 0) {
                    globalSummary += `No sync operations recorded.`;
                } else {
                    globalSummary += `Active codebases: ${allPaths.length}\n`;
                    
                    let totalOperations = 0;
                    for (const path of allPaths) {
                        const history = this.syncHistory.get(path) || [];
                        totalOperations += history.length;
                    }
                    globalSummary += `Total operations: ${totalOperations}\n`;
                    globalSummary += `\nRecent activity:\n`;
                    
                    // Show recent operations across all codebases
                    const allOperations: Array<{ path: string; entry: any }> = [];
                    for (const path of allPaths) {
                        const history = this.syncHistory.get(path) || [];
                        history.forEach(entry => {
                            allOperations.push({ path, entry });
                        });
                    }
                    
                    allOperations
                        .sort((a, b) => b.entry.timestamp - a.entry.timestamp)
                        .slice(0, Math.min(limit, 10))
                        .forEach(({ path, entry }) => {
                            const date = new Date(entry.timestamp).toLocaleString();
                            const pathShort = path.length > 50 ? '...' + path.slice(-47) : path;
                            globalSummary += `  • ${date} - ${entry.trigger}: ${pathShort} (${entry.result.added}A/${entry.result.modified}M/${entry.result.removed}R)\n`;
                        });
                }

                return {
                    content: [{
                        type: "text",
                        text: globalSummary
                    }]
                };
            }

            const absolutePath = ensureAbsolutePath(codebasePath);
            const history = this.syncHistory.get(absolutePath) || [];
            
            if (history.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No sync history found for '${absolutePath}'`
                    }]
                };
            }

            const recentHistory = history
                .slice(-Math.min(limit, this.MAX_HISTORY_ENTRIES))
                .reverse(); // Show most recent first

            let historyText = `Sync History for '${absolutePath}' (${recentHistory.length} entries):\n\n`;
            
            recentHistory.forEach((entry, index) => {
                const date = new Date(entry.timestamp).toLocaleString();
                const trigger = entry.trigger.toUpperCase().padEnd(10);
                const duration = `${entry.duration}ms`.padStart(6);
                const changes = `${entry.result.added}A/${entry.result.modified}M/${entry.result.removed}R`;
                
                historyText += `${(index + 1).toString().padStart(2)}. ${date} | ${trigger} | ${duration} | ${changes} | ${entry.operation}\n`;
            });

            // Add summary stats
            const totalOps = history.length;
            const avgDuration = Math.round(history.reduce((sum, entry) => sum + entry.duration, 0) / totalOps);
            const triggers = history.reduce((acc: Record<string, number>, entry) => {
                acc[entry.trigger] = (acc[entry.trigger] || 0) + 1;
                return acc;
            }, {});

            historyText += `\nSummary:\n`;
            historyText += `• Total operations: ${totalOps}\n`;
            historyText += `• Average duration: ${avgDuration}ms\n`;
            historyText += `• By trigger: ${Object.entries(triggers).map(([k, v]) => `${k}:${v}`).join(', ')}\n`;

            return {
                content: [{
                    type: "text",
                    text: historyText
                }]
            };

        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Error getting sync history: ${error.message || error}`
                }],
                isError: true
            };
        }
    }
} 