# Phase 2: Core Implementation

**Status**: ⏸️ PENDING
**Started**: TBD
**Target Completion**: 2-3 sessions
**Overall Progress**: 0%
**Prerequisites**: Phase 1 complete

---

## 🎯 Phase Objectives

1. Implement `findParentIndex()` utility function
2. Implement cross-platform path utilities
3. Modify `handleIndexCodebase()` to use traversal
4. Add `scope` parameter to MCP tool definition
5. Update response format with `reused` flag
6. Implement comprehensive error handling

---

## 📋 Task Breakdown

### Task 2.1: Implement Path Utility Functions
**Status**: ⏸️ PENDING
**Estimated Time**: 1 hour
**Progress**: 0%

**Subtasks**:
- [ ] Create `isFilesystemRoot()` function
  - [ ] Handle Unix `/`
  - [ ] Handle Windows drive roots (`C:\`, `D:\`, etc.)
  - [ ] Handle Windows UNC paths (`\\server\share`)
- [ ] Create `resolveRealPath()` wrapper for symlink handling
- [ ] Create `directoryExists()` helper
- [ ] Add unit tests for each utility function

**File**: `packages/mcp/src/utils.ts`

**Code Template**:
```typescript
/**
 * Check if a path is a filesystem root
 * @param dirPath - Absolute directory path
 * @returns true if path is a filesystem root
 */
export function isFilesystemRoot(dirPath: string): boolean {
    // Implementation here
    // Unix: dirPath === '/'
    // Windows: /^[A-Z]:\\$/i.test(dirPath)
    // Windows UNC: /^\\\\[^\\]+\\[^\\]+$/i.test(dirPath)
}

/**
 * Resolve symlinks to real path
 * @param targetPath - Path to resolve
 * @returns Real path or original if resolution fails
 */
export function resolveRealPath(targetPath: string): string {
    // Implementation with try-catch
}
```

**Deliverables**:
- [ ] isFilesystemRoot() implemented and tested
- [ ] resolveRealPath() implemented and tested
- [ ] directoryExists() implemented and tested
- [ ] Unit tests passing

**Notes**:
_Agent notes go here_

---

### Task 2.2: Implement findParentIndex()
**Status**: ⏸️ PENDING
**Estimated Time**: 1.5 hours
**Progress**: 0%

**Subtasks**:
- [ ] Create TypeScript interface for return type
- [ ] Implement traversal loop
- [ ] Implement .claude-context/ detection
- [ ] Implement snapshot check
- [ ] Implement .git/ fallback
- [ ] Add logging for debugging
- [ ] Add error handling
- [ ] Write unit tests
- [ ] Test on Windows
- [ ] Test on Unix/macOS

**File**: `packages/mcp/src/utils.ts`

**Code Template**:
```typescript
export interface FindParentIndexResult {
    found: boolean;
    parentPath?: string;
    reason?: 'claude-context-dir' | 'snapshot' | 'git-boundary' | 'none';
}

/**
 * Traverse upward from a given path to find an existing parent index.
 *
 * Detection priority:
 * 1. .claude-context/ directory (most reliable)
 * 2. Snapshot manager has path indexed
 * 3. .git/ directory + snapshot check (project boundary heuristic)
 * 4. Filesystem root (stop condition)
 *
 * @param startPath - Absolute path to start traversal from
 * @param snapshotManager - SnapshotManager instance
 * @returns FindParentIndexResult
 */
export function findParentIndex(
    startPath: string,
    snapshotManager: SnapshotManager
): FindParentIndexResult {
    console.log(`[PARENT-TRAVERSAL] Starting traversal from: ${startPath}`);

    // Resolve symlinks to real path
    const realPath = resolveRealPath(startPath);
    let current = realPath;

    // Traverse upward until filesystem root
    while (!isFilesystemRoot(current)) {
        console.log(`[PARENT-TRAVERSAL] Checking: ${current}`);

        // Check 1: .claude-context directory
        const claudeContextDir = path.join(current, '.claude-context');
        if (directoryExists(claudeContextDir)) {
            console.log(`[PARENT-TRAVERSAL] Found .claude-context at: ${current}`);
            return { found: true, parentPath: current, reason: 'claude-context-dir' };
        }

        // Check 2: Snapshot has this path indexed
        if (snapshotManager.getIndexedCodebases().includes(current)) {
            console.log(`[PARENT-TRAVERSAL] Found in snapshot: ${current}`);
            return { found: true, parentPath: current, reason: 'snapshot' };
        }

        // Check 3: Git boundary + snapshot check
        const gitDir = path.join(current, '.git');
        if (directoryExists(gitDir)) {
            console.log(`[PARENT-TRAVERSAL] Found .git at: ${current}`);
            if (snapshotManager.getIndexedCodebases().includes(current)) {
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
}
```

**Test Scenarios**:
- [ ] Subdirectory finds parent with .claude-context/
- [ ] Subdirectory finds parent from snapshot
- [ ] Git boundary detection works
- [ ] Filesystem root stops traversal
- [ ] Symlinks are resolved
- [ ] Windows drive roots handled
- [ ] Unix root handled
- [ ] Returns "none" when no parent

**Deliverables**:
- [ ] findParentIndex() fully implemented
- [ ] All unit tests passing
- [ ] Cross-platform verified
- [ ] Logging added for debugging

**Notes**:
_Agent notes go here_

---

### Task 2.3: Modify handleIndexCodebase()
**Status**: ⏸️ PENDING
**Estimated Time**: 2 hours
**Progress**: 0%

**Subtasks**:
- [ ] Add `scope` parameter extraction
- [ ] Add parameter validation for `scope`
- [ ] Insert traversal logic after path resolution
- [ ] Handle parent found scenario (return early)
- [ ] Handle parent not found scenario (continue normal flow)
- [ ] Update response format with `reused` flag
- [ ] Update user-facing messages
- [ ] Preserve `force` parameter skip logic
- [ ] Add error handling
- [ ] Update logging

**File**: `packages/mcp/src/handlers.ts`

**Integration Point**:
```typescript
async handleIndexCodebase(args: any): Promise<any> {
    try {
        // 1. Extract parameters (EXISTING)
        const codebasePath = args.path;
        const forceReindex = args.force === true;
        const scope = args.scope || 'auto';  // NEW
        // ... other params

        // 2. Resolve to absolute path (EXISTING)
        const absolutePath = ensureAbsolutePath(codebasePath);

        // 3. NEW: Parent traversal logic (if scope=auto and not force)
        if (!forceReindex && scope === 'auto') {
            const parentResult = findParentIndex(absolutePath, this.snapshotManager);

            if (parentResult.found) {
                // Parent index found - return early
                const status = this.snapshotManager.getCodebaseInfo(parentResult.parentPath);
                return {
                    content: [{
                        type: "text",
                        text: `Using parent index at '${parentResult.parentPath}' (detected via ${parentResult.reason}).\n\n` +
                              `The requested path '${absolutePath}' is a subdirectory of an existing index. ` +
                              `Searches will cover the entire project. Use scope="local" to force subdirectory-only indexing.`
                    }],
                    metadata: {
                        index_path: parentResult.parentPath,
                        status: status?.status || 'indexed',
                        progress: status?.status === 'indexing' ? (status as any).indexingPercentage : 100,
                        reused: true
                    }
                };
            }
        }

        // 4. Continue with normal indexing flow (EXISTING)
        // ... validation, snapshot checks, etc.
    } catch (error) {
        // Error handling
    }
}
```

**Message Templates**:
```typescript
const messages = {
    parentFound: (parentPath: string, reason: string) =>
        `Using parent index at '${parentPath}' (detected via ${reason}).\n\n` +
        `The requested path is a subdirectory of an existing index. ` +
        `Searches will cover the entire project. Use scope="local" to force subdirectory-only indexing.`,

    parentIndexing: (parentPath: string, progress: number) =>
        `Parent index at '${parentPath}' is currently being indexed (${progress}% complete).\n\n` +
        `You can search the codebase now, but results may be incomplete until indexing completes.`,

    newIndex: (indexPath: string) =>
        `Started background indexing for codebase '${indexPath}'...`,

    forcedSubdirectory: (indexPath: string) =>
        `Started background indexing for subdirectory '${indexPath}' (scope=local)...`
};
```

**Deliverables**:
- [ ] Traversal logic integrated
- [ ] scope parameter working
- [ ] Responses updated with reused flag
- [ ] Messages user-friendly
- [ ] Backward compatibility verified
- [ ] Logging comprehensive

**Notes**:
_Agent notes go here_

---

### Task 2.4: Update MCP Tool Definition
**Status**: ⏸️ PENDING
**Estimated Time**: 30 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Add `scope` parameter to tool schema
- [ ] Update tool description
- [ ] Update parameter descriptions
- [ ] Add usage examples to description
- [ ] Verify MCP protocol compliance

**File**: `packages/mcp/src/index.ts`

**Updated Tool Definition**:
```typescript
const index_description = `
Index a codebase directory to enable semantic search using a configurable code splitter.

⚠️ **IMPORTANT**:
- You MUST provide an absolute path to the target codebase.

✨ **Parent Index Detection**:
- By default (scope="auto"), this tool automatically detects parent indexes
- If a parent index exists, it will be reused instead of creating a duplicate
- Use scope="local" to force indexing only the specified directory

✨ **Usage Guidance**:
- This tool is typically used when search fails due to an unindexed codebase.
- If indexing is attempted on an already indexed path, and a conflict is detected, you MUST prompt the user to confirm whether to proceed with a force index (i.e., re-indexing and overwriting the previous index).
`;

this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "index_codebase") {
        return await this.toolHandlers.handleIndexCodebase({
            path: request.params.arguments?.path,
            force: request.params.arguments?.force,
            scope: request.params.arguments?.scope,  // NEW
            splitter: request.params.arguments?.splitter,
            customExtensions: request.params.arguments?.customExtensions,
            ignorePatterns: request.params.arguments?.ignorePatterns
        });
    }
    // ... other tools
});
```

**Schema Updates**:
```typescript
{
    name: "index_codebase",
    description: index_description,
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "ABSOLUTE path to the codebase directory to index."
            },
            force: {
                type: "boolean",
                description: "Force re-indexing even if already indexed (default: false)",
                default: false
            },
            scope: {  // NEW
                type: "string",
                enum: ["auto", "local"],
                description: "Index scope: 'auto' (detect parent, default) or 'local' (index only this directory)",
                default: "auto"
            },
            splitter: { /* existing */ },
            customExtensions: { /* existing */ },
            ignorePatterns: { /* existing */ }
        },
        required: ["path"]
    }
}
```

**Deliverables**:
- [ ] Tool schema updated
- [ ] Description updated
- [ ] Parameter validation updated
- [ ] MCP protocol compliance verified

**Notes**:
_Agent notes go here_

---

### Task 2.5: Error Handling & Edge Cases
**Status**: ⏸️ PENDING
**Estimated Time**: 1 hour
**Progress**: 0%

**Subtasks**:
- [ ] Handle symlink resolution errors
- [ ] Handle permission errors during traversal
- [ ] Handle invalid scope parameter
- [ ] Handle snapshot read errors
- [ ] Handle concurrent parent indexing
- [ ] Add try-catch around traversal
- [ ] Return proper MCP error responses
- [ ] Add error logging

**Error Scenarios**:
1. **Symlink resolution fails**
   - Fallback: Use original path
   - Log warning

2. **Permission denied during traversal**
   - Skip directory
   - Continue traversal

3. **Invalid scope value**
   - Return error with valid values
   - Don't start indexing

4. **Snapshot corruption**
   - Log error
   - Treat as "no parent found"
   - Continue with normal indexing

5. **Parent indexing in progress**
   - Return parent status
   - Don't start subdirectory indexing

**Deliverables**:
- [ ] All error scenarios handled
- [ ] MCP-compliant error responses
- [ ] Comprehensive logging
- [ ] No crashes on edge cases

**Notes**:
_Agent notes go here_

---

## ✅ Phase Completion Criteria

- [ ] All tasks marked 🟢 COMPLETED
- [ ] All utility functions implemented and tested
- [ ] findParentIndex() working on all platforms
- [ ] handleIndexCodebase() integration complete
- [ ] scope parameter functional
- [ ] Error handling comprehensive
- [ ] Manual testing successful
- [ ] No regressions in existing functionality
- [ ] Code reviewed (if applicable)
- [ ] Ready for Phase 3 (integration testing)

---

## 🚧 Blockers & Questions

### Current Blockers
_Add as discovered_

### Decisions Made
_Document key decisions during implementation_

---

## 📝 Agent Session Notes

### Session #[N] - [DATE] [TIME]
**Agent**: [ID]
**Tasks Worked**: [List]
**Progress**: [X]%

**Completed**:
- [Item]

**In Progress**:
- [Item]

**Blockers**:
- [Item]

**Next Actions**:
1. [Action]

---

*Phase 2 prerequisites: Phase 1 complete*
*Last updated: [DATE]*
