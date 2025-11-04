# Phase 1: Analysis & Design

**Status**: 🔄 IN PROGRESS
**Started**: 2025-11-03
**Target Completion**: 1 session
**Overall Progress**: 0%

---

## 🎯 Phase Objectives

1. Analyze current `handleIndexCodebase` implementation thoroughly
2. Design `findParentIndex()` function with cross-platform support
3. Define TypeScript interfaces and types
4. Plan integration points with SnapshotManager
5. Design MCP tool parameter changes
6. Create detailed implementation specification

---

## 📋 Task Breakdown

### Task 1.1: Analyze Current Implementation
**Status**: ⏸️ PENDING
**Estimated Time**: 30 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Read `handleIndexCodebase` method completely (packages/mcp/src/handlers.ts)
- [ ] Document current validation logic
- [ ] Document current path resolution (ensureAbsolutePath)
- [ ] Document current snapshot interaction
- [ ] Identify insertion point for traversal logic
- [ ] Map current error handling patterns

**Deliverables**:
- Document current code flow in this file (see Analysis Section below)
- List of integration points
- Risk assessment for changes

**Notes**:
_Agent notes go here as work progresses_

---

### Task 1.2: Design findParentIndex() Function
**Status**: ⏸️ PENDING
**Estimated Time**: 45 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Design function signature
- [ ] Design return type (TypeScript interface)
- [ ] Plan traversal algorithm (pseudocode)
- [ ] Plan cross-platform path handling (Windows/Unix)
- [ ] Plan symlink resolution strategy
- [ ] Plan filesystem root detection (per platform)
- [ ] Plan .claude-context/ detection
- [ ] Plan .git/ fallback detection
- [ ] Design error handling strategy

**Deliverables**:
- Function signature with JSDoc
- Pseudocode for traversal algorithm
- TypeScript interfaces
- Edge case handling plan

**Notes**:
_Agent notes go here_

---

### Task 1.3: Define TypeScript Interfaces
**Status**: ⏸️ PENDING
**Estimated Time**: 20 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Define `FindParentIndexResult` interface
- [ ] Define `TraversalOptions` interface (if needed)
- [ ] Update `IndexCodebaseResponse` interface (add `reused` flag)
- [ ] Define error types
- [ ] Plan integration with existing types in config.ts

**Deliverables**:
```typescript
// Example (refine during implementation)
interface FindParentIndexResult {
    found: boolean;
    parentPath?: string;
    reason?: 'claude-context-dir' | 'snapshot' | 'git-boundary' | 'none';
}

interface IndexCodebaseResponse {
    message: string;
    index_path: string;
    status: 'indexed' | 'indexing' | 'indexfailed' | 'not_found';
    progress: number;
    reused: boolean;  // NEW
}
```

**Notes**:
_Agent notes go here_

---

### Task 1.4: Plan SnapshotManager Integration
**Status**: ⏸️ PENDING
**Estimated Time**: 30 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Review SnapshotManager methods for checking indexed paths
- [ ] Design query method for parent detection (if needed)
- [ ] Plan snapshot metadata updates (if storing parent relationships)
- [ ] Document v2 format compatibility requirements
- [ ] Plan any new snapshot methods needed

**Deliverables**:
- Integration plan document
- List of SnapshotManager changes (if any)
- Migration plan for snapshot format (if needed)

**Notes**:
_Agent notes go here_

---

### Task 1.5: Design MCP Tool Parameter Changes
**Status**: ⏸️ PENDING
**Estimated Time**: 20 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Design `scope` parameter ("auto" | "local")
- [ ] Update tool description text
- [ ] Plan parameter validation logic
- [ ] Design user-facing messages for each scenario
- [ ] Plan backward compatibility (default values)

**Deliverables**:
```typescript
// Updated tool definition
{
    name: "index_codebase",
    description: "Index a codebase directory (with parent detection)...",
    inputSchema: {
        path: { type: "string", description: "..." },
        force: { type: "boolean", default: false, description: "..." },
        scope: {
            type: "string",
            enum: ["auto", "local"],
            default: "auto",
            description: "..."
        },
        // ... other params
    }
}
```

**Notes**:
_Agent notes go here_

---

### Task 1.6: Create Implementation Specification
**Status**: ⏸️ PENDING
**Estimated Time**: 30 minutes
**Progress**: 0%

**Subtasks**:
- [ ] Write detailed spec for findParentIndex()
- [ ] Write detailed spec for handleIndexCodebase modifications
- [ ] Document all edge cases and handling
- [ ] Create decision tree diagram (text-based)
- [ ] Document test scenarios
- [ ] Define success criteria

**Deliverables**:
- Complete specification document (add to this file below)
- Test scenario matrix
- Edge case handling guide

**Notes**:
_Agent notes go here_

---

## 📊 Analysis Section

### Current handleIndexCodebase Flow

_To be filled during Task 1.1:_

```
1. Parameter extraction and defaults
2. Path resolution (ensureAbsolutePath)
3. Snapshot check (isIndexed, isIndexing, isFailed)
4. Validation (path exists, is directory)
5. Force re-index handling (clear existing)
6. Start background indexing
7. Return MCP response
```

**Key Integration Points**:
- Line XX: Path resolution
- Line XX: Snapshot check (INSERT TRAVERSAL HERE)
- Line XX: Validation
- Line XX: Return response

**Current Error Handling**:
_Document patterns_

---

## 📐 Design Specification

### findParentIndex() Detailed Spec

_To be filled during Task 1.2-1.3:_

```typescript
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
 * @param snapshotManager - SnapshotManager instance for checking indexed paths
 * @returns FindParentIndexResult with parent path if found
 *
 * @example
 * // Finds parent index
 * const result = findParentIndex('/project/src/components', snapshotMgr);
 * // { found: true, parentPath: '/project', reason: 'claude-context-dir' }
 *
 * // No parent found
 * const result = findParentIndex('/unrelated/path', snapshotMgr);
 * // { found: false, reason: 'none' }
 */
function findParentIndex(
    startPath: string,
    snapshotManager: SnapshotManager
): FindParentIndexResult {
    // Implementation spec to be written
}
```

**Algorithm Pseudocode**:
```
function findParentIndex(startPath, snapshotManager):
    # Resolve symlinks to real path
    realPath = fs.realpathSync(startPath)
    current = realPath

    # Traverse upward
    while not isFilesystemRoot(current):
        # Check 1: .claude-context directory
        if directoryExists(path.join(current, '.claude-context')):
            return { found: true, parentPath: current, reason: 'claude-context-dir' }

        # Check 2: Snapshot has this path
        if snapshotManager.getIndexedCodebases().includes(current):
            return { found: true, parentPath: current, reason: 'snapshot' }

        # Check 3: Git boundary + snapshot check
        if directoryExists(path.join(current, '.git')):
            if snapshotManager.getIndexedCodebases().includes(current):
                return { found: true, parentPath: current, reason: 'git-boundary' }

        # Move up one directory
        parent = path.dirname(current)

        # Safety check: prevent infinite loop
        if parent === current:
            break

        current = parent

    return { found: false, reason: 'none' }
```

**Cross-Platform Considerations**:
- Windows: Check for drive root (e.g., `C:\`)
- Unix/macOS: Check for `/`
- Use Node.js `path.dirname()` for platform abstraction
- Handle UNC paths on Windows (e.g., `\\server\share`)

**Symlink Handling**:
- Use `fs.realpathSync()` at start
- Prevents traversal confusion
- Handles junction points on Windows

---

## ✅ Phase Completion Criteria

- [ ] All tasks marked 🟢 COMPLETED
- [ ] Complete implementation specification written
- [ ] All TypeScript interfaces defined
- [ ] Integration points documented
- [ ] Edge cases catalogued with handling plans
- [ ] Test scenarios matrix created
- [ ] Ready to begin Phase 2 (implementation)

---

## 🚧 Blockers & Questions

### Current Blockers
_None yet - add as discovered_

### Open Questions
1. Should we cache traversal results in memory?
   - **Context**: Repeated calls for same path
   - **Impact**: Performance vs memory trade-off
   - **Decision**: TBD

2. Should snapshot store parent relationships?
   - **Context**: Faster lookups
   - **Impact**: More complex snapshot format
   - **Decision**: TBD

---

## 📝 Agent Session Notes

### Session #1 - [DATE] [TIME]
**Agent**: [ID]
**Duration**: [X] hours
**Tasks Worked**: Task 1.1, 1.2
**Status**: [In Progress / Completed]

**Progress**:
- Completed: [list]
- In Progress: [list]
- Blocked: [list]

**Key Findings**:
- [Finding 1]
- [Finding 2]

**Next Actions**:
1. [Action 1]
2. [Action 2]

**Handoff Notes**:
_Any important context for next agent_

---

*Phase 1 started: 2025-11-03*
*Last updated: 2025-11-03*
