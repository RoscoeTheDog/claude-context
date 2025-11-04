import { describe, it, expect } from 'vitest';
import {
    buildTreeFromPaths,
    calculateStats,
    renderTree,
    renderList,
    formatNumber,
    type FileInfo,
    type TreeNode,
    type RenderOptions
} from '../tree-builder.js';

/**
 * Tests for Index Tree Builder
 * Phase 1 - MVP Implementation
 */

describe('TreeBuilder', () => {
    describe('buildTreeFromPaths', () => {
        it('should build tree from empty array', () => {
            const files: FileInfo[] = [];
            const tree = buildTreeFromPaths(files);

            expect(tree.name).toBe('/');
            expect(tree.type).toBe('directory');
            expect(tree.children).toEqual([]);
        });

        it('should build tree with single file', () => {
            const files: FileInfo[] = [
                { path: 'index.ts', extension: '.ts', chunkCount: 5 }
            ];
            const tree = buildTreeFromPaths(files);

            expect(tree.children).toHaveLength(1);
            expect(tree.children![0].name).toBe('index.ts');
            expect(tree.children![0].type).toBe('file');
            expect(tree.children![0].chunkCount).toBe(5);
        });

        it('should build tree with nested directories', () => {
            const files: FileInfo[] = [
                { path: 'src/index.ts', extension: '.ts', chunkCount: 5 },
                { path: 'src/utils/date.ts', extension: '.ts', chunkCount: 3 }
            ];
            const tree = buildTreeFromPaths(files);

            expect(tree.children).toHaveLength(1);
            expect(tree.children![0].name).toBe('src');
            expect(tree.children![0].type).toBe('directory');

            const srcDir = tree.children![0];
            expect(srcDir.children).toHaveLength(2); // index.ts and utils/

            const utilsDir = srcDir.children!.find(c => c.name === 'utils');
            expect(utilsDir).toBeDefined();
            expect(utilsDir!.type).toBe('directory');
            expect(utilsDir!.children).toHaveLength(1);
            expect(utilsDir!.children![0].name).toBe('date.ts');
        });

        it('should handle multiple files in same directory', () => {
            const files: FileInfo[] = [
                { path: 'src/index.ts', extension: '.ts', chunkCount: 5 },
                { path: 'src/app.ts', extension: '.ts', chunkCount: 3 },
                { path: 'src/config.ts', extension: '.ts', chunkCount: 2 }
            ];
            const tree = buildTreeFromPaths(files);

            const srcDir = tree.children![0];
            expect(srcDir.children).toHaveLength(3);
            expect(srcDir.children!.map(c => c.name)).toEqual(['index.ts', 'app.ts', 'config.ts']);
        });

        it('should normalize Windows path separators', () => {
            const files: FileInfo[] = [
                { path: 'src\\utils\\date.ts', extension: '.ts', chunkCount: 3 }
            ];
            const tree = buildTreeFromPaths(files);

            // Should still build proper tree structure
            expect(tree.children).toHaveLength(1);
            expect(tree.children![0].name).toBe('src');
            expect(tree.children![0].children![0].name).toBe('utils');
        });

        it('should use baseRelativePath as root name when provided', () => {
            const files: FileInfo[] = [
                { path: 'components/Button.tsx', extension: '.tsx', chunkCount: 5 },
                { path: 'components/Modal.tsx', extension: '.tsx', chunkCount: 3 }
            ];
            const tree = buildTreeFromPaths(files, 'src/components');

            expect(tree.name).toBe('src/components');
            expect(tree.path).toBe('src/components');
            expect(tree.type).toBe('directory');
        });

        it('should handle relative path filtering with subdirectories', () => {
            const files: FileInfo[] = [
                { path: 'ui/Button.tsx', extension: '.tsx', chunkCount: 12 },
                { path: 'ui/Modal.tsx', extension: '.tsx', chunkCount: 8 },
                { path: 'layout/Header.tsx', extension: '.tsx', chunkCount: 15 }
            ];
            const tree = buildTreeFromPaths(files, 'src/components');

            // Tree structure should start from the filtered subdirectory
            expect(tree.name).toBe('src/components');
            expect(tree.children).toHaveLength(2); // ui/ and layout/

            const uiDir = tree.children!.find(c => c.name === 'ui');
            expect(uiDir).toBeDefined();
            expect(uiDir!.children).toHaveLength(2);
        });

        it('should handle trailing slashes in baseRelativePath', () => {
            const files: FileInfo[] = [
                { path: 'index.ts', extension: '.ts', chunkCount: 5 }
            ];
            const tree = buildTreeFromPaths(files, 'src/');

            expect(tree.name).toBe('src');
            expect(tree.path).toBe('src');
        });

        it('should handle Windows backslashes in baseRelativePath', () => {
            const files: FileInfo[] = [
                { path: 'index.ts', extension: '.ts', chunkCount: 5 }
            ];
            const tree = buildTreeFromPaths(files, 'src\\components');

            expect(tree.name).toBe('src/components');
            expect(tree.path).toBe('src/components');
        });
    });

    describe('calculateStats', () => {
        it('should not modify file nodes', () => {
            const file: TreeNode = {
                name: 'test.ts',
                type: 'file',
                path: 'test.ts',
                chunkCount: 5
            };

            calculateStats(file);
            expect(file.chunkCount).toBe(5);
        });

        it('should calculate stats for directory with files', () => {
            const dir: TreeNode = {
                name: 'src',
                type: 'directory',
                path: 'src',
                children: [
                    { name: 'a.ts', type: 'file', path: 'src/a.ts', chunkCount: 5 },
                    { name: 'b.ts', type: 'file', path: 'src/b.ts', chunkCount: 3 }
                ]
            };

            calculateStats(dir);
            expect(dir.fileCount).toBe(2);
            expect(dir.chunkCount).toBe(8);
        });

        it('should calculate aggregate stats for nested directories', () => {
            const root: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            { name: 'index.ts', type: 'file', path: 'src/index.ts', chunkCount: 5 },
                            {
                                name: 'utils',
                                type: 'directory',
                                path: 'src/utils',
                                children: [
                                    { name: 'date.ts', type: 'file', path: 'src/utils/date.ts', chunkCount: 3 },
                                    { name: 'string.ts', type: 'file', path: 'src/utils/string.ts', chunkCount: 2 }
                                ]
                            }
                        ]
                    }
                ]
            };

            calculateStats(root);

            // Check utils directory stats
            const srcDir = root.children![0];
            const utilsDir = srcDir.children!.find(c => c.name === 'utils')!;
            expect(utilsDir.fileCount).toBe(2);
            expect(utilsDir.chunkCount).toBe(5);

            // Check src directory stats (should include utils)
            expect(srcDir.fileCount).toBe(3); // 1 in src + 2 in utils
            expect(srcDir.chunkCount).toBe(10); // 5 + 3 + 2

            // Check root stats
            expect(root.fileCount).toBe(3);
            expect(root.chunkCount).toBe(10);
        });
    });

    describe('renderTree', () => {
        it('should render basic tree structure', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    { name: 'index.ts', type: 'file', path: 'index.ts', chunkCount: 5 }
                ],
                fileCount: 1,
                chunkCount: 5
            };

            const options: RenderOptions = { depth: 3, showFiles: true, includeStats: true };
            const output = renderTree(tree, options);

            expect(output).toContain('/');
            expect(output).toContain('index.ts');
            expect(output).toContain('5 chunks');
        });

        it('should respect depth limit', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            {
                                name: 'utils',
                                type: 'directory',
                                path: 'src/utils',
                                children: [
                                    {
                                        name: 'helpers',
                                        type: 'directory',
                                        path: 'src/utils/helpers',
                                        children: [
                                            { name: 'deep.ts', type: 'file', path: 'src/utils/helpers/deep.ts', chunkCount: 1 }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            const options: RenderOptions = { depth: 2, showFiles: true, includeStats: false };
            const output = renderTree(tree, options);

            expect(output).toContain('src');
            expect(output).toContain('utils');
            expect(output).not.toContain('helpers'); // Depth 3, should be cut off
            expect(output).not.toContain('deep.ts');
        });

        it('should hide files when showFiles is false', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            { name: 'index.ts', type: 'file', path: 'src/index.ts', chunkCount: 5 },
                            { name: 'app.ts', type: 'file', path: 'src/app.ts', chunkCount: 3 }
                        ]
                    }
                ]
            };

            const options: RenderOptions = { depth: 3, showFiles: false, includeStats: false };
            const output = renderTree(tree, options);

            expect(output).toContain('src');
            expect(output).not.toContain('index.ts');
            expect(output).not.toContain('app.ts');
        });

        it('should hide stats when includeStats is false', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    { name: 'index.ts', type: 'file', path: 'index.ts', chunkCount: 5 }
                ],
                fileCount: 1,
                chunkCount: 5
            };

            const options: RenderOptions = { depth: 3, showFiles: true, includeStats: false };
            const output = renderTree(tree, options);

            expect(output).toContain('/');
            expect(output).toContain('index.ts');
            expect(output).not.toContain('chunks');
            expect(output).not.toContain('files');
        });

        it('should use box-drawing characters', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            { name: 'a.ts', type: 'file', path: 'src/a.ts', chunkCount: 1 },
                            { name: 'b.ts', type: 'file', path: 'src/b.ts', chunkCount: 1 }
                        ]
                    }
                ]
            };

            const options: RenderOptions = { depth: 3, showFiles: true, includeStats: false };
            const output = renderTree(tree, options);

            // Should contain tree characters
            expect(output).toMatch(/[├└]/); // Branch or last
            expect(output).toContain('──'); // Connector
        });
    });

    describe('renderList', () => {
        it('should render basic list structure', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    { name: 'index.ts', type: 'file', path: 'index.ts', chunkCount: 5 }
                ],
                fileCount: 1,
                chunkCount: 5
            };

            const options: RenderOptions = { depth: 3, showFiles: true, includeStats: true };
            const output = renderList(tree, options);

            expect(output).toContain('//');
            expect(output).toContain('/index.ts');
            expect(output).toContain('5 chunks');
        });

        it('should render nested directories in list format', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            { name: 'index.ts', type: 'file', path: 'src/index.ts', chunkCount: 5 },
                            {
                                name: 'utils',
                                type: 'directory',
                                path: 'src/utils',
                                children: [
                                    { name: 'date.ts', type: 'file', path: 'src/utils/date.ts', chunkCount: 3 }
                                ],
                                fileCount: 1,
                                chunkCount: 3
                            }
                        ],
                        fileCount: 2,
                        chunkCount: 8
                    }
                ],
                fileCount: 2,
                chunkCount: 8
            };

            const options: RenderOptions = { depth: -1, showFiles: true, includeStats: true };
            const output = renderList(tree, options);

            expect(output).toContain('//');
            expect(output).toContain('/src/');
            expect(output).toContain('/src/index.ts');
            expect(output).toContain('/src/utils/');
            expect(output).toContain('/src/utils/date.ts');
        });

        it('should respect depth limit in list format', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            {
                                name: 'utils',
                                type: 'directory',
                                path: 'src/utils',
                                children: [
                                    { name: 'deep.ts', type: 'file', path: 'src/utils/deep.ts', chunkCount: 1 }
                                ]
                            }
                        ]
                    }
                ]
            };

            const options: RenderOptions = { depth: 1, showFiles: true, includeStats: false };
            const output = renderList(tree, options);

            expect(output).toContain('/src/');
            expect(output).not.toContain('/src/utils/');
            expect(output).not.toContain('deep.ts');
        });

        it('should hide files when showFiles is false in list format', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    {
                        name: 'src',
                        type: 'directory',
                        path: 'src',
                        children: [
                            { name: 'index.ts', type: 'file', path: 'src/index.ts', chunkCount: 5 }
                        ]
                    }
                ]
            };

            const options: RenderOptions = { depth: 3, showFiles: false, includeStats: false };
            const output = renderList(tree, options);

            expect(output).toContain('/src/');
            expect(output).not.toContain('index.ts');
        });

        it('should hide stats when includeStats is false in list format', () => {
            const tree: TreeNode = {
                name: '/',
                type: 'directory',
                path: '/',
                children: [
                    { name: 'index.ts', type: 'file', path: 'index.ts', chunkCount: 5 }
                ],
                fileCount: 1,
                chunkCount: 5
            };

            const options: RenderOptions = { depth: 3, showFiles: true, includeStats: false };
            const output = renderList(tree, options);

            expect(output).toContain('//');
            expect(output).toContain('/index.ts');
            expect(output).not.toContain('chunks');
            expect(output).not.toContain('files');
        });
    });

    describe('formatNumber', () => {
        it('should format numbers less than 1000 as-is', () => {
            expect(formatNumber(0)).toBe('0');
            expect(formatNumber(1)).toBe('1');
            expect(formatNumber(999)).toBe('999');
        });

        it('should format thousands with K suffix', () => {
            expect(formatNumber(1000)).toBe('1.0K');
            expect(formatNumber(1500)).toBe('1.5K');
            expect(formatNumber(12345)).toBe('12.3K');
        });

        it('should format millions with M suffix', () => {
            expect(formatNumber(1000000)).toBe('1.0M');
            expect(formatNumber(2500000)).toBe('2.5M');
            expect(formatNumber(12345678)).toBe('12.3M');
        });
    });
});
