import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { MerkleDAG } from './merkle';
import * as os from 'os';

export class FileSynchronizer {
    private fileHashes: Map<string, string>;
    private merkleDAG: MerkleDAG;
    private rootDir: string;
    private snapshotPath: string;
    private ignorePatterns: string[];
    
    // Phase 3: Performance optimization caches
    private mtimeCache = new Map<string, number>();
    private lastFullScan = 0;
    private readonly FULL_SCAN_INTERVAL = 300000; // 5 minutes

    constructor(rootDir: string, ignorePatterns: string[] = []) {
        this.rootDir = rootDir;
        this.snapshotPath = this.getSnapshotPath(rootDir);
        this.fileHashes = new Map();
        this.merkleDAG = new MerkleDAG();
        this.ignorePatterns = ignorePatterns;
    }

    private getSnapshotPath(codebasePath: string): string {
        const homeDir = os.homedir();
        const merkleDir = path.join(homeDir, '.context', 'merkle');

        const normalizedPath = path.resolve(codebasePath);
        const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');

        return path.join(merkleDir, `${hash}.json`);
    }

    private async hashFile(filePath: string): Promise<string> {
        // Double-check that this is actually a file, not a directory
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            throw new Error(`Attempted to hash a directory: ${filePath}`);
        }
        const content = await fs.readFile(filePath, 'utf-8');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Phase 3: Optimized hash computation with mtime caching
     * Only rehashes file if mtime has changed since last check
     */
    private async hashFileOptimized(filePath: string, relativePath: string): Promise<string> {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            throw new Error(`Attempted to hash a directory: ${filePath}`);
        }

        const currentMtime = stat.mtimeMs;
        const cachedMtime = this.mtimeCache.get(relativePath);
        const existingHash = this.fileHashes.get(relativePath);

        // Use cached hash if mtime hasn't changed
        if (cachedMtime === currentMtime && existingHash) {
            return existingHash;
        }

        // File changed or not in cache - compute new hash
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        // Update caches
        this.mtimeCache.set(relativePath, currentMtime);
        
        return hash;
    }

    private async generateFileHashes(dir: string): Promise<Map<string, string>> {
        const fileHashes = new Map<string, string>();

        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (error: any) {
            console.warn(`[Synchronizer] Cannot read directory ${dir}: ${error.message}`);
            return fileHashes;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.rootDir, fullPath);

            // Check if this path should be ignored BEFORE any file system operations
            if (this.shouldIgnore(relativePath, entry.isDirectory())) {
                continue; // Skip completely - no access at all
            }

            // Double-check with fs.stat to be absolutely sure about file type
            let stat;
            try {
                stat = await fs.stat(fullPath);
            } catch (error: any) {
                console.warn(`[Synchronizer] Cannot stat ${fullPath}: ${error.message}`);
                continue;
            }

            if (stat.isDirectory()) {
                // Verify it's really a directory and not ignored
                if (!this.shouldIgnore(relativePath, true)) {
                    const subHashes = await this.generateFileHashes(fullPath);
                    const entries = Array.from(subHashes.entries());
                    for (let i = 0; i < entries.length; i++) {
                        const [p, h] = entries[i];
                        fileHashes.set(p, h);
                    }
                }
            } else if (stat.isFile()) {
                // Verify it's really a file and not ignored
                if (!this.shouldIgnore(relativePath, false)) {
                    try {
                        const hash = await this.hashFileOptimized(fullPath, relativePath);
                        fileHashes.set(relativePath, hash);
                    } catch (error: any) {
                        console.warn(`[Synchronizer] Cannot hash file ${fullPath}: ${error.message}`);
                        continue;
                    }
                }
            }
            // Skip other types (symlinks, etc.)
        }
        return fileHashes;
    }

    private shouldIgnore(relativePath: string, isDirectory: boolean = false): boolean {
        // Always ignore hidden files and directories (starting with .)
        const pathParts = relativePath.split(path.sep);
        if (pathParts.some(part => part.startsWith('.'))) {
            return true;
        }

        if (this.ignorePatterns.length === 0) {
            return false;
        }

        // Normalize path separators and remove leading/trailing slashes
        const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

        if (!normalizedPath) {
            return false; // Don't ignore root
        }

        // Check direct pattern matches first
        for (const pattern of this.ignorePatterns) {
            if (this.matchPattern(normalizedPath, pattern, isDirectory)) {
                return true;
            }
        }

        // Check if any parent directory is ignored
        const normalizedPathParts = normalizedPath.split('/');
        for (let i = 0; i < normalizedPathParts.length; i++) {
            const partialPath = normalizedPathParts.slice(0, i + 1).join('/');
            for (const pattern of this.ignorePatterns) {
                // Check directory patterns
                if (pattern.endsWith('/')) {
                    const dirPattern = pattern.slice(0, -1);
                    if (this.simpleGlobMatch(partialPath, dirPattern) ||
                        this.simpleGlobMatch(normalizedPathParts[i], dirPattern)) {
                        return true;
                    }
                }
                // Check exact path patterns
                else if (pattern.includes('/')) {
                    if (this.simpleGlobMatch(partialPath, pattern)) {
                        return true;
                    }
                }
                // Check filename patterns against any path component
                else {
                    if (this.simpleGlobMatch(normalizedPathParts[i], pattern)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private matchPattern(filePath: string, pattern: string, isDirectory: boolean = false): boolean {
        // Clean both path and pattern
        const cleanPath = filePath.replace(/^\/+|\/+$/g, '');
        const cleanPattern = pattern.replace(/^\/+|\/+$/g, '');

        if (!cleanPath || !cleanPattern) {
            return false;
        }

        // Handle directory patterns (ending with /)
        if (pattern.endsWith('/')) {
            if (!isDirectory) return false; // Directory pattern only matches directories
            const dirPattern = cleanPattern.slice(0, -1);

            // Direct match or any path component matches
            return this.simpleGlobMatch(cleanPath, dirPattern) ||
                cleanPath.split('/').some(part => this.simpleGlobMatch(part, dirPattern));
        }

        // Handle path patterns (containing /)
        if (cleanPattern.includes('/')) {
            return this.simpleGlobMatch(cleanPath, cleanPattern);
        }

        // Handle filename patterns (no /) - match against basename
        const fileName = path.basename(cleanPath);
        return this.simpleGlobMatch(fileName, cleanPattern);
    }

    private simpleGlobMatch(text: string, pattern: string): boolean {
        if (!text || !pattern) return false;

        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
            .replace(/\*/g, '.*'); // Convert * to .*

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    }

    private buildMerkleDAG(fileHashes: Map<string, string>): MerkleDAG {
        const dag = new MerkleDAG();
        const keys = Array.from(fileHashes.keys());
        const sortedPaths = keys.slice().sort(); // Create a sorted copy

        // Create a root node for the entire directory
        let valuesString = "";
        keys.forEach(key => {
            valuesString += fileHashes.get(key);
        });
        const rootNodeData = "root:" + valuesString;
        const rootNodeId = dag.addNode(rootNodeData);

        // Add each file as a child of the root
        for (const path of sortedPaths) {
            const fileData = path + ":" + fileHashes.get(path);
            dag.addNode(fileData, rootNodeId);
        }

        return dag;
    }

    public async initialize() {
        console.log(`Initializing file synchronizer for ${this.rootDir}`);
        await this.loadSnapshot();
        this.merkleDAG = this.buildMerkleDAG(this.fileHashes);
        console.log(`[Synchronizer] File synchronizer initialized. Loaded ${this.fileHashes.size} file hashes.`);
    }

    public async checkForChanges(): Promise<{ added: string[], removed: string[], modified: string[] }> {
        console.log('[Synchronizer] Checking for file changes...');

        const newFileHashes = await this.generateFileHashes(this.rootDir);
        const newMerkleDAG = this.buildMerkleDAG(newFileHashes);

        // Compare the DAGs
        const changes = MerkleDAG.compare(this.merkleDAG, newMerkleDAG);

        // If there are any changes in the DAG, we should also do a file-level comparison
        if (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0) {
            console.log('[Synchronizer] Merkle DAG has changed. Comparing file states...');
            const fileChanges = this.compareStates(this.fileHashes, newFileHashes);

            this.fileHashes = newFileHashes;
            this.merkleDAG = newMerkleDAG;
            await this.saveSnapshot();

            console.log(`[Synchronizer] Found changes: ${fileChanges.added.length} added, ${fileChanges.removed.length} removed, ${fileChanges.modified.length} modified.`);
            return fileChanges;
        }

        console.log('[Synchronizer] No changes detected based on Merkle DAG comparison.');
        return { added: [], removed: [], modified: [] };
    }

    private compareStates(oldHashes: Map<string, string>, newHashes: Map<string, string>): { added: string[], removed: string[], modified: string[] } {
        const added: string[] = [];
        const removed: string[] = [];
        const modified: string[] = [];

        const newEntries = Array.from(newHashes.entries());
        for (let i = 0; i < newEntries.length; i++) {
            const [file, hash] = newEntries[i];
            if (!oldHashes.has(file)) {
                added.push(file);
            } else if (oldHashes.get(file) !== hash) {
                modified.push(file);
            }
        }

        const oldKeys = Array.from(oldHashes.keys());
        for (let i = 0; i < oldKeys.length; i++) {
            const file = oldKeys[i];
            if (!newHashes.has(file)) {
                removed.push(file);
            }
        }

        return { added, removed, modified };
    }

    public getFileHash(filePath: string): string | undefined {
        return this.fileHashes.get(filePath);
    }

    private async saveSnapshot(): Promise<void> {
        const merkleDir = path.dirname(this.snapshotPath);
        await fs.mkdir(merkleDir, { recursive: true });

        // Convert Map to array without using iterator
        const fileHashesArray: [string, string][] = [];
        const keys = Array.from(this.fileHashes.keys());
        keys.forEach(key => {
            fileHashesArray.push([key, this.fileHashes.get(key)!]);
        });

        // Convert mtime cache Map to array for serialization
        const mtimeCacheArray: [string, number][] = [];
        const mtimeKeys = Array.from(this.mtimeCache.keys());
        mtimeKeys.forEach(key => {
            mtimeCacheArray.push([key, this.mtimeCache.get(key)!]);
        });

        const data = JSON.stringify({
            fileHashes: fileHashesArray,
            merkleDAG: this.merkleDAG.serialize(),
            mtimeCache: mtimeCacheArray,
            lastFullScan: this.lastFullScan
        });
        await fs.writeFile(this.snapshotPath, data, 'utf-8');
        console.log(`Saved snapshot to ${this.snapshotPath}`);
    }

    private async loadSnapshot(): Promise<void> {
        try {
            const data = await fs.readFile(this.snapshotPath, 'utf-8');
            const obj = JSON.parse(data);

            // Reconstruct Map without using constructor with iterator
            this.fileHashes = new Map();
            for (const [key, value] of obj.fileHashes) {
                this.fileHashes.set(key, value);
            }

            if (obj.merkleDAG) {
                this.merkleDAG = MerkleDAG.deserialize(obj.merkleDAG);
            }

            // Load mtime cache if available
            this.mtimeCache = new Map();
            if (obj.mtimeCache) {
                for (const [key, value] of obj.mtimeCache) {
                    this.mtimeCache.set(key, value);
                }
            }

            // Load last full scan timestamp
            this.lastFullScan = obj.lastFullScan || 0;

            console.log(`Loaded snapshot from ${this.snapshotPath}`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log(`Snapshot file not found at ${this.snapshotPath}. Generating new one.`);
                this.fileHashes = await this.generateFileHashes(this.rootDir);
                this.merkleDAG = this.buildMerkleDAG(this.fileHashes);
                await this.saveSnapshot();
            } else {
                throw error;
            }
        }
    }

    /**
     * Phase 3: Update single file for real-time changes
     * Optimizes for single file updates without full directory scan
     */
    async updateSingleFile(filePath: string): Promise<{ action: 'added' | 'modified' | 'removed'; relativePath: string }> {
        const relativePath = path.relative(this.rootDir, filePath);
        
        try {
            // Check if file exists
            const exists = await fs.access(filePath).then(() => true).catch(() => false);
            
            if (!exists) {
                // File was deleted
                if (this.fileHashes.has(relativePath)) {
                    this.fileHashes.delete(relativePath);
                    this.mtimeCache.delete(relativePath);
                    this.merkleDAG = this.buildMerkleDAG(this.fileHashes);
                    await this.saveSnapshot();
                    return { action: 'removed', relativePath };
                }
                return { action: 'removed', relativePath }; // Already removed
            }

            // Check if should ignore
            const stat = await fs.stat(filePath);
            if (stat.isDirectory() || this.shouldIgnore(relativePath, false)) {
                return { action: 'removed', relativePath }; // Treat as no-op
            }

            // File exists - check if it's new or modified
            const newHash = await this.hashFileOptimized(filePath, relativePath);
            const existingHash = this.fileHashes.get(relativePath);
            
            if (!existingHash) {
                // New file
                this.fileHashes.set(relativePath, newHash);
                this.merkleDAG = this.buildMerkleDAG(this.fileHashes);
                await this.saveSnapshot();
                return { action: 'added', relativePath };
            } else if (existingHash !== newHash) {
                // Modified file
                this.fileHashes.set(relativePath, newHash);
                this.merkleDAG = this.buildMerkleDAG(this.fileHashes);
                await this.saveSnapshot();
                return { action: 'modified', relativePath };
            }

            // No change
            return { action: 'modified', relativePath }; // No-op, but return something
            
        } catch (error: any) {
            console.error(`[Synchronizer] Error updating single file ${filePath}:`, error.message);
            throw error;
        }
    }

    /**
     * Phase 3: Incremental change detection
     * Uses mtime and selective scanning to minimize file I/O
     */
    async checkForChangesIncremental(): Promise<{ added: string[], removed: string[], modified: string[] }> {
        const now = Date.now();
        
        // Force full scan periodically or if it's the first time
        if (now - this.lastFullScan > this.FULL_SCAN_INTERVAL || this.lastFullScan === 0) {
            console.log('[Synchronizer] Performing full scan (periodic or first-time)');
            this.lastFullScan = now;
            return this.checkForChanges(); // Fallback to full scan
        }

        console.log('[Synchronizer] Performing incremental change detection...');
        
        // Quick check: scan directory for new/removed files using mtime
        const quickScan = await this.quickDirectoryScan(this.rootDir);
        
        if (quickScan.hasChanges) {
            console.log('[Synchronizer] Changes detected, performing targeted rescan');
            return this.checkForChanges(); // Full rescan if changes detected
        }

        console.log('[Synchronizer] No changes detected in incremental scan');
        return { added: [], removed: [], modified: [] };
    }

    /**
     * Quick directory scan using mtime to detect if any changes occurred
     */
    private async quickDirectoryScan(dir: string): Promise<{ hasChanges: boolean; changedPaths: string[] }> {
        const changedPaths: string[] = [];
        let hasChanges = false;

        const scanDirectory = async (currentDir: string): Promise<void> => {
            try {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    const relativePath = path.relative(this.rootDir, fullPath);

                    if (this.shouldIgnore(relativePath, entry.isDirectory())) {
                        continue;
                    }

                    const stat = await fs.stat(fullPath);
                    
                    if (stat.isDirectory()) {
                        await scanDirectory(fullPath);
                    } else if (stat.isFile()) {
                        const currentMtime = stat.mtimeMs;
                        const cachedMtime = this.mtimeCache.get(relativePath);
                        
                        if (cachedMtime === undefined || cachedMtime !== currentMtime) {
                            hasChanges = true;
                            changedPaths.push(relativePath);
                        }
                    }
                }
            } catch (error: any) {
                console.warn(`[Synchronizer] Error scanning directory ${currentDir}:`, error.message);
            }
        };

        await scanDirectory(dir);
        return { hasChanges, changedPaths };
    }

    /**
     * Delete snapshot file for a given codebase path
     */
    static async deleteSnapshot(codebasePath: string): Promise<void> {
        const homeDir = os.homedir();
        const merkleDir = path.join(homeDir, '.context', 'merkle');
        const normalizedPath = path.resolve(codebasePath);
        const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
        const snapshotPath = path.join(merkleDir, `${hash}.json`);

        try {
            await fs.unlink(snapshotPath);
            console.log(`Deleted snapshot file: ${snapshotPath}`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log(`Snapshot file not found (already deleted): ${snapshotPath}`);
            } else {
                console.error(`[Synchronizer] Failed to delete snapshot file ${snapshotPath}:`, error.message);
                throw error; // Re-throw non-ENOENT errors
            }
        }
    }
}