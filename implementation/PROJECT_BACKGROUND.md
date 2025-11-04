# Project Background - Parent Directory Traversal

**Created**: 2025-11-03
**Feature**: Parent directory traversal for index_codebase
**Target Version**: 0.2.0

---

## 📖 Full Problem Statement

### Current Behavior
When users open Claude Code sessions in subdirectories of projects:

```bash
# Scenario: Project already indexed at parent level
cd ~/projects/my-app
claude
> index this codebase  # Creates index at ~/projects/my-app

# Later, user opens subdirectory
cd ~/projects/my-app/src/components
claude
> index this codebase  # ❌ Creates DUPLICATE index at subdirectory!
```

This causes multiple issues:
1. **Duplicate indexes** - Same files indexed multiple times
2. **Token waste** - Agent runtime logic costs ~350-850 tokens per session
3. **Poor UX** - Search from subdirectory doesn't see parent index
4. **Compute waste** - Re-indexing already-analyzed code
5. **Sync conflicts** - Real-time sync may conflict on overlapping paths

### Expected Behavior (After Implementation)
```bash
cd ~/projects/my-app/src/components
claude
> index this codebase
# ✅ Detects parent index at ~/projects/my-app
# ✅ Returns: "Using parent index at ~/projects/my-app"
# ✅ No duplicate indexing
# ✅ Search works across entire project
```

---

## 💡 Proposed Solution

### High-Level Approach
Modify `index_codebase()` to traverse upward from requested path before creating new index.

### Traversal Algorithm
```
function index_codebase(path, force=false, scope="auto"):
    abs_path = resolve_absolute(path)

    # Skip traversal if force or local scope
    if force or scope == "local":
        return create_new_index(abs_path)

    # Traverse upward to find parent index
    parent_index = find_parent_index(abs_path)

    if parent_index:
        status = get_indexing_status(parent_index)
        return {
            message: "Using parent index at {parent_index}",
            index_path: parent_index,
            status: status.status,
            progress: status.progress,
            reused: true
        }

    # No parent found - create new index
    return create_new_index(abs_path)
```

### Detection Strategy
```
function find_parent_index(start_path):
    current = start_path

    # Traverse upward until filesystem root
    while not at_filesystem_root(current):
        # Primary indicator: .claude-context directory
        if exists(current + "/.claude-context/"):
            return current

        # Check if this path is in snapshot
        if snapshot.has_indexed_codebase(current):
            return current

        # Fallback: Check for .git (project boundary heuristic)
        if exists(current + "/.git"):
            # Check if git root has index
            if snapshot.has_indexed_codebase(current):
                return current

        # Move up one directory
        current = parent_directory(current)

    return null  # No parent index found
```

---

## 🎯 Key Design Decisions

### 1. Traversal Priority
**Decision**: `.claude-context/` → snapshot check → `.git/` → filesystem root

**Rationale**:
- `.claude-context/` is the most reliable indicator (created by indexing)
- Snapshot check handles cases where .claude-context is in .gitignore
- `.git/` is a good heuristic for project boundaries
- Filesystem root prevents infinite loops

### 2. Optional `scope` Parameter
**Decision**: Add `scope` parameter with values "auto" (default) | "local"

**Rationale**:
- "auto": Default behavior, enables traversal
- "local": Allows users to force subdirectory-only indexing if needed
- Backward compatible (defaults to smart behavior)

**Example Use Cases**:
```javascript
// Standard case: auto-detects parent
index_codebase("/project/src", scope: "auto")  // Finds /project

// Force subdirectory indexing
index_codebase("/project/src", scope: "local")  // Indexes /project/src only
```

### 3. `force` Parameter Behavior
**Decision**: `force=true` skips traversal completely

**Rationale**:
- Preserves existing "force re-index" semantics
- Allows re-indexing subdirectories if truly needed
- Clear separation: force=true means "do exactly what I say"

### 4. Response Format
**Decision**: Return consistent JSON with `reused` flag

```typescript
interface IndexCodebaseResponse {
    message: string;
    index_path: string;
    status: 'indexed' | 'indexing' | 'indexfailed' | 'not_found';
    progress: number;  // 0-100
    reused: boolean;   // true if parent index reused
}
```

**Rationale**:
- Agents can detect when parent is reused
- Consistent with existing async indexing response format
- Provides all necessary info for agent decision-making

---

## 🔍 Edge Cases & Handling

### 1. Filesystem Root
**Case**: Traversal reaches `/` (Unix) or `C:\` (Windows)
**Handling**: Stop traversal, return null (no parent found)

### 2. Symlinks
**Case**: Path contains symbolic links
**Handling**: Resolve to real path using `fs.realpathSync()` before traversal

### 3. Nested Git Repositories
**Case**: `/parent/.git` and `/parent/submodule/.git` both exist
**Handling**: Prefer nearest `.claude-context/` directory, then nearest `.git`

**Example**:
```
/parent/.git
/parent/.claude-context/  ← Indexed here
/parent/submodule/.git
/parent/submodule/src/

Request: index_codebase("/parent/submodule/src")
Result: Finds /parent (has .claude-context/)
```

### 4. Parent Index In Progress
**Case**: Parent is currently being indexed
**Handling**: Return parent status with progress percentage

```javascript
{
    message: "Using parent index at /parent (indexing in progress: 45%)",
    index_path: "/parent",
    status: "indexing",
    progress: 45,
    reused: true
}
```

### 5. Real-Time Sync Coverage
**Case**: Parent has real-time sync enabled
**Handling**: Subdirectory changes already tracked by parent sync (no action needed)

### 6. Multiple Codebases in Hierarchy
**Case**: `/parent1/` indexed, `/parent1/parent2/` also indexed
**Handling**: Find nearest parent (prefer `/parent1/parent2/`)

---

## 🚀 Benefits Analysis

### Token Efficiency
**Current (Agent-side logic)**:
```python
# Agent must check at runtime (~400-900 tokens)
1. Get current directory
2. Traverse upward checking for indexes
3. Read snapshot file
4. Parse and compare paths
5. Decide whether to index
```

**After (Server-side)**:
```python
# Agent just calls index_codebase (~50 tokens)
index_codebase(pwd)
# Server handles everything and returns result
```

**Savings**: ~350-850 tokens per session (85-90% reduction)

### User Experience
**Before**:
- User in subdirectory can't search parent code
- Must manually navigate to parent and re-index
- Confusing when search returns no results

**After**:
- Seamless search from any directory level
- Parent index automatically discovered
- Consistent behavior across sessions

### Performance
**Before**:
- Redundant indexing of same files
- Multiple indexes consume vector DB storage
- Sync overhead for overlapping directories

**After**:
- Single index per project
- Efficient storage utilization
- Unified sync coverage

### Maintenance
**Before**:
- Agent CLAUDE.md needs complex runtime logic
- Updates required on every MCP server change
- Inconsistent behavior across agent versions

**After**:
- Server knows its own index structure best
- Single source of truth
- Automatic benefit for all users

---

## 📊 Success Metrics

### Functional
- ✅ Subdirectory sessions reuse parent index
- ✅ New projects create new index (no false positives)
- ✅ Search results accessible from subdirectories
- ✅ No duplicate indexes for same codebase

### Performance
- ✅ Traversal completes <100ms (typical case)
- ✅ No slowdown for existing workflows
- ✅ Memory overhead <1MB per session

### Compatibility
- ✅ Windows paths handled correctly (drive roots)
- ✅ Unix paths handled correctly (/)
- ✅ macOS paths handled correctly
- ✅ Symlinks resolved properly
- ✅ Backward compatible (existing behavior when no parent)

### User Impact
- ✅ 85-90% token reduction in CLAUDE.md init protocol
- ✅ Improved UX (seamless subdirectory search)
- ✅ Reduced confusion (fewer duplicate indexes)

---

## 🔗 Related Work

### Similar Implementation: Serena MCP
Serena's `activate_project()` uses similar parent traversal:
1. Checks for `.serena/` directory
2. Falls back to `.git/` directory
3. Stops at filesystem root

**Lesson**: Consistent traversal logic across MCP servers improves agent reliability

### Inspiration: Git Repository Detection
Git's repository discovery algorithm:
1. Check current directory for `.git/`
2. Traverse upward until found or filesystem root
3. Cache result for performance

**Lesson**: Proven pattern for project boundary detection

---

## 🛡️ Risk Analysis

### Risk 1: Breaking Existing Workflows
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- Preserve existing behavior when no parent found
- Add `scope="local"` parameter for override
- Extensive testing with real codebases

### Risk 2: Cross-Platform Path Issues
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Use Node.js `path` module for platform abstraction
- Test on Windows, macOS, Linux
- Handle drive roots explicitly (Windows)

### Risk 3: Performance Degradation
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- Limit traversal to filesystem checks only (no heavy I/O)
- Consider caching traversal results (session-scoped)
- Benchmark before/after

### Risk 4: Symlink Confusion
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- Resolve symlinks using `fs.realpathSync()` before traversal
- Document behavior in edge cases

---

## 📝 Open Questions

### Technical
1. **Caching**: Should traversal results be cached per session? Per process?
   - **Pro**: Faster subsequent calls
   - **Con**: Memory overhead, invalidation complexity
   - **Decision**: TBD

2. **Snapshot metadata**: Should we store parent path in snapshot?
   - **Pro**: Faster lookups, explicit relationships
   - **Con**: More complex snapshot format
   - **Decision**: TBD

3. **Concurrent indexing**: If parent is indexing and subdirectory requested, should we wait or start subdirectory?
   - **Current**: Return parent status (don't start subdirectory)
   - **Alternative**: Queue subdirectory request
   - **Decision**: TBD

### User Experience
1. **Agent messaging**: Should agent inform user about parent reuse?
   - **Current**: Yes (message in response)
   - **Decision**: Finalize

2. **Search scoping**: Should search in subdirectory filter results to subdirectory?
   - **Current**: No (search entire parent index)
   - **Alternative**: Add optional path filtering
   - **Decision**: TBD (Phase 3)

---

## 🎓 Implementation Phases

See [IMPLEMENTATION_INDEX.md](IMPLEMENTATION_INDEX.md) for detailed phase breakdown:

1. **Phase 1**: Analysis & Design (estimate: 1 session)
2. **Phase 2**: Core Implementation (estimate: 2-3 sessions)
3. **Phase 3**: Integration & Testing (estimate: 1-2 sessions)
4. **Phase 4**: Documentation & Rollout (estimate: 1 session)

**Total Estimate**: 5-7 agent sessions

---

*This document provides complete context for agents implementing parent directory traversal. Read this first before starting any phase.*
