import * as fs from 'fs';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { Context } from '../context';

export class FileSystemWatcher {
    private watcher: FSWatcher | null = null;
    private debounceMap = new Map<string, NodeJS.Timeout>();
    private context: Context;
    private isEnabled = false;

    constructor(private codebasePath: string, context: Context) {
        this.context = context;
    }

    private setupWatcher(): void {
        if (this.watcher) {
            return; // Already set up
        }

        const ignorePatterns = this.context.getIgnorePatterns();
        
        this.watcher = chokidar.watch(this.codebasePath, {
            ignored: ignorePatterns.length > 0 ? ignorePatterns : undefined,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000, // Wait 1s for write completion
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (filePath: string) => this.handleFileEvent('add', filePath))
            .on('change', (filePath: string) => this.handleFileEvent('change', filePath))
            .on('unlink', (filePath: string) => this.handleFileEvent('unlink', filePath))
            .on('error', (error: unknown) => {
                console.error('[FileWatcher] Watcher error:', error);
            });

        console.log(`[FileWatcher] Set up filesystem watcher for ${this.codebasePath}`);
    }

    private handleFileEvent(event: string, filePath: string): void {
        if (!this.isEnabled) {
            return;
        }

        // Skip non-supported extensions
        const supportedExtensions = this.context.getSupportedExtensions();
        if (!supportedExtensions.some(ext => filePath.endsWith(ext))) {
            return;
        }

        // Debounce rapid changes (e.g., save + auto-format)
        const debounceKey = `${event}:${filePath}`;
        if (this.debounceMap.has(debounceKey)) {
            clearTimeout(this.debounceMap.get(debounceKey)!);
        }

        this.debounceMap.set(debounceKey, setTimeout(async () => {
            try {
                await this.processFileChange(event, filePath);
                this.debounceMap.delete(debounceKey);
            } catch (error) {
                console.error(`[FileWatcher] Error processing ${event} for ${filePath}:`, error);
            }
        }, 500)); // 500ms debounce
    }

    private async processFileChange(event: string, filePath: string): Promise<void> {
        const relativePath = path.relative(this.codebasePath, filePath);

        console.log(`[FileWatcher] Processing ${event}: ${relativePath}`);

        try {
            const collectionName = this.context.getCollectionName(this.codebasePath);
            const synchronizer = this.context.getSynchronizers().get(collectionName);

            if (synchronizer && typeof (synchronizer as any).updateSingleFile === 'function') {
                // Phase 3: Use optimized single-file update
                console.log(`[FileWatcher] Using optimized single-file update for ${relativePath}`);
                const result = await (synchronizer as any).updateSingleFile(filePath);
                console.log(`[FileWatcher] Single file update result: ${result.action} - ${result.relativePath}`);

                // Update vector database only if there was an actual change
                if (result.action === 'added' || result.action === 'modified') {
                    // Re-process the file in the vector database
                    await this.context.reindexByChange(this.codebasePath);
                } else if (result.action === 'removed') {
                    // File was removed - reindex to clean up vector database
                    await this.context.reindexByChange(this.codebasePath);
                }
            } else {
                // Fallback to full reindex if updateSingleFile not available
                console.log(`[FileWatcher] Falling back to full reindex for ${relativePath}`);
                await this.context.reindexByChange(this.codebasePath);
            }

            console.log(`[FileWatcher] Updated index for ${relativePath}`);
        } catch (error) {
            console.error(`[FileWatcher] Failed to update index for ${relativePath}:`, error);
            // Continue processing other files even if one fails
        }
    }

    async enable(): Promise<void> {
        if (this.isEnabled) {
            console.log(`[FileWatcher] Real-time sync already enabled for ${this.codebasePath}`);
            return;
        }

        this.setupWatcher();
        this.isEnabled = true;
        console.log(`[FileWatcher] Enabled real-time sync for ${this.codebasePath}`);
    }

    async disable(): Promise<void> {
        if (!this.isEnabled) {
            console.log(`[FileWatcher] Real-time sync already disabled for ${this.codebasePath}`);
            return;
        }

        this.isEnabled = false;

        // Clear any pending debounced operations
        for (const timeout of this.debounceMap.values()) {
            clearTimeout(timeout);
        }
        this.debounceMap.clear();

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }

        console.log(`[FileWatcher] Disabled real-time sync for ${this.codebasePath}`);
    }

    /**
     * Check if the watcher is currently enabled
     */
    isWatcherEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get statistics about the watcher
     */
    getStats(): {
        isEnabled: boolean;
        codebasePath: string;
        pendingOperations: number;
        watchedPaths: string[];
    } {
        return {
            isEnabled: this.isEnabled,
            codebasePath: this.codebasePath,
            pendingOperations: this.debounceMap.size,
            watchedPaths: this.watcher ? this.watcher.getWatched() ? Object.keys(this.watcher.getWatched()) : [] : []
        };
    }
}