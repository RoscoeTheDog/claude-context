/**
 * Tree builder for index tree visualization
 * Builds directory tree structures from indexed file metadata
 */

import * as path from 'path';

/**
 * Represents a node in the directory tree
 */
export interface TreeNode {
    name: string;
    type: 'directory' | 'file';
    path: string;
    children?: TreeNode[];
    fileCount?: number;    // For directories: total files in subtree
    chunkCount?: number;   // For files: chunk count, for directories: sum of children
    extension?: string;    // For files only
}

/**
 * File metadata from vector database
 */
export interface FileInfo {
    path: string;
    extension: string;
    chunkCount: number;
}

/**
 * Options for rendering the tree
 */
export interface RenderOptions {
    depth: number;         // Maximum depth to render (-1 = unlimited)
    showFiles: boolean;    // Whether to show files or only directories
    includeStats: boolean; // Whether to include file/chunk counts
}

/**
 * Builds a tree structure from a flat list of file paths
 * @param files Array of file metadata
 * @param baseRelativePath Optional base path to use as the root name
 * @returns Root tree node
 */
export function buildTreeFromPaths(files: FileInfo[], baseRelativePath?: string): TreeNode {
    // Create root node with appropriate name
    const rootName = baseRelativePath ? baseRelativePath.replace(/\\/g, '/').replace(/\/+$/, '') : '/';
    const root: TreeNode = {
        name: rootName,
        type: 'directory',
        path: rootName,
        children: [],
        fileCount: 0,
        chunkCount: 0
    };

    // Process each file
    for (const file of files) {
        // Normalize path separators to forward slashes
        const normalizedPath = file.path.replace(/\\/g, '/');

        // Split path into components
        const parts = normalizedPath.split('/').filter(part => part.length > 0);

        if (parts.length === 0) continue; // Skip empty paths

        let current = root;

        // Traverse/create directory structure (all parts except last)
        for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i];

            // Look for existing directory node
            let dirNode = current.children?.find(
                c => c.name === dirName && c.type === 'directory'
            );

            // Create directory node if it doesn't exist
            if (!dirNode) {
                dirNode = {
                    name: dirName,
                    type: 'directory',
                    path: parts.slice(0, i + 1).join('/'),
                    children: [],
                    fileCount: 0,
                    chunkCount: 0
                };
                current.children!.push(dirNode);
            }

            current = dirNode;
        }

        // Add file node
        const fileName = parts[parts.length - 1];
        current.children!.push({
            name: fileName,
            type: 'file',
            path: normalizedPath,
            extension: file.extension,
            chunkCount: file.chunkCount
        });
    }

    return root;
}

/**
 * Calculates aggregate statistics for directory nodes
 * Performs post-order traversal to sum up file counts and chunk counts
 * @param node Tree node to calculate stats for
 */
export function calculateStats(node: TreeNode): void {
    // Base case: file nodes don't need calculation
    if (node.type === 'file') return;

    // Initialize counters
    let fileCount = 0;
    let chunkCount = 0;

    // Process each child (post-order traversal)
    for (const child of node.children || []) {
        if (child.type === 'directory') {
            // Recursively calculate stats for subdirectories first
            calculateStats(child);
            // Add subdirectory's aggregated counts
            fileCount += child.fileCount || 0;
            chunkCount += child.chunkCount || 0;
        } else {
            // File node: count the file and add its chunks
            fileCount++;
            chunkCount += child.chunkCount || 0;
        }
    }

    // Update this directory's stats
    node.fileCount = fileCount;
    node.chunkCount = chunkCount;
}

/**
 * Renders tree in visual tree format with box-drawing characters
 * @param node Root node to render
 * @param options Rendering options
 * @returns Formatted tree string
 */
export function renderTree(node: TreeNode, options: RenderOptions): string {
    // Box-drawing characters for tree structure
    const BOX_CHARS = {
        BRANCH: '├── ',
        LAST: '└── ',
        VERTICAL: '│   ',
        SPACE: '    '
    };

    function renderNode(
        node: TreeNode,
        depth: number,
        prefix: string,
        isLast: boolean
    ): string {
        // Check depth limit
        if (options.depth !== -1 && depth > options.depth) {
            return '';
        }

        let output = '';

        // Render current node
        if (depth === 0) {
            // Root node
            const stats = options.includeStats
                ? ` [${formatNumber(node.fileCount || 0)} files, ${formatNumber(node.chunkCount || 0)} chunks]`
                : '';
            output += `${node.path}${stats}\n`;
        } else if (node.type === 'directory') {
            // Directory node
            const connector = isLast ? BOX_CHARS.LAST : BOX_CHARS.BRANCH;
            const stats = options.includeStats
                ? ` [${formatNumber(node.fileCount || 0)} files, ${formatNumber(node.chunkCount || 0)} chunks]`
                : '';
            output += `${prefix}${connector}${node.name}/${stats}\n`;
        } else {
            // File node
            const connector = isLast ? BOX_CHARS.LAST : BOX_CHARS.BRANCH;
            const stats = options.includeStats
                ? ` (${node.chunkCount} chunks)`
                : '';
            output += `${prefix}${connector}${node.name}${stats}\n`;
        }

        // Render children if this is a directory
        if (node.type === 'directory' && node.children) {
            // Filter children based on showFiles option
            const children = options.showFiles
                ? node.children
                : node.children.filter(c => c.type === 'directory');

            // Sort: directories first, then files, alphabetically within each group
            const sortedChildren = [...children].sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            sortedChildren.forEach((child, index) => {
                const isLastChild = index === sortedChildren.length - 1;
                const childPrefix = depth === 0
                    ? ''
                    : prefix + (isLast ? BOX_CHARS.SPACE : BOX_CHARS.VERTICAL);

                output += renderNode(child, depth + 1, childPrefix, isLastChild);
            });
        }

        return output;
    }

    return renderNode(node, 0, '', true);
}

/**
 * Renders tree in flat list format
 * @param node Root node to render
 * @param options Rendering options
 * @returns Formatted list string
 */
export function renderList(node: TreeNode, options: RenderOptions): string {
    let output = '';

    function renderNode(node: TreeNode, depth: number, parentPath: string): void {
        // Check depth limit
        if (options.depth !== -1 && depth > options.depth) {
            return;
        }

        // Build full path for this node
        const fullPath = depth === 0 ? node.path : `${parentPath}/${node.name}`;

        // Render current node
        if (node.type === 'directory') {
            const stats = options.includeStats
                ? ` - ${formatNumber(node.fileCount || 0)} files, ${formatNumber(node.chunkCount || 0)} chunks`
                : '';
            output += `${fullPath}/${stats}\n`;
        } else if (options.showFiles) {
            // File node
            const stats = options.includeStats
                ? ` - ${node.chunkCount} chunks`
                : '';
            output += `${fullPath}${stats}\n`;
        }

        // Render children if this is a directory
        if (node.type === 'directory' && node.children) {
            // Filter children based on showFiles option
            const children = options.showFiles
                ? node.children
                : node.children.filter(c => c.type === 'directory');

            // Sort: directories first, then files, alphabetically within each group
            const sortedChildren = [...children].sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            sortedChildren.forEach(child => {
                renderNode(child, depth + 1, fullPath);
            });
        }
    }

    renderNode(node, 0, '');
    return output;
}

/**
 * Formats a number with K/M suffixes for readability
 * @param num Number to format
 * @returns Formatted string (e.g., "1.2K", "9.0M")
 */
export function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}
