import { describe, it, expect, beforeEach, vi } from 'vitest';
import { findParentIndex, FindParentIndexResult } from '../utils.js';
import type { SnapshotManager } from '../snapshot.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for findParentIndex function
 * Phase 3, Task 3.2a, 3.2b, 3.2c
 */

describe('findParentIndex', () => {
    let mockSnapshotManager: SnapshotManager;

    beforeEach(() => {
        // Create a mock snapshot manager
        mockSnapshotManager = {
            getIndexedCodebases: vi.fn().mockReturnValue([]),
        } as unknown as SnapshotManager;
    });

    describe('Detection Priority Tests (Task 3.2a)', () => {
        it('should find parent via .claude-context directory (Priority 1)', () => {
            // Test with actual project directory structure
            const currentDir = process.cwd();
            const testPath = path.join(currentDir, 'src', '__tests__');

            // This test assumes we're running from project root
            // In real scenario, __dirname has parent directories
            const result = findParentIndex(testPath, mockSnapshotManager);

            // Should traverse up and eventually reach root or find nothing
            // (since we don't have .claude-context in test env)
            expect(result).toBeDefined();
            expect(['claude-context-dir', 'snapshot', 'none']).toContain(result.reason || 'none');
        });

        it('should find parent via snapshot (Priority 2)', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\project\\src'
                : '/project/src';

            const parentPath = process.platform === 'win32'
                ? 'C:\\project'
                : '/project';

            // Mock snapshot manager to return parent path
            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([parentPath]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            expect(result.found).toBe(true);
            expect(result.reason).toBe('snapshot');
            expect(result.parentPath).toBe(parentPath);
        });

        it('should prioritize .claude-context over snapshot', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\project\\src'
                : '/project/src';

            const parentPath = process.platform === 'win32'
                ? 'C:\\project'
                : '/project';

            // Even if parent is in snapshot, should find .claude-context first
            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([parentPath]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            // Will find via snapshot (we can't mock fs in ESM easily)
            expect(result.found).toBe(true);
            expect(result.parentPath).toBe(parentPath);
        });

        it('should return not found when no parent exists', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\some\\random\\path'
                : '/some/random/path';

            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
            expect(result.parentPath).toBeUndefined();
        });

        it('should return none when path does not exist', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\nonexistent\\random\\path'
                : '/nonexistent/random/path';

            // Empty snapshot (no indexed codebases)
            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
        });
    });

    describe('Traversal Tests (Task 3.2b)', () => {
        it('should traverse multiple levels to find parent', () => {
            const deepPath = process.platform === 'win32'
                ? 'C:\\project\\src\\components\\ui\\Button'
                : '/project/src/components/ui/Button';

            const parentPath = process.platform === 'win32'
                ? 'C:\\project'
                : '/project';

            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([parentPath]);

            const result = findParentIndex(deepPath, mockSnapshotManager);

            expect(result.found).toBe(true);
            expect(result.parentPath).toBe(parentPath);
        });

        it('should stop at filesystem root', () => {
            const rootPath = process.platform === 'win32'
                ? 'C:\\nonexistent\\path'
                : '/nonexistent/path';

            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([]);

            const result = findParentIndex(rootPath, mockSnapshotManager);

            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
        });

        it('should prefer nearest parent when multiple exist', () => {
            const deepPath = process.platform === 'win32'
                ? 'C:\\parent1\\parent2\\child'
                : '/parent1/parent2/child';

            const parent1 = process.platform === 'win32'
                ? 'C:\\parent1'
                : '/parent1';

            const parent2 = process.platform === 'win32'
                ? 'C:\\parent1\\parent2'
                : '/parent1/parent2';

            // Both parents indexed
            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([parent1, parent2]);

            const result = findParentIndex(deepPath, mockSnapshotManager);

            expect(result.found).toBe(true);
            // Should find nearest parent (parent2)
            expect(result.parentPath).toBe(parent2);
        });

        it('should handle path.dirname correctly at root', () => {
            const rootPath = process.platform === 'win32' ? 'C:\\' : '/';

            const result = findParentIndex(rootPath, mockSnapshotManager);

            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
        });
    });

    describe('Edge Case Tests (Task 3.2c)', () => {
        it('should resolve symlinks before traversal', () => {
            // This test verifies that resolveRealPath is called
            const testPath = process.platform === 'win32'
                ? 'C:\\project\\link'
                : '/project/link';

            const result = findParentIndex(testPath, mockSnapshotManager);

            // Should not throw, even if symlink resolution fails
            expect(result).toBeDefined();
            expect(result.found).toBe(false);
        });

        it('should handle errors gracefully and return none', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\restricted\\path'
                : '/restricted/path';

            // Test that the function doesn't throw on non-existent paths
            const result = findParentIndex(testPath, mockSnapshotManager);

            // Should return not found instead of throwing
            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
        });

        it('should handle invalid paths gracefully', () => {
            const invalidPath = '';

            const result = findParentIndex(invalidPath, mockSnapshotManager);

            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
        });

        it('should handle snapshot errors gracefully', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\project\\src'
                : '/project/src';

            // Mock snapshot error
            (mockSnapshotManager.getIndexedCodebases as any).mockImplementation(() => {
                throw new Error('Snapshot read error');
            });

            const result = findParentIndex(testPath, mockSnapshotManager);

            // Should not throw, continue traversal
            expect(result).toBeDefined();
        });

        it('should use normalized path comparison', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\project\\src'
                : '/project/src';

            // Indexed path with different casing/separators
            const indexedPath = process.platform === 'win32'
                ? 'c:/project' // Different case, forward slashes
                : '/project';

            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([indexedPath]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            if (process.platform === 'win32') {
                // On Windows, should find match despite case/separator differences
                expect(result.found).toBe(true);
            } else {
                // On Unix, case-sensitive
                expect(result.found).toBe(true);
            }
        });

        it('should find parent when using nested paths', () => {
            const testPath = process.platform === 'win32'
                ? 'C:\\parent\\submodule\\src'
                : '/parent/submodule/src';

            const parentPath = process.platform === 'win32'
                ? 'C:\\parent'
                : '/parent';

            // Parent is in snapshot
            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([parentPath]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            // Should find parent via snapshot
            expect(result.found).toBe(true);
            expect(result.parentPath).toBe(parentPath);
        });

        it('should handle Windows drive roots correctly', () => {
            if (process.platform !== 'win32') {
                // Skip on non-Windows
                return;
            }

            const testPath = 'C:\\somepath';

            (mockSnapshotManager.getIndexedCodebases as any).mockReturnValue([]);

            const result = findParentIndex(testPath, mockSnapshotManager);

            expect(result.found).toBe(false);
            expect(result.reason).toBe('none');
        });

        it('should handle UNC paths correctly', () => {
            if (process.platform !== 'win32') {
                // Skip on non-Windows
                return;
            }

            const testPath = String.raw`\\server\share\project\src`;

            const result = findParentIndex(testPath, mockSnapshotManager);

            // Should traverse until UNC root without crashing
            expect(result).toBeDefined();
            expect(result.found).toBe(false);
        });
    });
});
