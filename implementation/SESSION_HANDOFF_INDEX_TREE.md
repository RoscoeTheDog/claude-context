# Session Handoff: Index Tree Viewer Implementation

**Feature**: Index Tree Viewer (v0.3.0)
**Status**: Ready to Begin Implementation
**Last Updated**: 2025-11-03
**Next Agent**: Start Phase 1 Implementation

---

## 🎯 Quick Start for Next Agent

Copy and paste this prompt to Claude Code:

```
I'm continuing work on the Index Tree Viewer feature for claude-context.

CONTEXT:
- Feature proposal is complete: implementation/FEATURE_PROPOSAL_INDEX_TREE.md
- Implementation estimate is done: implementation/IMPLEMENTATION_ESTIMATE_INDEX_TREE.md
- Current status: Ready to start Phase 1 (MVP implementation)
- Estimated time: 3-4 sessions total, we're starting session 1

TASK:
Start Phase 1 implementation of the get_index_tree MCP tool.

Phase 1 includes 8 tasks:
1. Create tree-builder.ts scaffold
2. Implement buildTreeFromPaths() algorithm
3. Implement calculateStats() function
4. Implement renderTree() function
5. Add handleGetIndexTree() to handlers.ts
6. Add MCP tool definition to index.ts
7. Write basic unit tests
8. Manual testing with real codebase

Please read the proposal and estimate documents first, then start with Task 1.1.
Use TodoWrite to track progress through all 8 tasks.
```

---

## 📂 Key Documents to Read

**Read these in order before starting:**

1. **FEATURE_PROPOSAL_INDEX_TREE.md** (~10 min read)
   - Full feature specification
   - API design and examples
   - Architecture and algorithms
   - Benefits and use cases

2. **IMPLEMENTATION_ESTIMATE_INDEX_TREE.md** (~5 min read)
   - Complexity analysis
   - Detailed task breakdown for all phases
   - Session estimates and risks
   - Comparison to v0.2.0

**Quick Summary if Short on Time:**
- New MCP tool: `get_index_tree`
- Shows indexed directory structure (like `tree` command but index-aware)
- Parameters: `path`, `relative_path`, `depth`, `format`, `show_files`, `include_stats`
- Implementation: Query vector DB → Build tree → Render output
- 20 tasks across 3 phases, estimated 3-4 sessions

---

## 🏗️ Phase 1 Detailed Tasks

### Task 1.1: Create tree-builder.ts Scaffold (20 min)

**File**: `packages/mcp/src/tree-builder.ts` (new file)

**Create these interfaces:**
```typescript
export interface TreeNode {
    name: string;
    type: 'directory' | 'file';
    path: string;
    children?: TreeNode[];
    fileCount?: number;
    chunkCount?: number;
    extension?: string;
}

export interface FileInfo {
    path: string;
    extension: string;
    chunkCount: number;
}
```

**Export these functions:**
```typescript
export function buildTreeFromPaths(files: FileInfo[], baseRelativePath?: string): TreeNode;
export function calculateStats(node: TreeNode): void;
export function renderTree(node: TreeNode, options: RenderOptions): string;
export function renderList(node: TreeNode, options: RenderOptions): string;
```

### Task 1.2: Implement buildTreeFromPaths() (30 min)

**Algorithm** (see proposal for full pseudo-code):
1. Create root node
2. For each file path, split into parts
3. Traverse/create directory structure
4. Add file node at the end
5. Return root node

**Key points**:
- Use `path.sep` for splitting paths
- Handle both Windows (`\`) and Unix (`/`) separators
- Create intermediate directories as needed
- Store file metadata (extension, chunkCount)

### Task 1.3: Implement calculateStats() (20 min)

**Algorithm**:
- Post-order traversal (process children first)
- For each directory, sum up:
  - `fileCount` = count of files + sum of children's fileCounts
  - `chunkCount` = sum of all chunks (files + subdirs)
- Leaf nodes (files) just have their own chunkCount

### Task 1.4: Implement renderTree() (30 min)

**Format**:
```
/project/ [1.2K files, 9.0K chunks]
├── src/ [856 files, 6.2K chunks]
│   ├── components/ [234 files, 1.9K chunks]
│   └── utils/ [122 files, 892 chunks]
└── tests/ [234 files, 1.5K chunks]
```

**Key features**:
- Box-drawing characters: `├──`, `└──`, `│`
- Respect depth limit
- Format numbers (1.2K, 9.0K, etc.)
- Conditionally show stats based on `includeStats` option

### Task 1.5: Add handleGetIndexTree() to handlers.ts (40 min)

**Location**: `packages/mcp/src/handlers.ts`

**Steps**:
1. Extract parameters from `args`
2. Validate path exists and is indexed
3. Query vector DB for metadata:
   ```typescript
   const chunks = await this.context.queryMetadata(collectionName, {
       fields: ['relativePath', 'fileExtension']
   });
   ```
4. Group chunks by file path, count chunks per file
5. Build FileInfo[] array
6. Call `buildTreeFromPaths(files)`
7. Call `calculateStats(tree)`
8. Call `renderTree(tree, options)` or `renderList(tree, options)`
9. Return MCP response

**Error handling**:
- Path not indexed → Return error message
- Path not found → Return error message
- Empty index → Return message "No files indexed"

### Task 1.6: Add MCP Tool Definition (15 min)

**Location**: `packages/mcp/src/index.ts`

**Add to tools array**:
```typescript
{
    name: "get_index_tree",
    description: "View the directory tree structure of an indexed codebase with file and chunk statistics. Shows only indexed files (not filesystem). Use relative_path to focus on a specific subdirectory.",
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
}
```

**Wire up handler**:
```typescript
case "get_index_tree":
    return await toolHandlers.handleGetIndexTree(params);
```

### Task 1.7: Write Basic Unit Tests (40 min)

**File**: `packages/mcp/src/__tests__/tree-builder.test.ts` (new file)

**Test cases** (~15 tests):
1. `buildTreeFromPaths()` with empty array
2. `buildTreeFromPaths()` with single file
3. `buildTreeFromPaths()` with nested directories
4. `buildTreeFromPaths()` with multiple files in same directory
5. `calculateStats()` for single file
6. `calculateStats()` for directory with files
7. `calculateStats()` for nested directories (aggregation)
8. `renderTree()` basic output
9. `renderTree()` with depth limit
10. `renderTree()` without files
11. `renderTree()` without stats
12. `renderList()` format
13. Path normalization (Windows vs Unix)
14. Empty subdirectory handling
15. Special characters in filenames

### Task 1.8: Manual Testing (30 min)

**Steps**:
1. Build the MCP package: `pnpm build`
2. Start MCP server in development mode
3. Use a test codebase (can use claude-context itself)
4. Index the codebase: `index_codebase({ path: "/test-project" })`
5. Call `get_index_tree({ path: "/test-project" })`
6. Verify output looks correct
7. Try with different parameters:
   - `depth: 2`
   - `format: "list"`
   - `show_files: false`
   - `relative_path: "src"`
8. Fix any bugs found
9. Document any issues for Phase 2

---

## 🔧 Important Implementation Notes

### Vector DB Query Pattern

Look at existing handlers for reference:

```typescript
// From handleSearchCode() in handlers.ts
const collectionName = this.context.getCollectionName(absolutePath);
const searchResults = await this.context.search(
    collectionName,
    query,
    resultLimit,
    extensionFilter
);
```

**For get_index_tree**, you'll need to query ALL documents (or use a distinct query if available):

```typescript
// Option 1: Query all and deduplicate in code
const allChunks = await this.context.queryAll(collectionName);
const uniqueFiles = deduplicateByPath(allChunks);

// Option 2: If Milvus supports it, query distinct values
// (Check vector-database.ts for available methods)
```

### Path Handling

Paths in the index are already normalized to Unix format (`/`), so:
- Use `path.posix.sep` when splitting paths
- Don't worry about Windows `\` in the indexed data
- Only handle `\` vs `/` in the input `relative_path` parameter

### Number Formatting

```typescript
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}
```

### Tree Rendering Characters

```typescript
const BOX_CHARS = {
    BRANCH: '├── ',
    LAST: '└── ',
    VERTICAL: '│   ',
    SPACE: '    '
};
```

---

## 📋 Definition of Done (Phase 1)

Phase 1 is complete when:

- [ ] `tree-builder.ts` created with all interfaces and functions
- [ ] `buildTreeFromPaths()` works correctly with test data
- [ ] `calculateStats()` accurately aggregates file/chunk counts
- [ ] `renderTree()` produces correct tree format
- [ ] `handleGetIndexTree()` added to handlers.ts
- [ ] MCP tool definition added to index.ts
- [ ] 15+ unit tests written and passing
- [ ] Manual testing completed successfully
- [ ] TypeScript compiles with no errors
- [ ] All existing tests still pass

**Ready for Phase 2** when agent can call:
```typescript
get_index_tree({ path: "/project", depth: 2 })
```
And get back a correctly formatted tree with accurate statistics.

---

## 🚫 What NOT to Do Yet

**Save for Phase 2:**
- ❌ Don't implement `relative_path` filtering yet
- ❌ Don't implement `renderList()` yet (tree format only)
- ❌ Don't add performance caching yet

**Save for Phase 3:**
- ❌ Don't optimize performance yet
- ❌ Don't update documentation yet (README, CHANGELOG)
- ❌ Don't worry about large codebase performance

**Focus on:**
- ✅ Basic tree building and rendering
- ✅ Accurate statistics
- ✅ Core functionality working end-to-end

---

## 🐛 Known Issues / Edge Cases to Handle

### Phase 1 Scope

1. **Empty directories won't show** (by design - only indexed files)
2. **Very large output** - Limit depth to 3 by default
3. **Duplicate file paths** - Should deduplicate by path
4. **Path separator consistency** - Normalize to Unix `/` internally

### Testing Tips

Use this test data structure:
```typescript
const testFiles: FileInfo[] = [
    { path: 'src/index.ts', extension: '.ts', chunkCount: 5 },
    { path: 'src/utils/date.ts', extension: '.ts', chunkCount: 3 },
    { path: 'src/utils/string.ts', extension: '.ts', chunkCount: 2 },
    { path: 'tests/index.test.ts', extension: '.ts', chunkCount: 4 }
];
```

Expected tree:
```
root/ [4 files, 14 chunks]
├── src/ [3 files, 10 chunks]
│   ├── index.ts (5 chunks)
│   └── utils/ [2 files, 5 chunks]
│       ├── date.ts (3 chunks)
│       └── string.ts (2 chunks)
└── tests/ [1 files, 4 chunks]
    └── index.test.ts (4 chunks)
```

---

## 📚 Reference Files

**Study these files for patterns:**

1. **packages/mcp/src/handlers.ts**
   - `handleIndexCodebase()` - MCP handler pattern
   - `handleSearchCode()` - Vector DB query pattern
   - `handleGetIndexingStatus()` - Response formatting

2. **packages/mcp/src/utils.ts**
   - `findParentIndex()` - Path traversal example
   - `ensureAbsolutePath()` - Path validation

3. **packages/mcp/src/__tests__/handlers-integration.test.ts**
   - Testing pattern for MCP handlers
   - Mocking pattern for dependencies

4. **packages/core/src/context.ts**
   - `search()` method - Vector DB interaction
   - Query patterns

---

## 🎯 Success Metrics

**After Phase 1, you should be able to:**

```bash
# From command line / MCP client
claude
> get the index tree for this codebase

# Agent calls:
get_index_tree({ path: "/path/to/project", depth: 2 })

# Output:
/path/to/project/ [1,234 files, 8,952 chunks]
├── src/ [856 files, 6,234 chunks]
│   ├── components/ [234 files, 1,892 chunks]
│   ├── utils/ [122 files, 892 chunks]
│   └── types/ [45 files, 234 chunks]
├── tests/ [234 files, 1,456 chunks]
├── docs/ [89 files, 678 chunks]
└── config/ [12 files, 89 chunks]
```

---

## 🔄 Next Steps After Phase 1

Once Phase 1 is complete, the next agent should:

1. **Create Phase 1 completion summary**
   - Document what works
   - Note any bugs found
   - List any improvements needed

2. **Start Phase 2** (Enhancement)
   - Task 2.1: Add `relative_path` support
   - Task 2.2: Implement path filtering tests
   - Task 2.3: Implement `renderList()` format
   - Task 2.4: Add `format` parameter
   - Task 2.5: Add `show_files` parameter
   - Task 2.6: Integration tests

---

## 💬 Questions?

If you encounter issues:

1. **Check the proposal**: FEATURE_PROPOSAL_INDEX_TREE.md has detailed algorithms
2. **Check the estimate**: IMPLEMENTATION_ESTIMATE_INDEX_TREE.md has task breakdowns
3. **Check v0.2.0 code**: Similar patterns in utils.ts and handlers.ts
4. **Ask the user**: If something is unclear or blocking

---

## 📊 Progress Tracking

Use TodoWrite to track progress through Phase 1:

```typescript
TodoWrite({
    todos: [
        { content: "Create tree-builder.ts scaffold", status: "pending" },
        { content: "Implement buildTreeFromPaths()", status: "pending" },
        { content: "Implement calculateStats()", status: "pending" },
        { content: "Implement renderTree()", status: "pending" },
        { content: "Add handleGetIndexTree() to handlers.ts", status: "pending" },
        { content: "Add MCP tool definition to index.ts", status: "pending" },
        { content: "Write basic unit tests", status: "pending" },
        { content: "Manual testing with real codebase", status: "pending" }
    ]
});
```

Update status as you complete each task!

---

**Good luck! This is a well-scoped feature with clear deliverables. You've got this! 🚀**

---

*Last Updated: 2025-11-03*
*Ready for: Phase 1 Implementation*
*Estimated Time: 3-4 hours (1-2 sessions)*
