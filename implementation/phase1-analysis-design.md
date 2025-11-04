# Phase 1: Analysis & Design

**Status**: ✅ COMPLETED
**Started**: 2025-11-03
**Completed**: 2025-11-03
**Target Completion**: 1-1.5 sessions
**Actual Duration**: 1 session
**Overall Progress**: 100%
**Audit Status**: ✅ Updated per AUDIT_REPORT.md recommendations

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

### Task 1.0: Explore Codebase Structure
**Status**: 🟢 COMPLETED
**Estimated Time**: 30 minutes
**Progress**: 100%
**Added**: Per AUDIT_REPORT.md Gap 1
**Completed**: 2025-11-03

**Subtasks**:
- [x] List all files in packages/mcp/src/
- [x] Read handlers.ts structure (function overview using symbol tools)
- [x] Read snapshot.ts interface (SnapshotManager methods overview)
- [x] Read utils.ts current utilities overview
- [x] Read config.ts type definitions overview
- [x] Understand MCP response format conventions
- [x] Document file locations and sizes

**Deliverables**:
✅ **Codebase Structure Map**:
```
packages/mcp/src/
├── config.ts (224 lines) - Type definitions, config interfaces
├── embedding.ts - Embedding provider setup
├── handlers.ts (1,617 lines) - ToolHandlers class with all MCP tool implementations
├── index.ts - MCP server entry point, tool definitions
├── snapshot.ts (505 lines) - SnapshotManager class for state management
├── sync.ts - SyncManager for real-time filesystem sync
└── utils.ts (29 lines) - Utility functions (ensureAbsolutePath, trackCodebasePath, truncateContent)
```

✅ **Existing Utility Functions** (utils.ts):
- `ensureAbsolutePath(inputPath: string): string` - Converts relative to absolute paths using path.resolve()
- `trackCodebasePath(path: string): void` - Tracks codebase paths for syncing
- `truncateContent(content: string): string` - Truncates content for display

✅ **SnapshotManager API Surface** (key methods):
- `getIndexedCodebases(): string[]` - Returns array of indexed absolute paths
- `getIndexingCodebases(): string[]` - Returns array of currently indexing paths
- `getCodebaseStatus(path: string)` - Returns status: 'indexed' | 'indexing' | 'indexfailed' | 'not_found'
- `getCodebaseInfo(path: string)` - Returns CodebaseInfo object with metadata
- `setCodebaseIndexing(path: string, progress: number)` - Marks codebase as indexing
- `setCodebaseIndexed(path: string, fileCount: number)` - Marks codebase as indexed
- `saveCodebaseSnapshot()` - Persists snapshot to disk

✅ **Current handleIndexCodebase Flow** (handlers.ts:295-473):
See detailed analysis in Task 1.1 below.

✅ **MCP Response Format Template**:
```typescript
// Success response
{
    content: [{ type: "text", text: "message" }],
    isError?: false
}

// Error response
{
    content: [{ type: "text", text: "Error: message" }],
    isError: true
}
```

**Notes**:
- No test infrastructure exists yet (no __tests__ directories or *.test.ts files)
- Paths in snapshot are stored as absolute paths
- MCP tool definitions are in index.ts:86-344 (index_codebase at line 124)
- Current tool has 5 parameters: path, force, splitter, customExtensions, ignorePatterns
- ToolHandlers class has 24 methods including handleIndexCodebase

---

### Task 1.1: Analyze Current Implementation
**Status**: 🟢 COMPLETED
**Estimated Time**: 30 minutes
**Progress**: 100%
**Completed**: 2025-11-03

**Subtasks**:
- [x] Read `handleIndexCodebase` method completely (packages/mcp/src/handlers.ts)
- [x] Document current validation logic
- [x] Document current path resolution (ensureAbsolutePath)
- [x] Document current snapshot interaction
- [x] Identify insertion point for traversal logic
- [x] Map current error handling patterns

**Deliverables**:
✅ See detailed analysis in "Analysis Section" below with:
- Complete code flow diagram
- Integration points with line numbers
- Error handling patterns
- Risk assessment

**Notes**:
- Method is 178 lines (295-473)
- Well-structured with clear validation stages
- MCP error responses always return proper format (never throws)
- Background indexing pattern allows async operation

---

### Task 1.2: Design findParentIndex() Function
**Status**: 🟢 COMPLETED
**Estimated Time**: 45 minutes
**Progress**: 100%
**Completed**: 2025-11-03

**Subtasks**:
- [x] Design function signature
- [x] Design return type (TypeScript interface)
- [x] Plan traversal algorithm (pseudocode)
- [x] Plan cross-platform path handling (Windows/Unix)
- [x] Plan symlink resolution strategy
- [x] Plan filesystem root detection (per platform)
- [x] Plan .claude-context/ detection
- [x] Plan .git/ fallback detection
- [x] Design error handling strategy

**Deliverables**:
✅ Complete design in "Design Specification" section below including:
- Function signature with comprehensive JSDoc
- Detailed pseudocode with cross-platform considerations
- TypeScript interface definitions
- Edge case handling strategies
- Platform-specific root detection logic

**Notes**:
- Using Node.js `path` module for cross-platform abstraction
- Symlink resolution via `fs.realpathSync()` at function entry
- Strict detection hierarchy: .claude-context/ → snapshot → .git + snapshot
- Safety mechanisms: infinite loop prevention, max traversal depth

---

### Task 1.3: Define TypeScript Interfaces
**Status**: 🟢 COMPLETED
**Estimated Time**: 20 minutes
**Progress**: 100%
**Completed**: 2025-11-03

**Subtasks**:
- [x] Define `FindParentIndexResult` interface
- [x] Define `TraversalOptions` interface (not needed - using direct parameter)
- [x] Update MCP response metadata (add `_meta` field for parent info)
- [x] Define error types (using existing pattern - return strings)
- [x] Plan integration with existing types in config.ts

**Deliverables**:
✅ **FindParentIndexResult Interface** (utils.ts):
```typescript
/**
 * Result of parent index traversal.
 */
export interface FindParentIndexResult {
    /** Whether a parent index was found */
    found: boolean;

    /** Absolute path to the parent index (if found) */
    parentPath?: string;

    /** Reason for detection or failure */
    reason:
        | 'claude-context-dir'  // Found .claude-context/ directory
        | 'snapshot'             // Found in snapshot manager
        | 'git-boundary'         // Found .git/ + in snapshot
        | 'none';                // No parent found (reached filesystem root)
}
```

✅ **MCP Response Format** (no interface change needed):
```typescript
// Standard MCP response format (existing)
interface MCPResponse {
    content: Array<{ type: "text", text: string }>;
    isError?: boolean;
}

// Parent reuse response example (handlers.ts)
{
    content: [{
        type: "text",
        text: "Using parent index at '/parent/path'..."
    }],
    // Optional metadata for internal use
    _meta: {
        index_path: '/parent/path',
        status: 'indexed' | 'indexing' | 'indexfailed',
        reused: true,
        reason: 'claude-context-dir' | 'snapshot' | 'git-boundary'
    }
}
```

✅ **Helper Function Types** (utils.ts):
```typescript
/**
 * Check if a path is a filesystem root.
 */
function isFilesystemRoot(dirPath: string): boolean;

/**
 * Normalize path for cross-platform comparison.
 */
function normalizePath(filePath: string): string;
```

**Notes**:
- No new config.ts types needed - using existing CodebaseInfo types
- MCP response stays backward compatible (text-based)
- Optional `_meta` field for internal metadata (not exposed to MCP schema)
- Error handling uses existing pattern (string messages, no new types)

---

### Task 1.4: Plan SnapshotManager Integration
**Status**: 🟢 COMPLETED
**Estimated Time**: 30 minutes
**Progress**: 100%
**Completed**: 2025-11-03

**Subtasks**:
- [x] Review SnapshotManager methods for checking indexed paths
- [x] **VERIFY**: getIndexedCodebases() returns absolute paths
- [x] **VERIFY**: Paths are normalized (forward slashes vs backslashes)
- [x] **VERIFY**: Check if paths have trailing slashes
- [x] **DETERMINE**: Path comparison strategy (exact match vs normalized)
- [x] Design query method for parent detection (not needed - use getIndexedCodebases())
- [x] Plan snapshot metadata updates (not needed for v0.2.0)
- [x] Document v2 format compatibility requirements
- [x] Plan any new snapshot methods needed (none required)

**Deliverables**:

✅ **Verification Results**:

1. **Path Format**: ✅ **CONFIRMED - Absolute paths**
   - `getIndexedCodebases()` returns `string[]` of absolute paths
   - Paths stored via `addIndexedCodebase(codebasePath: string)`
   - All paths go through `ensureAbsolutePath()` before storage
   - Example: `C:\Projects\app` or `/home/user/project`

2. **Path Normalization**: ⚠️ **NOT NORMALIZED in snapshot**
   - Paths stored AS-IS from `ensureAbsolutePath()`
   - Windows: May contain backslashes (`C:\Projects\app`)
   - Unix: Forward slashes (`/home/user/project`)
   - **ACTION REQUIRED**: `findParentIndex()` must normalize for comparison

3. **Trailing Slashes**: ✅ **No trailing slashes**
   - `path.resolve()` in `ensureAbsolutePath()` removes trailing slashes
   - Exception: Root directories may vary by platform
   - **ACTION**: `normalizePath()` helper handles this

4. **Path Comparison Strategy**: ✅ **DECISION: Normalized comparison**
   - Use `normalizePath()` helper for cross-platform comparison
   - Windows: Lowercase + forward slashes
   - Unix: As-is (case-sensitive)
   - See Task 1.2 Design Specification for implementation

✅ **Integration Plan**:

**No SnapshotManager Changes Required**:
- ✅ Existing `getIndexedCodebases()` method is sufficient
- ✅ Existing `getCodebaseStatus()` method works for parent status
- ✅ Existing `getCodebaseInfo()` method provides metadata
- ✅ No new methods needed for v0.2.0

**Usage Pattern** in `handleIndexCodebase`:
```typescript
// Get list of indexed codebases
const indexedCodebases = this.snapshotManager.getIndexedCodebases();

// Call traversal function
const parentResult = findParentIndex(absolutePath, this.snapshotManager);

if (parentResult.found) {
    // Get parent status and info
    const parentStatus = this.snapshotManager.getCodebaseStatus(parentResult.parentPath);
    const parentInfo = this.snapshotManager.getCodebaseInfo(parentResult.parentPath);

    // Return parent index response
    return { /* MCP response */ };
}
```

✅ **V2 Format Compatibility**:
- Snapshot format is dual-format (V1 and V2)
- `getIndexedCodebases()` handles both formats transparently
- V1: Returns `snapshot.indexedCodebases` array
- V2: Filters `snapshot.codebases` by `status === 'indexed'`
- No migration needed - parent traversal works with both formats

✅ **Snapshot Metadata Updates**:
- **OUT OF SCOPE for v0.2.0**: Storing parent relationships in snapshot
- **RATIONALE**: Traversal is fast (<100ms), no caching needed
- **FUTURE**: Could add `parentPath` field to V3 format if performance becomes issue

**Notes**:
- SnapshotManager is read-only for parent detection (no state changes)
- Path comparison must handle cross-platform differences (Windows vs Unix)
- V2 format already stores rich metadata (status, progress, fileCount)
- Parent detection is stateless - no snapshot persistence required

---

### Task 1.5: Design MCP Tool Parameter Changes
**Status**: 🟢 COMPLETED
**Estimated Time**: 20 minutes
**Progress**: 100%
**Completed**: 2025-11-03

**Subtasks**:
- [x] Design `scope` parameter ("auto" | "local")
- [x] Update tool description text
- [x] Plan parameter validation logic
- [x] Design user-facing messages for each scenario
- [x] Plan backward compatibility (default values)

**Deliverables**:

✅ **Updated Tool Definition** (index.ts:124-163):

```typescript
{
    name: "index_codebase",
    description: `
Index a codebase directory to enable semantic search using a configurable code splitter.

⚠️ **IMPORTANT**:
- You MUST provide an absolute path to the target codebase.

✨ **Parent Directory Detection**:
- By default, checks for existing parent directory indexes to avoid duplicates
- If a parent index is found, returns the parent index instead of creating a new one
- Use scope="local" to force indexing only the specified directory

✨ **Usage Guidance**:
- This tool is typically used when search fails due to an unindexed codebase.
- If indexing is attempted on an already indexed path, and a conflict is detected, you MUST prompt the user to confirm whether to proceed with a force index (i.e., re-indexing and overwriting the previous index).
`,
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "ABSOLUTE path to the codebase directory to index."
            },
            force: {
                type: "boolean",
                description: "Force re-indexing even if already indexed. Skips parent directory detection.",
                default: false
            },
            scope: {
                type: "string",
                enum: ["auto", "local"],
                description: "Indexing scope: 'auto' (default) enables parent directory detection, 'local' indexes only the specified directory",
                default: "auto"
            },
            splitter: {
                type: "string",
                description: "Code splitter to use: 'ast' for syntax-aware splitting with automatic fallback, 'langchain' for character-based splitting",
                enum: ["ast", "langchain"],
                default: "ast"
            },
            customExtensions: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "Optional: Additional file extensions to include beyond defaults (e.g., ['.vue', '.svelte', '.astro']). Extensions should include the dot prefix or will be automatically added",
                default: []
            },
            ignorePatterns: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "Optional: Additional ignore patterns to exclude specific files/directories beyond defaults. Only include this parameter if the user explicitly requests custom ignore patterns (e.g., ['static/**', '*.tmp', 'private/**'])",
                default: []
            }
        },
        required: ["path"]
    }
}
```

✅ **Parameter Validation Logic** (handlers.ts):

```typescript
// Extract parameters with defaults
const { path, force, scope, splitter, customExtensions, ignorePatterns } = args;
const forceReindex = force || false;
const indexScope = scope || 'auto';
const splitterType = splitter || 'ast';
const customFileExtensions = customExtensions || [];
const customIgnorePatterns = ignorePatterns || [];

// Validate scope parameter
if (indexScope !== 'auto' && indexScope !== 'local') {
    return {
        content: [{
            type: "text",
            text: `Error: Invalid scope parameter '${indexScope}'. Must be 'auto' or 'local'.`
        }],
        isError: true
    };
}

// Existing validation continues...
```

✅ **User-Facing Messages by Scenario**:

| Scenario | Message |
|----------|---------|
| **Parent found (indexed)** | `Using parent index at '${parentPath}' (detected via ${reason}).\n\nStatus: indexed\nYou can search from this subdirectory - results will include the entire parent codebase.\n\nTo index this directory separately, use scope="local".` |
| **Parent found (indexing)** | `Parent index at '${parentPath}' is currently indexing (${progress}% complete).\n\nYou can start searching now, but results may be incomplete until indexing completes.\n\nTo index this directory separately, use scope="local".` |
| **Parent found (failed)** | `Parent index at '${parentPath}' failed previously.\n\nProceeding to index '${requestedPath}' separately.\n\n(To retry parent index, run: index_codebase path="${parentPath}" force=true)` |
| **No parent found** | `Started background indexing for codebase '${absolutePath}' using ${splitterType.toUpperCase()} splitter.\n\nIndexing is running in the background...` (existing message) |
| **scope="local"** | `Started background indexing for codebase '${absolutePath}' (scope: local) using ${splitterType.toUpperCase()} splitter.\n\nParent directory detection was skipped. Indexing is running in the background...` |
| **force=true** | `Started background indexing...` (existing message - skips parent detection) |

✅ **Backward Compatibility**:
- ✅ **scope parameter optional**: Defaults to "auto"
- ✅ **No breaking changes**: Existing calls work unchanged
- ✅ **force=true behavior preserved**: Skips parent detection entirely
- ✅ **Response format unchanged**: Still returns MCP-compliant text response

**Interaction Matrix**:

| force | scope | Behavior |
|-------|-------|----------|
| false | "auto" (default) | ✅ Parent detection enabled |
| false | "local" | ✅ Skip parent detection, index locally |
| true | "auto" | ✅ Skip parent detection, force re-index |
| true | "local" | ✅ Skip parent detection, force re-index |

**Notes**:
- `force=true` takes precedence (always skips traversal)
- `scope="local"` is explicit user intent to index subdirectory
- Default behavior (`scope="auto"`) enables smart parent detection
- All existing agent code continues to work (backward compatible)

---

### Task 1.6: Create Implementation Specification
**Status**: 🟢 COMPLETED
**Estimated Time**: 30 minutes
**Progress**: 100%
**Completed**: 2025-11-03

**Subtasks**:
- [x] Write detailed spec for findParentIndex()
- [x] Write detailed spec for handleIndexCodebase modifications
- [x] Document all edge cases and handling
- [x] Create decision tree diagram (text-based)
- [x] Document test scenarios
- [x] Define success criteria

**Deliverables**:
✅ **Complete Implementation Specification**:
- See "Design Specification" section below for full details
- See "Implementation Decision Tree" section below
- See "Test Scenario Matrix" section below
- See "Edge Case Handling Guide" section below

**Notes**:
- Specification is ready for Phase 2 implementation
- All design decisions documented and justified
- Cross-platform considerations fully addressed
- Backward compatibility verified

---

## 📊 Analysis Section

### Current handleIndexCodebase Flow

**Complete Flow** (handlers.ts:295-473):

```
1. Parameter extraction and defaults (296-301)
   - path (codebasePath), force, splitter, customExtensions, ignorePatterns
   - Defaults: force=false, splitter='ast', customExtensions=[], ignorePatterns=[]

2. Sync indexed codebases from cloud (304)
   - await this.syncIndexedCodebasesFromCloud()

3. Validate splitter parameter (307-315)
   - Must be 'ast' or 'langchain'
   - Return error if invalid

4. Path resolution (317)
   - absolutePath = ensureAbsolutePath(codebasePath)
   - Converts relative paths to absolute using path.resolve()

5. Validate path exists (320-327)
   - fs.existsSync(absolutePath)
   - Return error if path doesn't exist

6. Validate is directory (330-336)
   - fs.statSync(absolutePath).isDirectory()
   - Return error if not a directory

7. Check if already indexing (339-346)
   - this.snapshotManager.getIndexingCodebases().includes(absolutePath)
   - Return error if already indexing (don't start duplicate)

8. Validate snapshot/cloud sync (349-351)
   - Warn if snapshot and cloud index mismatch

9. Check if already indexed (354-360)
   - this.snapshotManager.getIndexedCodebases().includes(absolutePath)
   - Return error unless force=true
   - **🎯 PARENT TRAVERSAL INSERTION POINT: Insert AFTER line 360, BEFORE force handling**

10. Force re-index handling (363-374)
    - If force=true: remove from snapshot + clear cloud index

11. Collection limit validation (377-398)
    - this.context.getVectorDatabase().checkCollectionLimit()
    - Return COLLECTION_LIMIT_MESSAGE if limit exceeded
    - Critical pre-indexing check

12. Add custom extensions (401-405)
    - this.context.addCustomExtensions(customFileExtensions)

13. Add custom ignore patterns (408-412)
    - this.context.addCustomIgnorePatterns(customIgnorePatterns)

14. Log retry status if previously failed (415-419)
    - Check if currentStatus === 'indexfailed'

15. Set indexing status (422-423)
    - this.snapshotManager.setCodebaseIndexing(absolutePath, 0)
    - this.snapshotManager.saveCodebaseSnapshot()

16. Track codebase path (426)
    - trackCodebasePath(absolutePath)

17. Start background indexing (429)
    - this.startBackgroundIndexing(absolutePath, forceReindex, splitterType)
    - Non-blocking, runs in background

18. Build response message (431-444)
    - Include path info, extension info, ignore info

19. Return success response (446-452)
    - MCP format: { content: [{ type: "text", text: "..." }] }

20. Error handling (454-472)
    - Catch all errors, never throw
    - Always return MCP-compliant error response
```

**Key Integration Points**:
- **Line 317**: Path resolution (ensureAbsolutePath) - ✅ Keep as-is
- **Line 354-360**: Already indexed check - 🎯 **INSERT PARENT TRAVERSAL HERE**
  - Insert after line 360, before force handling
  - New logic: If not force and not already indexed, check for parent index
  - If parent found, return parent status instead of error
- **Line 363**: Force re-index handling - ✅ Keep as-is (skips traversal when force=true)
- **Line 446**: Return response - Modify to include `reused: boolean` flag

**Proposed Insertion Logic** (pseudocode at line 360):
```typescript
// After line 360 (already indexed check)
// Before line 363 (force reindex handling)

// NEW CODE: Parent directory traversal
if (!forceReindex && !this.snapshotManager.getIndexedCodebases().includes(absolutePath)) {
    // Check for optional scope parameter (future: add to args)
    const scope = args.scope || 'auto';

    if (scope === 'auto') {
        // Traverse upward to find parent index
        const parentResult = findParentIndex(absolutePath, this.snapshotManager);

        if (parentResult.found) {
            // Parent index exists - return parent status
            const parentStatus = this.snapshotManager.getCodebaseStatus(parentResult.parentPath);
            const parentInfo = this.snapshotManager.getCodebaseInfo(parentResult.parentPath);

            return {
                content: [{
                    type: "text",
                    text: `Using parent index at '${parentResult.parentPath}' (reason: ${parentResult.reason}).\n\nStatus: ${parentStatus}\nYou can search from this subdirectory - results will include the entire parent codebase.`
                }],
                // Include metadata for agent decision-making
                _meta: {
                    index_path: parentResult.parentPath,
                    status: parentStatus,
                    reused: true,
                    reason: parentResult.reason
                }
            };
        }
        // No parent found - continue with normal indexing flow
    }
    // scope === 'local' - skip traversal, continue with normal indexing
}
```

**Current Error Handling Patterns**:
1. **Validation errors**: Return immediately with descriptive message
   - Example: `Error: Path '${absolutePath}' does not exist.`
   - Always include `isError: true` flag

2. **State errors**: Check before proceeding
   - Example: Already indexing, already indexed (without force)
   - Return user-actionable messages

3. **System errors**: Try-catch wrapper (454-472)
   - Logs error: `console.error('Error in handleIndexCodebase:', error)`
   - Returns sanitized message: `Error starting indexing: ${error.message || error}`
   - Never throws to MCP client

4. **MCP format**: All responses follow format
   ```typescript
   {
       content: [{ type: "text", text: "message" }],
       isError?: boolean
   }
   ```

**Risk Assessment for Parent Traversal Changes**:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing workflows | Low | High | Insert after existing checks; only activate when no conflict |
| Performance degradation | Low | Medium | Traversal is lightweight (filesystem checks only, no I/O) |
| Cross-platform path issues | Medium | High | Use Node.js `path` module; test on Windows/macOS/Linux |
| Infinite loop in traversal | Low | High | Add safety check: `if (parent === current) break` |
| False positive parent detection | Low | Medium | Strict detection criteria (.claude-context/ + snapshot) |
| Race condition (parent indexing) | Low | Low | Return parent status (including 'indexing'), don't block |

**Integration Safety**:
- ✅ Insertion point is after all validation (safe to traverse)
- ✅ Only executes when `!force && !alreadyIndexed` (narrow scope)
- ✅ Falls through to normal flow if no parent found
- ✅ Respects force flag (skips traversal entirely)
- ✅ Returns same MCP response format

---

## 📐 Design Specification

### findParentIndex() Detailed Spec

**Function Signature with JSDoc** (to be added to utils.ts):

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { SnapshotManager } from './snapshot';

/**
 * Traverse upward from a given path to find an existing parent index.
 *
 * This function performs filesystem traversal to detect if a parent directory
 * has already been indexed, allowing subdirectories to reuse parent indexes
 * instead of creating duplicate indexes.
 *
 * Detection priority (checked at each level):
 * 1. .claude-context/ directory exists (most reliable indicator)
 * 2. Path is in snapshot manager's indexed codebases list
 * 3. .git/ directory exists AND path is in snapshot (project boundary heuristic)
 * 4. Filesystem root reached (stop condition)
 *
 * Cross-platform support:
 * - Windows: Handles drive roots (C:\), UNC paths (\\server\share)
 * - Unix/Linux/macOS: Handles root (/)
 * - Resolves symlinks to real paths before traversal
 * - Uses Node.js path module for platform abstraction
 *
 * @param startPath - Absolute path to start traversal from (must be absolute)
 * @param snapshotManager - SnapshotManager instance for checking indexed paths
 * @returns FindParentIndexResult object with detection details
 *
 * @throws Never throws - returns { found: false } on errors
 *
 * @example
 * // Finds parent index via .claude-context/ directory
 * const result = findParentIndex('/home/user/project/src/components', snapshotMgr);
 * // { found: true, parentPath: '/home/user/project', reason: 'claude-context-dir' }
 *
 * // Finds parent index via snapshot
 * const result = findParentIndex('C:\\Projects\\app\\lib', snapshotMgr);
 * // { found: true, parentPath: 'C:\\Projects\\app', reason: 'snapshot' }
 *
 * // No parent found
 * const result = findParentIndex('/unrelated/path', snapshotMgr);
 * // { found: false, reason: 'none' }
 *
 * // Parent currently indexing
 * const result = findParentIndex('/project/subdir', snapshotMgr);
 * // { found: true, parentPath: '/project', reason: 'claude-context-dir' }
 * // (caller should check status via snapshotManager.getCodebaseStatus())
 */
export function findParentIndex(
    startPath: string,
    snapshotManager: SnapshotManager
): FindParentIndexResult {
    // Implementation to be written in Phase 2
}

/**
 * Result of parent index traversal.
 */
export interface FindParentIndexResult {
    /** Whether a parent index was found */
    found: boolean;

    /** Absolute path to the parent index (if found) */
    parentPath?: string;

    /** Reason for detection or failure */
    reason:
        | 'claude-context-dir'  // Found .claude-context/ directory
        | 'snapshot'             // Found in snapshot manager
        | 'git-boundary'         // Found .git/ + in snapshot
        | 'none';                // No parent found (reached filesystem root)
}
```

**Detailed Algorithm Pseudocode**:

```typescript
function findParentIndex(startPath: string, snapshotManager: SnapshotManager): FindParentIndexResult {
    // === PHASE 1: Input validation and symlink resolution ===

    // Validate startPath is absolute
    if (!path.isAbsolute(startPath)) {
        console.warn(`[PARENT-TRAVERSAL] startPath must be absolute: ${startPath}`);
        return { found: false, reason: 'none' };
    }

    // Resolve symlinks to real path (handles symlinks, junctions on Windows)
    let realPath: string;
    try {
        realPath = fs.realpathSync(startPath);
    } catch (error) {
        // If path doesn't exist or can't be resolved, can't traverse
        console.warn(`[PARENT-TRAVERSAL] Cannot resolve path: ${startPath}`, error);
        return { found: false, reason: 'none' };
    }

    // === PHASE 2: Traversal setup ===

    let current = realPath;
    let depth = 0;
    const MAX_DEPTH = 100; // Safety limit to prevent infinite loops

    // Get indexed codebases list once (performance optimization)
    const indexedCodebases = snapshotManager.getIndexedCodebases();

    // Normalize paths for comparison (Windows: case-insensitive, forward slashes)
    const normalizedIndexed = indexedCodebases.map(p => normalizePath(p));

    // === PHASE 3: Upward traversal ===

    while (depth < MAX_DEPTH) {
        // === CHECK 1: Reached filesystem root? ===
        if (isFilesystemRoot(current)) {
            // Reached root without finding parent
            return { found: false, reason: 'none' };
        }

        // === CHECK 2: .claude-context/ directory exists? ===
        const claudeContextDir = path.join(current, '.claude-context');
        try {
            if (fs.existsSync(claudeContextDir) && fs.statSync(claudeContextDir).isDirectory()) {
                // Found .claude-context/ directory
                console.log(`[PARENT-TRAVERSAL] ✓ Found parent via .claude-context/: ${current}`);
                return {
                    found: true,
                    parentPath: current,
                    reason: 'claude-context-dir'
                };
            }
        } catch (error) {
            // Ignore permission errors, continue traversal
            console.debug(`[PARENT-TRAVERSAL] Cannot check .claude-context/ at ${current}`);
        }

        // === CHECK 3: Path in snapshot? ===
        const normalizedCurrent = normalizePath(current);
        if (normalizedIndexed.includes(normalizedCurrent)) {
            // Found in snapshot
            console.log(`[PARENT-TRAVERSAL] ✓ Found parent via snapshot: ${current}`);
            return {
                found: true,
                parentPath: current,
                reason: 'snapshot'
            };
        }

        // === CHECK 4: .git/ directory + snapshot? ===
        const gitDir = path.join(current, '.git');
        try {
            if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
                // Git boundary found, check if in snapshot
                if (normalizedIndexed.includes(normalizedCurrent)) {
                    console.log(`[PARENT-TRAVERSAL] ✓ Found parent via .git boundary: ${current}`);
                    return {
                        found: true,
                        parentPath: current,
                        reason: 'git-boundary'
                    };
                }
                // Git dir exists but not indexed - continue traversal
                console.debug(`[PARENT-TRAVERSAL] Found .git/ at ${current} but not indexed`);
            }
        } catch (error) {
            // Ignore permission errors, continue traversal
            console.debug(`[PARENT-TRAVERSAL] Cannot check .git/ at ${current}`);
        }

        // === STEP UP: Move to parent directory ===
        const parent = path.dirname(current);

        // Safety check: prevent infinite loop
        if (parent === current) {
            console.warn(`[PARENT-TRAVERSAL] Reached root (parent === current): ${current}`);
            return { found: false, reason: 'none' };
        }

        current = parent;
        depth++;
    }

    // === SAFETY: Max depth exceeded ===
    console.warn(`[PARENT-TRAVERSAL] Max depth (${MAX_DEPTH}) exceeded, stopping traversal`);
    return { found: false, reason: 'none' };
}

// === HELPER FUNCTIONS ===

/**
 * Check if a path is a filesystem root.
 *
 * Platform-specific detection:
 * - Unix/Linux/macOS: path === '/'
 * - Windows: path matches drive root (C:\) or UNC root (\\server\share)
 */
function isFilesystemRoot(dirPath: string): boolean {
    // Unix/Linux/macOS: root is '/'
    if (dirPath === '/') {
        return true;
    }

    // Windows: check for drive root or UNC root
    if (process.platform === 'win32') {
        // Drive root: C:\, D:\, etc.
        if (/^[A-Za-z]:\\?$/.test(dirPath)) {
            return true;
        }

        // UNC root: \\server\share or \\server\share\
        if (/^\\\\[^\\]+\\[^\\]+\\?$/.test(dirPath)) {
            return true;
        }
    }

    // Check if parent is same as current (generic check)
    const parent = path.dirname(dirPath);
    return parent === dirPath;
}

/**
 * Normalize path for cross-platform comparison.
 *
 * - Windows: Convert to lowercase, use forward slashes, remove trailing slash
 * - Unix: Use as-is, remove trailing slash
 *
 * This ensures consistent path comparison across platforms.
 */
function normalizePath(filePath: string): string {
    let normalized = filePath;

    // Windows: case-insensitive filesystem
    if (process.platform === 'win32') {
        normalized = normalized.toLowerCase();
        // Convert backslashes to forward slashes for consistency
        normalized = normalized.replace(/\\/g, '/');
    }

    // Remove trailing slash (except for roots)
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
}
```

**Cross-Platform Considerations**:

| Platform | Root Detection | Path Normalization | Notes |
|----------|---------------|-------------------|-------|
| **Windows** | `C:\`, `D:\`, `\\server\share` | Lowercase, forward slashes | Case-insensitive filesystem |
| **Unix/Linux** | `/` | As-is | Case-sensitive filesystem |
| **macOS** | `/` | As-is | Case-insensitive by default (varies) |

**Symlink Handling**:
- ✅ Use `fs.realpathSync()` at function entry
- ✅ Resolves symbolic links to actual paths
- ✅ Handles junction points on Windows
- ✅ Prevents traversal confusion when symlinks point outside project

**Edge Cases Handled**:
1. **Symlink to subdirectory**: Resolves to real path before traversal
2. **Permission errors**: Catches and continues traversal (logs debug message)
3. **Infinite loop**: Safety checks (max depth, parent === current)
4. **Path doesn't exist**: Early return { found: false }
5. **UNC paths (Windows)**: Properly detects `\\server\share` as root
6. **Mixed case paths (Windows)**: Normalizes to lowercase for comparison
7. **Trailing slashes**: Normalized before comparison

**Performance Characteristics**:
- **Typical depth**: 2-5 levels (most projects)
- **Max depth**: 100 levels (safety limit)
- **Filesystem operations per level**: 2-3 (existsSync + statSync)
- **Estimated time**: <100ms for typical case, <500ms worst case

---

### Implementation Decision Tree

**Complete Flow for index_codebase(path, force, scope)**:

```
START: index_codebase(path, force=false, scope="auto")
│
├─ Extract parameters & set defaults
├─ Sync indexed codebases from cloud
├─ Validate splitter parameter
├─ Validate scope parameter (NEW)
│   ├─ Valid: "auto" or "local"
│   └─ Invalid: Return error "Invalid scope..."
│
├─ Resolve to absolute path (ensureAbsolutePath)
├─ Validate path exists & is directory
├─ Check if already indexing → Error if true
├─ Validate snapshot/cloud sync
│
├─ Check if already indexed
│   ├─ Already indexed & !force
│   │   └─ Return error "Already indexed. Use force=true..."
│   └─ Continue to parent traversal check
│
├─ 🎯 PARENT TRAVERSAL CHECK (NEW LOGIC)
│   │
│   ├─ Skip traversal if:
│   │   ├─ force=true → Skip (go to Force Re-index)
│   │   └─ scope="local" → Skip (go to Normal Indexing)
│   │
│   ├─ Perform traversal if scope="auto" && !force
│   │   │
│   │   ├─ Call findParentIndex(absolutePath, snapshotManager)
│   │   │
│   │   ├─ Parent FOUND?
│   │   │   ├─ Get parent status & info
│   │   │   │
│   │   │   ├─ Parent status = "indexed"
│   │   │   │   └─ Return "Using parent index at..." ✅ END
│   │   │   │
│   │   │   ├─ Parent status = "indexing"
│   │   │   │   └─ Return "Parent index is currently indexing..." ✅ END
│   │   │   │
│   │   │   └─ Parent status = "indexfailed"
│   │   │       └─ Log warning, proceed to Normal Indexing
│   │   │
│   │   └─ Parent NOT FOUND?
│   │       └─ Proceed to Normal Indexing
│   │
│   └─ Continue to next step
│
├─ Force Re-index Handling (if force=true)
│   ├─ Remove from indexed list
│   └─ Clear cloud index
│
├─ Collection Limit Validation
│   └─ Return error if limit exceeded
│
├─ Add custom extensions & ignore patterns
├─ Log retry status if previously failed
├─ Set indexing status in snapshot
├─ Track codebase path
│
├─ Start Background Indexing
│   └─ Non-blocking, runs in background
│
└─ Return success response ✅ END
```

**Traversal Sub-Flow** (findParentIndex):

```
findParentIndex(startPath, snapshotManager)
│
├─ Validate startPath is absolute
│   └─ Not absolute? → Return { found: false }
│
├─ Resolve symlinks to real path (fs.realpathSync)
│   └─ Error? → Return { found: false }
│
├─ Initialize traversal (depth=0, MAX_DEPTH=100)
├─ Get indexed codebases list
├─ Normalize paths for comparison
│
├─ LOOP: While depth < MAX_DEPTH
│   │
│   ├─ Is filesystem root?
│   │   └─ Yes → Return { found: false, reason: 'none' }
│   │
│   ├─ Check #1: .claude-context/ exists?
│   │   └─ Yes → Return { found: true, parentPath, reason: 'claude-context-dir' } ✅
│   │
│   ├─ Check #2: Path in snapshot?
│   │   └─ Yes → Return { found: true, parentPath, reason: 'snapshot' } ✅
│   │
│   ├─ Check #3: .git/ exists AND in snapshot?
│   │   └─ Yes → Return { found: true, parentPath, reason: 'git-boundary' } ✅
│   │
│   ├─ Move up one level (parent = path.dirname(current))
│   ├─ Safety: parent === current?
│   │   └─ Yes → Return { found: false, reason: 'none' }
│   │
│   └─ depth++, current = parent, continue loop
│
└─ Max depth exceeded → Return { found: false, reason: 'none' }
```

---

### Test Scenario Matrix

**Unit Tests** (findParentIndex):

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| 1 | Parent with .claude-context/ | `/project/src`, parent has `/.claude-context/` | `{ found: true, parentPath: '/project', reason: 'claude-context-dir' }` |
| 2 | Parent in snapshot only | `/project/src`, parent in snapshot | `{ found: true, parentPath: '/project', reason: 'snapshot' }` |
| 3 | Parent with .git + snapshot | `/project/src`, parent has `/.git/` + in snapshot | `{ found: true, parentPath: '/project', reason: 'git-boundary' }` |
| 4 | No parent found | `/unrelated/path` | `{ found: false, reason: 'none' }` |
| 5 | Symlink resolution | `/link/to/project/src` (symlink) | Resolves to real path, then finds parent |
| 6 | Windows drive root | `C:\project` (no parent) | `{ found: false, reason: 'none' }` |
| 7 | Unix root | `/project` (no parent) | `{ found: false, reason: 'none' }` |
| 8 | UNC path root | `\\server\share\project` (no parent) | `{ found: false, reason: 'none' }` |
| 9 | Nested .git repos | `parent/.git` indexed, `parent/sub/.git` | Finds nearest `.claude-context/` or indexed path |
| 10 | Path doesn't exist | `/nonexistent/path` | `{ found: false, reason: 'none' }` |
| 11 | Permission error | `/restricted/path` | Catches error, returns `{ found: false }` |
| 12 | Max depth safety | Deep path (>100 levels) | `{ found: false, reason: 'none' }` after limit |

**Integration Tests** (handleIndexCodebase):

| # | Scenario | Parameters | Expected Behavior |
|---|----------|------------|-------------------|
| 13 | Parent indexed, scope=auto | `path=/project/src, force=false, scope=auto` | Returns "Using parent index at /project" |
| 14 | Parent indexing, scope=auto | `path=/project/src` (parent indexing) | Returns "Parent index is currently indexing..." |
| 15 | Parent failed, scope=auto | `path=/project/src` (parent failed) | Logs warning, proceeds to index /project/src |
| 16 | No parent, scope=auto | `path=/new/project` | Starts indexing /new/project |
| 17 | Force=true skips traversal | `path=/project/src, force=true` | Skips parent detection, force re-indexes |
| 18 | scope=local skips traversal | `path=/project/src, scope=local` | Skips parent detection, indexes locally |
| 19 | scope=invalid | `path=/project, scope=invalid` | Returns error "Invalid scope..." |
| 20 | Backward compatibility | `path=/project` (no scope param) | Defaults to scope=auto, works as expected |

**Cross-Platform Tests**:

| # | Scenario | Platform | Expected Behavior |
|---|----------|----------|-------------------|
| 21 | Windows path normalization | Windows | `C:\Project` matches `c:\project` in snapshot |
| 22 | Unix path case-sensitivity | Unix | `/Project` does NOT match `/project` |
| 23 | Windows backslashes | Windows | `C:\project\src` normalized to `c:/project/src` |
| 24 | Windows UNC path | Windows | `\\server\share` detected as root |
| 25 | macOS case handling | macOS | Depends on filesystem (usually case-insensitive) |
| 26 | Symlink traversal (Unix) | Unix | Resolves symlink before traversal |
| 27 | Junction traversal (Windows) | Windows | Resolves junction before traversal |

**Edge Case Tests**:

| # | Scenario | Description | Expected Behavior |
|---|----------|-------------|-------------------|
| 28 | Multiple nested parents | `/p1/.claude-context/`, `/p1/p2/.claude-context/` | Finds nearest parent (p2) |
| 29 | Git submodule | Parent has .git, submodule has .git | Traverses upward if submodule not indexed |
| 30 | Real-time sync active | Parent has sync enabled | Returns parent, sync covers subdirectory |
| 31 | Concurrent parent indexing | Request subdirectory while parent indexing | Returns parent status (indexing) |
| 32 | Trailing slash in path | `/project/src/` vs `/project/src` | Normalized, matches correctly |
| 33 | Mixed case (Windows) | `C:\Project\SRC` vs `c:\project\src` | Normalized to lowercase, matches |
| 34 | .git file (not directory) | `.git` is a file (Git worktree) | Skips, continues traversal |
| 35 | Empty .claude-context/ | Directory exists but empty | Still detected as parent |

---

### Edge Case Handling Guide

**1. Symlink Confusion**:
- **Issue**: Symlink points outside project hierarchy
- **Handling**: Resolve with `fs.realpathSync()` at function entry
- **Example**: `/project/link → /other/location` resolves to `/other/location` before traversal

**2. Permission Errors**:
- **Issue**: Cannot read directory during traversal
- **Handling**: Catch error, log debug message, continue traversal
- **Impact**: May miss parent index if permission denied at parent level

**3. Infinite Loop**:
- **Issue**: Circular symlinks or filesystem anomalies
- **Handling**: Two safety checks:
  - Max depth limit (100 levels)
  - Parent === current check
- **Impact**: Returns `{ found: false }` instead of hanging

**4. Case Sensitivity**:
- **Issue**: Windows case-insensitive, Unix case-sensitive
- **Handling**: `normalizePath()` helper
  - Windows: Lowercase all paths
  - Unix: Keep as-is
- **Impact**: Correct matching across platforms

**5. Parent Indexing In Progress**:
- **Issue**: Parent is currently being indexed
- **Handling**: Return parent status with progress percentage
- **Impact**: Agent can search parent (partial results) or wait

**6. Parent Index Failed**:
- **Issue**: Parent index failed previously
- **Handling**: Log warning, proceed to index subdirectory
- **Rationale**: Subdirectory might succeed where parent failed
- **User message**: Suggest retrying parent with force=true

**7. Nested Git Repositories**:
- **Issue**: Submodules or monorepo structure
- **Handling**: Prefer .claude-context/ over .git/, continue upward
- **Impact**: Finds actual indexed parent, not just .git boundary

**8. UNC Paths (Windows)**:
- **Issue**: `\\server\share` network paths
- **Handling**: Regex detection in `isFilesystemRoot()`
- **Impact**: Correct root detection, no false parent matches

**9. Git Worktree (.git file)**:
- **Issue**: .git is a file, not directory (Git worktree feature)
- **Handling**: `fs.statSync().isDirectory()` check
- **Impact**: Skips .git file, continues traversal

**10. Empty .claude-context/**:
- **Issue**: Directory exists but contains no files
- **Handling**: Existence check only (not content check)
- **Rationale**: Directory presence indicates indexing was attempted
- **Impact**: Treated as valid parent indicator

---

## ✅ Phase Completion Criteria

- [x] All tasks marked 🟢 COMPLETED
- [x] Complete implementation specification written
- [x] All TypeScript interfaces defined
- [x] Integration points documented
- [x] Edge cases catalogued with handling plans
- [x] Test scenarios matrix created (35 scenarios)
- [x] Ready to begin Phase 2 (implementation)

**Phase 1 Status**: ✅ **COMPLETE** (2025-11-03)
**Next Phase**: Phase 2 - Core Implementation

---

## 🚧 Blockers & Questions

### Current Blockers
_None yet - add as discovered_

### Open Questions

1. ~~Should we cache traversal results in memory?~~ **RESOLVED**
   - **Context**: Repeated calls for same path
   - **Impact**: Performance vs memory trade-off
   - **Decision**: ✅ **NO caching in v0.2.0** (Per audit recommendations - traversal is fast enough <100ms, keep simple. Future enhancement if needed.)

2. Should snapshot store parent relationships?
   - **Context**: Faster lookups
   - **Impact**: More complex snapshot format
   - **Decision**: **OUT OF SCOPE for v0.2.0** (Future enhancement)

---

## 📝 Agent Session Notes

### Session #1 - 2025-11-03
**Agent**: Claude (Sonnet 4.5)
**Duration**: ~2 hours
**Tasks Worked**: All tasks (1.0 - 1.6)
**Status**: ✅ **PHASE 1 COMPLETED**

**Progress**:
- Completed: All 7 tasks (Task 1.0 through 1.6)
- In Progress: None
- Blocked: None

**Key Findings**:
1. **No SnapshotManager changes required** - Existing API is sufficient for parent detection
2. **Path normalization critical** - Windows vs Unix path comparison must use `normalizePath()` helper
3. **Traversal insertion point identified** - handlers.ts:360 (after "already indexed" check)
4. **35 test scenarios defined** - Comprehensive coverage including edge cases
5. **Cross-platform design complete** - Windows UNC paths, symlinks, case sensitivity all handled
6. **Backward compatibility preserved** - New `scope` parameter is optional, defaults to "auto"

**Implementation Ready**:
- ✅ Complete function signatures with JSDoc
- ✅ Detailed pseudocode for all new functions
- ✅ TypeScript interfaces defined
- ✅ Integration points documented with line numbers
- ✅ User-facing messages designed for all scenarios
- ✅ MCP tool parameter schema updated
- ✅ Test scenario matrix (35 scenarios)
- ✅ Edge case handling guide (10 edge cases)
- ✅ Decision tree diagrams for implementation flow

**Next Actions for Phase 2**:
1. Implement `findParentIndex()` in utils.ts (with helpers: `isFilesystemRoot`, `normalizePath`)
2. Update `handleIndexCodebase()` in handlers.ts (add parent traversal logic at line 360)
3. Update MCP tool definition in index.ts (add `scope` parameter)
4. Write unit tests for `findParentIndex()` (12 test cases)
5. Write integration tests for `handleIndexCodebase()` (8 test cases)
6. Run cross-platform tests (7 test cases)
7. Test edge cases (8 test cases)

**Handoff Notes**:
- **Implementation is fully specified** - Phase 2 can begin immediately
- **No open questions or blockers** - All design decisions resolved
- **Token-efficient approach used** - Serena symbolic tools minimized file reads
- **Phase 1 completed in 1 session** - Met estimated timeline (1-1.5 sessions)
- **Ready for code implementation** - Proceed to Phase 2: Core Implementation

---

*Phase 1 started: 2025-11-03*
*Phase 1 completed: 2025-11-03*
*Last updated: 2025-11-03*
*Status: ✅ READY FOR PHASE 2*
