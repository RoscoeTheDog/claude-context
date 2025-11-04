# Feature Proposal: Index Tree Viewer

**Feature**: Add MCP tool to retrieve indexed directory tree structure
**Version Target**: 0.3.0
**Priority**: Medium
**Status**: PROPOSAL
**Created**: 2025-11-03

---

## 📋 Problem Statement

### Current Limitations

When agents search for code using Claude Context (CC) or Serena and don't find results, they resort to bash commands like `ls`, `find`, or `tree` to explore the directory structure. This has several inefficiencies:

**Token Inefficiency:**
```bash
# Agent has to make multiple tool calls
> ls src/
> ls src/components/
> ls src/utils/
> find src -type f -name "*.ts"
# Each call: ~50-100 tokens, multiple rounds needed
```

**Lack of Context:**
- Bash tools don't know what's actually **indexed**
- Agent might explore directories that aren't even in the index
- No indication of file types, sizes, or chunk distribution

**Use Cases Not Served:**
1. **Initial exploration**: "What does this codebase contain?"
2. **Search refinement**: "No results found, where should I look?"
3. **Debugging**: "Is this file even indexed?"
4. **Architecture understanding**: "What's the structure of this project?"

### Opportunity

CC already has all the metadata needed to build a directory tree:
- Every chunk stores `relativePath`
- File extensions are tracked
- We know which files are indexed (and which aren't)

---

## 💡 Proposed Solution

Add a new MCP tool: **`get_index_tree`**

### Tool Signature

```typescript
interface GetIndexTreeArgs {
    path: string;              // Absolute path to indexed codebase
    relative_path?: string;    // Optional: Show tree starting from this subdirectory (e.g., "src/components")
    depth?: number;            // Max depth to show (default: 3, -1 = unlimited)
    show_files?: boolean;      // Show files or just directories (default: true)
    format?: 'tree' | 'list';  // Output format (default: 'tree')
    include_stats?: boolean;   // Include file/chunk counts (default: true)
}
```

### Example Usage

```typescript
// Basic usage - show entire tree structure
await get_index_tree({
    path: "/project",
    depth: 2
});

// Returns:
/*
/project/ (1,234 files, 8,952 chunks)
├── src/ (856 files, 6,234 chunks)
│   ├── components/ (234 files, 1,892 chunks)
│   ├── utils/ (122 files, 892 chunks)
│   └── types/ (45 files, 234 chunks)
├── tests/ (234 files, 1,456 chunks)
├── docs/ (89 files, 678 chunks)
└── config/ (12 files, 89 chunks)
*/

// Show only current working directory tree
await get_index_tree({
    path: "/project",
    relative_path: "src/components",  // Start from this subdirectory
    depth: 2
});

// Returns:
/*
src/components/ (234 files, 1,892 chunks)
├── ui/ (156 files, 1,234 chunks)
│   ├── Button.tsx (12 chunks)
│   ├── Modal.tsx (8 chunks)
│   └── Input.tsx (6 chunks)
├── layout/ (45 files, 389 chunks)
│   ├── Header.tsx (15 chunks)
│   └── Footer.tsx (10 chunks)
└── forms/ (33 files, 269 chunks)
    ├── LoginForm.tsx (18 chunks)
    └── SignupForm.tsx (22 chunks)
*/
```

### Output Formats

#### 1. **Tree Format** (default, most readable)
```
/project/ [1.2K files, 9.0K chunks]
├── src/ [856 files, 6.2K chunks]
│   ├── components/ [234 files, 1.9K chunks]
│   │   ├── Button.tsx (12 chunks)
│   │   ├── Modal.tsx (8 chunks)
│   │   └── Input.tsx (6 chunks)
│   └── utils/ [122 files, 892 chunks]
│       ├── date.ts (4 chunks)
│       └── string.ts (3 chunks)
└── tests/ [234 files, 1.5K chunks]
```

#### 2. **List Format** (more compact, easier to grep)
```
/project/ - 1,234 files, 8,952 chunks
/project/src/ - 856 files, 6,234 chunks
/project/src/components/ - 234 files, 1,892 chunks
/project/src/components/Button.tsx - 12 chunks
/project/src/components/Modal.tsx - 8 chunks
/project/src/utils/ - 122 files, 892 chunks
/project/tests/ - 234 files, 1,456 chunks
```

---

## 🏗️ Implementation Architecture

### Data Source

Query the vector database for **unique file paths**:

```typescript
// Pseudo-code for implementation
async function getIndexTree(
    codebasePath: string,
    relativePath?: string
): Promise<IndexTree> {
    const collectionName = getCollectionName(codebasePath);

    // Query all unique relativePath values
    const allChunks = await vectorDB.queryAll(collectionName, {
        fields: ['relativePath', 'fileExtension']
    });

    // Group by file path
    const fileMap = new Map<string, FileInfo>();
    for (const chunk of allChunks) {
        const existing = fileMap.get(chunk.relativePath);
        if (existing) {
            existing.chunkCount++;
        } else {
            fileMap.set(chunk.relativePath, {
                path: chunk.relativePath,
                extension: chunk.fileExtension,
                chunkCount: 1
            });
        }
    }

    let files = Array.from(fileMap.values());

    // Filter to relative path if specified
    if (relativePath) {
        const normalizedRelPath = relativePath.replace(/\\/g, '/');
        files = files.filter(f =>
            f.path.startsWith(normalizedRelPath + '/') ||
            f.path === normalizedRelPath
        );

        // Adjust paths to be relative to the specified subdirectory
        files = files.map(f => ({
            ...f,
            path: f.path.startsWith(normalizedRelPath + '/')
                ? f.path.slice(normalizedRelPath.length + 1)
                : f.path
        }));
    }

    // Build tree structure from filtered file list
    const tree = buildTreeFromPaths(files, relativePath);
    return tree;
}
```

### Tree Building Algorithm

```typescript
interface TreeNode {
    name: string;
    type: 'directory' | 'file';
    path: string;
    children?: TreeNode[];
    fileCount?: number;    // For directories
    chunkCount?: number;   // For files and directories (sum of children)
    extension?: string;    // For files
}

function buildTreeFromPaths(files: FileInfo[]): TreeNode {
    const root: TreeNode = {
        name: '/',
        type: 'directory',
        path: '/',
        children: [],
        fileCount: 0,
        chunkCount: 0
    };

    for (const file of files) {
        const parts = file.path.split(path.sep);
        let current = root;

        // Traverse/create directory structure
        for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i];
            let dirNode = current.children?.find(
                c => c.name === dirName && c.type === 'directory'
            );

            if (!dirNode) {
                dirNode = {
                    name: dirName,
                    type: 'directory',
                    path: parts.slice(0, i + 1).join(path.sep),
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
            path: file.path,
            extension: file.extension,
            chunkCount: file.chunkCount
        });
    }

    // Calculate aggregate stats (post-order traversal)
    calculateStats(root);

    return root;
}

function calculateStats(node: TreeNode): void {
    if (node.type === 'file') return;

    let fileCount = 0;
    let chunkCount = 0;

    for (const child of node.children || []) {
        if (child.type === 'directory') {
            calculateStats(child);
            fileCount += child.fileCount || 0;
            chunkCount += child.chunkCount || 0;
        } else {
            fileCount++;
            chunkCount += child.chunkCount || 0;
        }
    }

    node.fileCount = fileCount;
    node.chunkCount = chunkCount;
}
```

### Rendering

```typescript
function renderTree(
    node: TreeNode,
    depth: number,
    maxDepth: number,
    showFiles: boolean,
    includeStats: boolean,
    prefix: string = ''
): string {
    if (depth > maxDepth && maxDepth !== -1) return '';

    let output = '';
    const isLast = (index: number, total: number) => index === total - 1;

    // Render current node
    const stats = includeStats
        ? ` [${formatNumber(node.fileCount)} files, ${formatNumber(node.chunkCount)} chunks]`
        : '';

    output += `${prefix}${node.name}/${stats}\n`;

    if (!node.children) return output;

    // Render children
    const children = showFiles
        ? node.children
        : node.children.filter(c => c.type === 'directory');

    children.forEach((child, index) => {
        const isLastChild = isLast(index, children.length);
        const childPrefix = prefix + (isLastChild ? '└── ' : '├── ');
        const continuationPrefix = prefix + (isLastChild ? '    ' : '│   ');

        if (child.type === 'directory') {
            output += renderTree(
                child,
                depth + 1,
                maxDepth,
                showFiles,
                includeStats,
                childPrefix
            );
        } else if (showFiles) {
            const fileStats = includeStats
                ? ` (${child.chunkCount} chunks)`
                : '';
            output += `${childPrefix}${child.name}${fileStats}\n`;
        }
    });

    return output;
}
```

---

## 🎯 Benefits

### 1. **Token Efficiency** (~85-90% savings)

**Before (bash approach):**
```
Agent: ls src/
Output: 200 tokens
Agent: ls src/components/
Output: 150 tokens
Agent: ls src/utils/
Output: 100 tokens
Agent: find src -name "*.ts"
Output: 300 tokens
---
Total: ~750 tokens across 4 tool calls
```

**After (index tree):**
```
Agent: get_index_tree({ path: "/project", depth: 3 })
Output: ~150 tokens (complete tree structure)
---
Total: ~150 tokens in 1 tool call (80% savings)
```

### 2. **Better Agent Decision Making**

```
Agent sees:
/project/src/api/ [45 files, 234 chunks]  ← Good place to search for API code
/project/src/utils/ [122 files, 892 chunks] ← Large, maybe too general
/project/docs/ [0 files, 0 chunks]  ← NOT indexed, don't search here
```

### 3. **Improved User Experience**

- **Faster exploration** - One tool call vs many
- **Index-aware** - Only shows what's actually indexed
- **Rich metadata** - Chunk counts indicate code density
- **Flexible output** - Tree for humans, list for parsing

### 4. **Better Search Refinement**

```
# Agent workflow
1. Search fails: search_code({ query: "authentication" }) → No results
2. Check structure: get_index_tree({ depth: 2 }) → See /src/auth/ exists
3. Refine search: search_code({ query: "authentication", path: "/src/auth" })
```

### 5. **Current Working Directory Focus**

**Use Case**: Agent is working in a specific subdirectory and wants context

```bash
# User is in /project/src/components/
cd /project/src/components/
claude
> what's the structure of this directory?

# Agent calls:
get_index_tree({
    path: "/project",
    relative_path: "src/components",
    depth: 2
})

# Gets focused view of current context
src/components/ (234 files, 1,892 chunks)
├── ui/ (156 files, 1,234 chunks)
├── layout/ (45 files, 389 chunks)
└── forms/ (33 files, 269 chunks)
```

**Benefits**:
- ✅ Reduces cognitive load (only relevant subtree)
- ✅ Faster for deeply nested directories
- ✅ Matches user's mental model (they're already "in" that directory)
- ✅ Even more token-efficient (~50-80 tokens vs 150+ for full tree)

---

## 📊 Performance Considerations

### Query Optimization

**Option 1: Query all chunks** (Simple, potentially slow)
```typescript
// Query entire collection for distinct paths
const allChunks = await vectorDB.queryAll(collectionName);
```
- **Pro**: Simple implementation
- **Con**: Loads all vectors (expensive for large codebases)

**Option 2: Query metadata only** (Recommended)
```typescript
// Query only metadata fields (no vectors)
const metadata = await vectorDB.query(collectionName, {
    fields: ['relativePath', 'fileExtension'],
    limit: 100000  // High enough for any codebase
});
```
- **Pro**: Much faster (no vector data)
- **Con**: Still loads many rows

**Option 3: Cached tree** (Optimal)
```typescript
// Cache tree in SnapshotManager after indexing
interface CodebaseInfoIndexed {
    // ... existing fields
    fileTree?: IndexTree;  // NEW: Cached tree structure
}
```
- **Pro**: Instant retrieval, no DB query
- **Con**: Slightly larger snapshot file

### Estimated Performance

| Codebase Size | Option 1 | Option 2 | Option 3 (cached) |
|---------------|----------|----------|-------------------|
| Small (1K files) | ~500ms | ~100ms | **~5ms** |
| Medium (10K files) | ~5s | ~800ms | **~10ms** |
| Large (50K files) | ~25s ⚠️ | ~4s | **~20ms** |

**Recommendation**: Implement Option 2 first (metadata-only query), then add Option 3 (caching) in a follow-up iteration.

---

## 🔧 Implementation Plan

### Phase 1: Core Implementation (v0.3.0)

**Tasks:**
1. Add `get_index_tree` tool to MCP tool list
2. Implement tree building algorithm
3. Query vector DB for file metadata
4. Render tree format output
5. Add basic tests

**Files to Modify:**
- `packages/mcp/src/index.ts` - Add tool definition
- `packages/mcp/src/handlers.ts` - Add `handleGetIndexTree()` method
- Create `packages/mcp/src/tree-builder.ts` - Tree building logic

**Estimated Effort**: 3-4 hours

### Phase 2: Optimization (v0.3.1)

**Tasks:**
1. Add tree caching to SnapshotManager
2. Update tree on indexing completion
3. Implement list format output
4. Add depth limiting
5. Performance benchmarks

**Estimated Effort**: 2-3 hours

### Phase 3: Enhancement (v0.4.0)

**Tasks:**
1. Add filtering (by extension, size, etc.)
2. Add sorting options (by chunk count, alphabetical)
3. Add search highlighting (mark paths matching query)
4. Integration with parent detection

**Estimated Effort**: 3-4 hours

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('IndexTreeBuilder', () => {
    test('builds tree from flat file list', () => {
        const files = [
            { path: 'src/index.ts', extension: '.ts', chunkCount: 5 },
            { path: 'src/utils/date.ts', extension: '.ts', chunkCount: 3 }
        ];
        const tree = buildTreeFromPaths(files);
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0].name).toBe('src');
    });

    test('calculates aggregate stats correctly', () => {
        // Test fileCount and chunkCount aggregation
    });

    test('respects depth limit', () => {
        // Test depth = 2 only shows 2 levels
    });
});
```

### Integration Tests

```typescript
describe('get_index_tree MCP tool', () => {
    test('returns tree for indexed codebase', async () => {
        const result = await handleGetIndexTree({
            path: testProjectPath,
            depth: 2
        });
        expect(result.content[0].text).toContain('src/');
    });

    test('handles non-indexed codebase', async () => {
        const result = await handleGetIndexTree({
            path: '/non-indexed'
        });
        expect(result.isError).toBe(true);
    });
});
```

---

## 📝 Documentation Updates

### README.md

Add to "Available Tools" section:

```markdown
### 🆕 Index Tree Viewer (v0.3.0)

**`get_index_tree`** - View the directory structure of your indexed codebase

- Shows only **indexed files** (not filesystem)
- Includes file and chunk counts
- Configurable depth and output format
- Token-efficient alternative to `ls` and `find`

**Example:**
```bash
claude
> show me the index tree for this codebase
# Agent uses: get_index_tree({ path: "/project", depth: 3 })
```

**Parameters:**
- `path` (required): Absolute path to indexed codebase
- `depth` (optional): Max depth to show (default: 3, -1 = unlimited)
- `show_files` (optional): Show files or just directories (default: true)
- `format` (optional): 'tree' or 'list' (default: 'tree')
- `include_stats` (optional): Include file/chunk counts (default: true)
```

### Migration Guide

Create `docs/migration/v0.3.0-index-tree.md`

---

## 🚧 Edge Cases & Considerations

### 1. **Very Large Codebases**

**Issue**: 50K+ files might produce huge output (>100K tokens)

**Solution**:
- Default `depth=3` keeps output reasonable
- Add `max_files` parameter to truncate
- Warn when output exceeds threshold

```typescript
if (totalNodes > 10000) {
    return {
        content: [{
            type: "text",
            text: "⚠️  Index tree too large. Use depth or filters to reduce output."
        }]
    };
}
```

### 2. **Incomplete Indexing**

**Issue**: Codebase is still indexing

**Solution**:
- Show partial tree with warning
- Include indexing progress indicator

```typescript
if (indexingStatus === 'indexing') {
    message += `\n⚠️  Note: Indexing in progress (${progress}%). Tree is partial.`;
}
```

### 3. **Empty Directories**

**Issue**: Directories with no indexed files won't appear

**Solution**: Document this behavior (it's actually a feature - only shows indexed content)

---

## 🎓 Alternative Approaches Considered

### ❌ Approach 1: Filesystem + Filter

Query filesystem, then filter by indexed files.

**Rejected**: Requires filesystem access, defeats purpose of index-only view

### ❌ Approach 2: Separate Tree Index

Maintain a separate tree structure in vector DB.

**Rejected**: Unnecessary complexity, can derive from existing metadata

### ✅ Approach 3: Metadata Query + Cache (Selected)

Query metadata-only, build tree, cache for performance.

**Selected**: Best balance of simplicity, performance, and accuracy

---

## 📈 Success Metrics

### Performance
- ✅ Tree generation <100ms for 10K files
- ✅ Output token count 80-90% less than bash equivalent
- ✅ Single tool call vs 3-5 bash calls

### Adoption
- ✅ Used by agents in >50% of exploration workflows
- ✅ Reduces average exploration time by 40%

### Quality
- ✅ 100% accurate (only shows indexed files)
- ✅ No false positives (bash might show non-code files)

---

## 🔗 Related Features

### Complements Existing Features

1. **Parent Detection (v0.2.0)**: Tree automatically uses parent index
   ```bash
   # User in subdirectory
   cd /project/src/components/

   # Agent can call either:
   get_index_tree({ path: pwd })  # Uses parent index at /project
   # OR more explicitly:
   get_index_tree({ path: "/project", relative_path: "src/components" })
   ```

2. **Search**: Tree helps refine search paths
   ```bash
   # Pattern: Tree → Search → Iterate
   1. get_index_tree({ depth: 2 })  # See structure
   2. search_code({ query: "login" })  # Search relevant areas
   3. Repeat if needed
   ```

3. **Real-time Sync**: Tree reflects current indexed state
   - Shows files as they're added/removed
   - Chunk counts update during indexing

### Future Enhancements

1. **Visual Diff**: Show which files changed since last sync
2. **Hot Paths**: Highlight frequently searched paths
3. **Chunk Density**: Color-code by chunk concentration

---

*This proposal is ready for review and implementation planning.*
