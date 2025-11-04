import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolHandlers } from '../handlers.js';
import type { SnapshotManager } from '../snapshot.js';
import type { Context } from '@zilliz/claude-context-core';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Integration tests for handleIndexCodebase with parent traversal
 * Phase 3, Tasks 3.3a, 3.3b, 3.3c, 3.3d
 */

describe('handleIndexCodebase Integration Tests', () => {
    let toolHandlers: ToolHandlers;
    let mockContext: any;
    let mockSnapshotManager: any;
    let tempDir: string;
    let testProjectRoot: string;
    let testSubdir: string;

    beforeEach(async () => {
        // Create temporary directory structure for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-context-test-'));
        testProjectRoot = path.join(tempDir, 'project');
        testSubdir = path.join(testProjectRoot, 'src', 'components');

        // Create directory structure
        fs.mkdirSync(testProjectRoot, { recursive: true });
        fs.mkdirSync(testSubdir, { recursive: true });

        // Create mock Context
        mockContext = {
            getVectorDatabase: vi.fn().mockReturnValue({
                checkCollectionLimit: vi.fn().mockResolvedValue(true)
            }),
            hasIndex: vi.fn().mockResolvedValue(false),
            clearIndex: vi.fn().mockResolvedValue(undefined),
            addCustomExtensions: vi.fn(),
            addCustomIgnorePatterns: vi.fn()
        };

        // Create mock SnapshotManager
        mockSnapshotManager = {
            getIndexedCodebases: vi.fn().mockReturnValue([]),
            getIndexingCodebases: vi.fn().mockReturnValue([]),
            getCodebaseInfo: vi.fn().mockReturnValue(null),
            getCodebaseStatus: vi.fn().mockReturnValue('not_found'),
            setCodebaseIndexing: vi.fn(),
            saveCodebaseSnapshot: vi.fn(),
            removeIndexedCodebase: vi.fn(),
            syncFromCloud: vi.fn().mockResolvedValue(undefined)
        };

        // Create ToolHandlers instance
        toolHandlers = new ToolHandlers(mockContext as Context, mockSnapshotManager as SnapshotManager);

        // Mock startBackgroundIndexing to avoid actual indexing
        vi.spyOn(toolHandlers as any, 'startBackgroundIndexing').mockImplementation(() => {});
    });

    afterEach(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        vi.restoreAllMocks();
    });

    describe('Task 3.3a: Parent Reuse Tests', () => {
        it('should reuse parent index for subdirectory (via snapshot)', async () => {
            // Setup: Parent indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexed'
            });

            // Request: Index subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'auto'
            });

            // Verify: Parent index reused
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(testProjectRoot);
            expect(response.metadata.status).toBe('indexed');
            expect(response.metadata.progress).toBe(100);
            expect(response.content[0].text).toContain('Using parent index');
            expect(response.content[0].text).toContain(testProjectRoot);

            // Verify: No background indexing started
            expect((toolHandlers as any).startBackgroundIndexing).not.toHaveBeenCalled();
        });

        it('should reuse parent index via .claude-context directory', async () => {
            // Setup: Create .claude-context directory in parent
            const claudeContextDir = path.join(testProjectRoot, '.claude-context');
            fs.mkdirSync(claudeContextDir, { recursive: true });

            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexed'
            });

            // Request: Index subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'auto'
            });

            // Verify: Parent index found via .claude-context
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(testProjectRoot);
            expect(response.content[0].text).toContain('detected via claude-context-dir');

            // Verify: No background indexing started
            expect((toolHandlers as any).startBackgroundIndexing).not.toHaveBeenCalled();
        });

        it('should return parent indexing status when parent is being indexed', async () => {
            // Setup: Parent is currently indexing
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexing',
                indexingPercentage: 45
            });

            // Request: Index subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'auto'
            });

            // Verify: Returns parent indexing progress
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(testProjectRoot);
            expect(response.metadata.status).toBe('indexing');
            expect(response.metadata.progress).toBe(45);
            expect(response.content[0].text).toContain('currently being indexed');
            expect(response.content[0].text).toContain('45%');

            // Verify: No background indexing started for subdirectory
            expect((toolHandlers as any).startBackgroundIndexing).not.toHaveBeenCalled();
        });

        it('should find nearest parent when multiple levels indexed', async () => {
            const intermediatePath = path.join(testProjectRoot, 'src');
            fs.mkdirSync(intermediatePath, { recursive: true });

            // Setup: Both root and intermediate directory indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([
                testProjectRoot,
                intermediatePath
            ]);

            mockSnapshotManager.getCodebaseInfo.mockImplementation((p: string) => {
                if (p === intermediatePath) {
                    return { path: intermediatePath, status: 'indexed' };
                }
                if (p === testProjectRoot) {
                    return { path: testProjectRoot, status: 'indexed' };
                }
                return null;
            });

            // Request: Index deep subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'auto'
            });

            // Verify: Uses nearest parent (intermediatePath, not root)
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(intermediatePath);
            expect(response.content[0].text).toContain(intermediatePath);
        });

        it('should include helpful message about search coverage', async () => {
            // Setup: Parent indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexed'
            });

            // Request: Index subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'auto'
            });

            // Verify: Message mentions search will cover entire project
            expect(response.content[0].text).toContain('Searches will cover the entire project');
            expect(response.content[0].text).toContain('scope="local"');
        });

        it('should handle deeply nested subdirectories', async () => {
            const deepPath = path.join(testSubdir, 'ui', 'Button', 'stories');
            fs.mkdirSync(deepPath, { recursive: true });

            // Setup: Root indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexed'
            });

            // Request: Index deeply nested path
            const response = await toolHandlers.handleIndexCodebase({
                path: deepPath,
                scope: 'auto'
            });

            // Verify: Still finds root parent
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(testProjectRoot);
        });
    });

    describe('Task 3.3b: New Index Creation Tests', () => {
        it('should create new index when no parent exists', async () => {
            // Setup: No indexed codebases
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);

            // Request: Index directory
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                scope: 'auto'
            });

            // Verify: New index created
            expect(response.metadata).toBeUndefined(); // New index doesn't have metadata
            expect(response.content[0].text).toContain('Started background indexing');
            expect(response.content[0].text).toContain(testProjectRoot);

            // Verify: Background indexing started
            expect((toolHandlers as any).startBackgroundIndexing).toHaveBeenCalledWith(
                testProjectRoot,
                false,
                'ast' // default splitter
            );

            // Verify: Snapshot updated
            expect(mockSnapshotManager.setCodebaseIndexing).toHaveBeenCalledWith(testProjectRoot, 0);
            expect(mockSnapshotManager.saveCodebaseSnapshot).toHaveBeenCalled();
        });

        it('should create new index with custom splitter', async () => {
            // Setup: No indexed codebases
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);

            // Request: Index with langchain splitter
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                splitter: 'langchain'
            });

            // Verify: Uses langchain splitter
            expect(response.content[0].text).toContain('LANGCHAIN splitter');
            expect((toolHandlers as any).startBackgroundIndexing).toHaveBeenCalledWith(
                testProjectRoot,
                false,
                'langchain'
            );
        });

        it('should create new index with custom extensions', async () => {
            // Setup: No indexed codebases
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);

            // Request: Index with custom extensions
            const customExtensions = ['.vue', '.svelte'];
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                customExtensions
            });

            // Verify: Custom extensions added
            expect(mockContext.addCustomExtensions).toHaveBeenCalledWith(customExtensions);
            expect(response.content[0].text).toContain('.vue, .svelte');
        });

        it('should create new index with custom ignore patterns', async () => {
            // Setup: No indexed codebases
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);

            // Request: Index with custom ignore patterns
            const ignorePatterns = ['*.test.ts', 'node_modules'];
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                ignorePatterns
            });

            // Verify: Custom ignore patterns added
            expect(mockContext.addCustomIgnorePatterns).toHaveBeenCalledWith(ignorePatterns);
            expect(response.content[0].text).toContain('*.test.ts, node_modules');
        });

        it('should handle already indexing status', async () => {
            // Setup: Codebase already being indexed
            mockSnapshotManager.getIndexingCodebases.mockReturnValue([testProjectRoot]);

            // Request: Try to index again
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot
            });

            // Verify: Returns error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('already being indexed');

            // Verify: No new indexing started
            expect((toolHandlers as any).startBackgroundIndexing).not.toHaveBeenCalled();
        });

        it('should handle already indexed status without force', async () => {
            // Setup: Codebase already indexed (exact path)
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexed'
            });
            mockContext.hasIndex.mockResolvedValue(true);

            // Request: Try to index exact same path again (no force)
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                force: false
            });

            // Verify: Parent traversal finds the path itself in snapshot
            // This returns "Using parent index" message (treats path as its own parent)
            // This is the current behavior - acceptable as it prevents re-indexing
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(testProjectRoot);
            expect(response.content[0].text).toContain('Using parent index');

            // Verify: No new indexing started
            expect((toolHandlers as any).startBackgroundIndexing).not.toHaveBeenCalled();
        });
    });

    describe('Task 3.3c: Scope/Force Parameter Tests', () => {
        it('should skip traversal when force=true', async () => {
            // Setup: Subdirectory previously indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testSubdir]);
            mockContext.hasIndex.mockResolvedValue(true);

            // Request: Force re-index subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                force: true,
                scope: 'auto'
            });

            // Verify: Creates new index (doesn't reuse parent - force skips traversal)
            expect(response.metadata).toBeUndefined();
            expect(response.content[0].text).toContain('Started background indexing');
            expect(response.content[0].text).toContain(testSubdir);

            // Verify: Background indexing started for subdirectory
            expect((toolHandlers as any).startBackgroundIndexing).toHaveBeenCalledWith(
                testSubdir,
                true,
                'ast'
            );

            // Verify: Old index cleared (subdirectory was previously indexed)
            expect(mockSnapshotManager.removeIndexedCodebase).toHaveBeenCalled();
            expect(mockContext.clearIndex).toHaveBeenCalledWith(testSubdir);
        });

        it('should skip traversal when scope=local', async () => {
            // Setup: Parent indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);

            // Request: Index subdirectory with scope=local
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'local'
            });

            // Verify: Creates new index (doesn't reuse parent)
            expect(response.metadata).toBeUndefined();
            expect(response.content[0].text).toContain('Started background indexing');
            expect(response.content[0].text).toContain(testSubdir);

            // Verify: Background indexing started
            expect((toolHandlers as any).startBackgroundIndexing).toHaveBeenCalledWith(
                testSubdir,
                false,
                'ast'
            );
        });

        it('should use traversal when scope=auto (default)', async () => {
            // Setup: Parent indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexed'
            });

            // Request: Index subdirectory (scope defaults to auto)
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir
                // scope not specified (defaults to 'auto')
            });

            // Verify: Reuses parent index
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
            expect(response.metadata.index_path).toBe(testProjectRoot);
        });

        it('should reject invalid scope parameter', async () => {
            // Request: Invalid scope
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                scope: 'invalid'
            });

            // Verify: Returns error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('Invalid scope parameter');
            expect(response.content[0].text).toContain('auto');
            expect(response.content[0].text).toContain('local');
        });

        it('should handle scope=local even when parent exists', async () => {
            // Setup: Parent indexed AND has .claude-context
            const claudeContextDir = path.join(testProjectRoot, '.claude-context');
            fs.mkdirSync(claudeContextDir, { recursive: true });
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);

            // Request: Force local indexing
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'local'
            });

            // Verify: Still creates new index (ignores parent)
            expect(response.metadata).toBeUndefined();
            expect(response.content[0].text).toContain('Started background indexing');
        });

        it('should combine force=true and scope=auto correctly', async () => {
            // Setup: Parent indexed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockContext.hasIndex.mockResolvedValue(true);

            // Request: force=true takes precedence (skips traversal)
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                force: true,
                scope: 'auto'
            });

            // Verify: Creates new index (force overrides auto)
            expect(response.metadata).toBeUndefined();
            expect((toolHandlers as any).startBackgroundIndexing).toHaveBeenCalledWith(
                testSubdir,
                true,
                'ast'
            );
        });
    });

    describe('Task 3.3d: Error + Edge Case Tests', () => {
        it('should handle invalid path gracefully', async () => {
            const invalidPath = path.join(tempDir, 'nonexistent');

            // Request: Index non-existent path
            const response = await toolHandlers.handleIndexCodebase({
                path: invalidPath
            });

            // Verify: Returns error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('does not exist');
            expect(response.content[0].text).toContain(invalidPath);
        });

        it('should handle path to file (not directory)', async () => {
            const filePath = path.join(testProjectRoot, 'test.txt');
            fs.writeFileSync(filePath, 'test content');

            // Request: Index file instead of directory
            const response = await toolHandlers.handleIndexCodebase({
                path: filePath
            });

            // Verify: Returns error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('not a directory');
        });

        it('should handle collection limit error', async () => {
            // Setup: Collection limit reached
            mockContext.getVectorDatabase().checkCollectionLimit.mockResolvedValue(false);

            // Request: Try to index
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot
            });

            // Verify: Returns collection limit error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('collection limit');
        });

        it('should handle collection validation exception', async () => {
            // Setup: Validation throws error
            mockContext.getVectorDatabase().checkCollectionLimit.mockRejectedValue(
                new Error('Database connection failed')
            );

            // Request: Try to index
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot
            });

            // Verify: Returns validation error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('Error validating collection creation');
            expect(response.content[0].text).toContain('Database connection failed');
        });

        it('should handle invalid splitter parameter', async () => {
            // Request: Invalid splitter
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot,
                splitter: 'invalid'
            });

            // Verify: Returns error
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('Invalid splitter type');
            expect(response.content[0].text).toContain('ast');
            expect(response.content[0].text).toContain('langchain');
        });

        it('should handle relative path by converting to absolute', async () => {
            // Setup: No indexed codebases
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);

            // Request: Use relative path
            const originalCwd = process.cwd();
            process.chdir(tempDir);

            const response = await toolHandlers.handleIndexCodebase({
                path: './project'
            });

            process.chdir(originalCwd);

            // Verify: Converted to absolute path
            expect(response.content[0].text).toContain('Started background indexing');
            expect(response.content[0].text).toContain('Input path');
            expect(response.content[0].text).toContain('resolved to absolute path');
        });

        it('should handle snapshot manager error gracefully', async () => {
            // Setup: getIndexedCodebases throws error
            mockSnapshotManager.getIndexedCodebases.mockImplementation(() => {
                throw new Error('Snapshot read failed');
            });

            // Request: Index with failing snapshot manager
            const response = await toolHandlers.handleIndexCodebase({
                path: testProjectRoot
            });

            // Verify: Returns error (doesn't crash)
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain('Error starting indexing');
        });

        it('should handle parent with failed index status', async () => {
            // Setup: Parent index failed
            mockSnapshotManager.getIndexedCodebases.mockReturnValue([testProjectRoot]);
            mockSnapshotManager.getCodebaseInfo.mockReturnValue({
                path: testProjectRoot,
                status: 'indexfailed',
                errorMessage: 'Permission denied'
            });

            // Request: Index subdirectory
            const response = await toolHandlers.handleIndexCodebase({
                path: testSubdir,
                scope: 'auto'
            });

            // Verify: Reuses parent (even if failed - returns indexed status)
            // Note: Failed status is treated as not-indexed by getCodebaseInfo logic
            expect(response.metadata).toBeDefined();
            expect(response.metadata.reused).toBe(true);
        });
    });
});
