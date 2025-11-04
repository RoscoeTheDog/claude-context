import * as path from "path";
import * as fs from "fs";
import type { SnapshotManager } from './snapshot.js';

/**
 * Truncate content to specified length
 */
export function truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
        return content;
    }
    return content.substring(0, maxLength) + '...';
}

/**
 * Ensure path is absolute. If relative path is provided, resolve it properly.
 */
export function ensureAbsolutePath(inputPath: string): string {
    // If already absolute, return as is
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }

    // For relative paths, resolve to absolute path
    const resolved = path.resolve(inputPath);
    return resolved;
}

export function trackCodebasePath(codebasePath: string): void {
    const absolutePath = ensureAbsolutePath(codebasePath);
    console.log(`[TRACKING] Tracked codebase path: ${absolutePath} (not marked as indexed)`);
}

/**
 * Check if a path is a filesystem root
 * @param dirPath - Absolute directory path
 * @returns true if path is a filesystem root
 */
export function isFilesystemRoot(dirPath: string): boolean {
    const normalized = path.normalize(dirPath);

    // Unix root
    if (normalized === '/') return true;

    // Windows drive root (C:\, D:\, etc.)
    if (/^[A-Z]:\\$/i.test(normalized)) return true;

    // Windows UNC root (\\server\share or \\server\share\)
    // Note: path.normalize() adds a trailing backslash to UNC paths
    if (/^\\\\[^\\]+\\[^\\]+\\?$/i.test(normalized)) return true;

    return false;
}

/**
 * Normalize path for cross-platform comparison (CRITICAL for Windows)
 * - Converts backslashes to forward slashes
 * - Removes trailing slash
 * - Lowercase on Windows (case-insensitive)
 *
 * @param filePath - Path to normalize
 * @returns Normalized path for comparison
 */
export function normalizePathForComparison(filePath: string): string {
    let normalized = path.normalize(filePath).replace(/\\/g, '/');

    // Remove trailing slash (except for root)
    if (normalized.endsWith('/') && normalized !== '/') {
        normalized = normalized.slice(0, -1);
    }

    // Lowercase on Windows for case-insensitive comparison
    if (process.platform === 'win32') {
        normalized = normalized.toLowerCase();
    }

    return normalized;
}

/**
 * Resolve symlinks to real path (with fallback)
 * @param targetPath - Path to resolve
 * @returns Real path or original if resolution fails
 */
export function resolveRealPath(targetPath: string): string {
    try {
        return fs.realpathSync(targetPath);
    } catch (error) {
        console.warn(`[PATH-UTILS] Could not resolve symlink for ${targetPath}:`, error);
        return targetPath; // Fallback to original
    }
}

/**
 * Check if directory exists
 * @param dirPath - Path to check
 * @returns true if path exists and is a directory
 */
export function directoryExists(dirPath: string): boolean {
    try {
        const stats = fs.statSync(dirPath);
        return stats.isDirectory();
    } catch (error: any) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            console.warn(`[PATH-UTILS] Permission denied for: ${dirPath}`);
        }
        return false; // Treat as "does not exist"
    }
}

export interface FindParentIndexResult {
    found: boolean;
    parentPath?: string;
    reason?: 'claude-context-dir' | 'snapshot' | 'git-boundary' | 'none';
}

/**
 * Traverse upward from a given path to find an existing parent index.
 * Checks for .claude-context directories, indexed paths in snapshot, and git boundaries.
 * Handles errors gracefully by treating them as "not found".
 */
export function findParentIndex(
    startPath: string,
    snapshotManager: SnapshotManager
): FindParentIndexResult {
    try {
        console.log(`[PARENT-TRAVERSAL] Starting traversal from: ${startPath}`);

        // Resolve symlinks to real path
        const realPath = resolveRealPath(startPath);
        let current = realPath;

        // Traverse upward until filesystem root
        while (!isFilesystemRoot(current)) {
            console.log(`[PARENT-TRAVERSAL] Checking: ${current}`);

            // Check 1: .claude-context directory (highest priority)
            const claudeContextDir = path.join(current, '.claude-context');
            if (directoryExists(claudeContextDir)) {
                console.log(`[PARENT-TRAVERSAL] Found .claude-context at: ${current}`);
                return { found: true, parentPath: current, reason: 'claude-context-dir' };
            }

            // Check 2: Snapshot has this path indexed (use normalized comparison)
            let indexedPaths: string[] = [];
            try {
                indexedPaths = snapshotManager.getIndexedCodebases();
            } catch (error) {
                console.error(`[PARENT-TRAVERSAL] Error reading snapshot:`, error);
                // Treat as no indexed codebases, continue traversal
                indexedPaths = [];
            }

            const normalizedCurrent = normalizePathForComparison(current);
            const normalizedIndexed = indexedPaths.map(p => normalizePathForComparison(p));

            if (normalizedIndexed.includes(normalizedCurrent)) {
                console.log(`[PARENT-TRAVERSAL] Found in snapshot: ${current}`);
                return { found: true, parentPath: current, reason: 'snapshot' };
            }

            // Check 3: Git boundary + snapshot check (fallback)
            const gitDir = path.join(current, '.git');
            if (directoryExists(gitDir)) {
                console.log(`[PARENT-TRAVERSAL] Found .git at: ${current}, checking snapshot...`);
                if (normalizedIndexed.includes(normalizedCurrent)) {
                    return { found: true, parentPath: current, reason: 'git-boundary' };
                }
            }

            // Move up one directory
            const parent = path.dirname(current);

            // Safety check: prevent infinite loop
            if (parent === current) {
                console.log(`[PARENT-TRAVERSAL] Reached filesystem boundary at: ${current}`);
                break;
            }

            current = parent;
        }

        console.log(`[PARENT-TRAVERSAL] No parent index found`);
        return { found: false, reason: 'none' };
    } catch (error) {
        console.error(`[PARENT-TRAVERSAL] Error during traversal:`, error);
        // Fail gracefully - treat as "not found"
        return { found: false, reason: 'none' };
    }
} 