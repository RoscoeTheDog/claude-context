# Phase 3: Integration & Testing

**Status**: ⏸️ PENDING
**Started**: TBD
**Target Completion**: 1-2 sessions
**Overall Progress**: 0%
**Prerequisites**: Phase 2 complete

---

## 🎯 Phase Objectives

1. Write comprehensive unit tests for new functions
2. Write integration tests for end-to-end scenarios
3. Test cross-platform compatibility (Windows/Unix/macOS)
4. Test edge cases and error scenarios
5. Verify backward compatibility
6. Test real-time sync integration
7. Performance testing and optimization

---

## 📋 Task Breakdown

### Task 3.1: Unit Tests for Utilities
**Status**: ⏸️ PENDING
**Estimated Time**: 1 hour
**Progress**: 0%

**Test File**: `packages/mcp/src/__tests__/utils.test.ts`

**Tests to Write**:
- [ ] **isFilesystemRoot()**
  - [ ] Returns true for Unix `/`
  - [ ] Returns true for Windows `C:\`
  - [ ] Returns true for Windows `D:\` (other drives)
  - [ ] Returns true for Windows UNC `\\server\share`
  - [ ] Returns false for subdirectories
  - [ ] Returns false for relative paths (edge case)

- [ ] **resolveRealPath()**
  - [ ] Returns real path for symlink
  - [ ] Returns original path if not symlink
  - [ ] Handles non-existent paths gracefully
  - [ ] Handles permission errors gracefully

- [ ] **directoryExists()**
  - [ ] Returns true for existing directory
  - [ ] Returns false for non-existent path
  - [ ] Returns false for file (not directory)
  - [ ] Handles permission errors gracefully

**Code Template**:
```typescript
import { isFilesystemRoot, resolveRealPath, directoryExists } from '../utils';

describe('Path Utilities', () => {
    describe('isFilesystemRoot', () => {
        it('should return true for Unix root', () => {
            expect(isFilesystemRoot('/')).toBe(true);
        });

        it('should return true for Windows drive root', () => {
            expect(isFilesystemRoot('C:\\')).toBe(true);
            expect(isFilesystemRoot('D:\\')).toBe(true);
        });

        it('should return false for subdirectories', () => {
            expect(isFilesystemRoot('/home/user')).toBe(false);
            expect(isFilesystemRoot('C:\\Users')).toBe(false);
        });

        // ... more tests
    });

    describe('resolveRealPath', () => {
        // ... tests
    });

    describe('directoryExists', () => {
        // ... tests
    });
});
```

**Deliverables**:
- [ ] All utility functions have 90%+ code coverage
- [ ] Tests pass on both Windows and Unix
- [ ] Edge cases covered

**Notes**:
_Agent notes go here_

---

### Task 3.2: Unit Tests for findParentIndex()
**Status**: ⏸️ PENDING
**Estimated Time**: 1.5 hours
**Progress**: 0%

**Test File**: `packages/mcp/src/__tests__/parent-index.test.ts`

**Test Scenarios**:
- [ ] **Parent Found via .claude-context/**
  - [ ] Direct parent has .claude-context/
  - [ ] Grandparent has .claude-context/
  - [ ] Multiple levels deep

- [ ] **Parent Found via Snapshot**
  - [ ] Parent in indexed codebases list
  - [ ] Grandparent in list
  - [ ] Nearest parent preferred

- [ ] **Parent Found via .git/**
  - [ ] Git boundary + snapshot check
  - [ ] Nearest .git/ preferred
  - [ ] .git/ without snapshot ignored

- [ ] **No Parent Found**
  - [ ] No indicators found
  - [ ] Reaches filesystem root
  - [ ] Empty snapshot

- [ ] **Edge Cases**
  - [ ] Symlink resolution
  - [ ] Nested git repos (prefer nearest)
  - [ ] Permission errors handled
  - [ ] Invalid paths handled

**Mock Setup**:
```typescript
import { findParentIndex, FindParentIndexResult } from '../utils';
import { SnapshotManager } from '../snapshot';

describe('findParentIndex', () => {
    let mockSnapshotManager: jest.Mocked<SnapshotManager>;

    beforeEach(() => {
        mockSnapshotManager = {
            getIndexedCodebases: jest.fn()
        } as any;
    });

    it('should find parent via .claude-context directory', () => {
        // Mock filesystem
        // Test traversal
        const result = findParentIndex('/project/src/components', mockSnapshotManager);
        expect(result.found).toBe(true);
        expect(result.parentPath).toBe('/project');
        expect(result.reason).toBe('claude-context-dir');
    });

    it('should find parent via snapshot', () => {
        mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/project']);
        const result = findParentIndex('/project/src', mockSnapshotManager);
        expect(result.found).toBe(true);
        expect(result.parentPath).toBe('/project');
        expect(result.reason).toBe('snapshot');
    });

    it('should return not found when no parent exists', () => {
        mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);
        const result = findParentIndex('/some/path', mockSnapshotManager);
        expect(result.found).toBe(false);
        expect(result.reason).toBe('none');
    });

    // ... more tests
});
```

**Deliverables**:
- [ ] All findParentIndex paths tested
- [ ] Edge cases covered
- [ ] Mock snapshot manager working
- [ ] 90%+ code coverage

**Notes**:
_Agent notes go here_

---

### Task 3.3: Integration Tests for handleIndexCodebase()
**Status**: ⏸️ PENDING
**Estimated Time**: 2 hours
**Progress**: 0%

**Test File**: `packages/mcp/src/__tests__/handlers-integration.test.ts`

**End-to-End Scenarios**:
- [ ] **Parent Index Reuse**
  - [ ] Subdirectory request returns parent index
  - [ ] Response has reused=true
  - [ ] Message indicates parent path
  - [ ] No new indexing started

- [ ] **New Index Creation**
  - [ ] No parent found, new index created
  - [ ] Response has reused=false
  - [ ] Background indexing started

- [ ] **Force Re-index**
  - [ ] force=true skips traversal
  - [ ] Subdirectory gets its own index
  - [ ] reused=false

- [ ] **Local Scope**
  - [ ] scope="local" skips traversal
  - [ ] Subdirectory gets its own index
  - [ ] Works even if parent exists

- [ ] **Parent Indexing In Progress**
  - [ ] Returns parent status
  - [ ] Shows progress percentage
  - [ ] reused=true

- [ ] **Error Scenarios**
  - [ ] Invalid scope parameter
  - [ ] Invalid path
  - [ ] Permission errors

**Test Template**:
```typescript
import { ToolHandlers } from '../handlers';
import { SnapshotManager } from '../snapshot';
import { Context } from '@zilliz/claude-context-core';

describe('handleIndexCodebase Integration', () => {
    let toolHandlers: ToolHandlers;
    let mockContext: jest.Mocked<Context>;
    let mockSnapshotManager: jest.Mocked<SnapshotManager>;

    beforeEach(() => {
        // Setup mocks
        mockContext = { /* ... */ } as any;
        mockSnapshotManager = { /* ... */ } as any;
        toolHandlers = new ToolHandlers(mockContext, mockSnapshotManager);
    });

    it('should reuse parent index for subdirectory', async () => {
        // Setup: Parent indexed at /project
        mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/project']);

        // Request: Index /project/src
        const response = await toolHandlers.handleIndexCodebase({
            path: '/project/src',
            scope: 'auto'
        });

        // Verify: Parent index reused
        expect(response.metadata.reused).toBe(true);
        expect(response.metadata.index_path).toBe('/project');
        expect(response.content[0].text).toContain('Using parent index');
    });

    it('should create new index when no parent exists', async () => {
        mockSnapshotManager.getIndexedCodebases.mockReturnValue([]);

        const response = await toolHandlers.handleIndexCodebase({
            path: '/new-project',
            scope: 'auto'
        });

        expect(response.metadata.reused).toBe(false);
        expect(response.metadata.index_path).toBe('/new-project');
        expect(response.content[0].text).toContain('Started background indexing');
    });

    // ... more integration tests
});
```

**Deliverables**:
- [ ] All integration scenarios tested
- [ ] End-to-end flows verified
- [ ] Response formats validated
- [ ] Metadata correctness verified

**Notes**:
_Agent notes go here_

---

### Task 3.4: Cross-Platform Testing
**Status**: ⏸️ PENDING
**Estimated Time**: 1 hour
**Progress**: 0%

**Platforms to Test**:
- [ ] **Windows 10/11**
  - [ ] Drive roots (C:\, D:\)
  - [ ] UNC paths (\\server\share)
  - [ ] Symlinks (junction points)
  - [ ] Path separators (\)
  - [ ] Case insensitivity

- [ ] **macOS**
  - [ ] Root (/)
  - [ ] Symlinks
  - [ ] Path separators (/)
  - [ ] Case sensitivity (APFS)

- [ ] **Linux**
  - [ ] Root (/)
  - [ ] Symlinks
  - [ ] Path separators (/)
  - [ ] Case sensitivity

**Testing Approach**:
- [ ] Run unit tests on each platform
- [ ] Run integration tests on each platform
- [ ] Manual testing with real codebases
- [ ] Verify path handling with platform-specific paths

**Platform-Specific Test Cases**:
```typescript
describe('Cross-Platform Compatibility', () => {
    if (process.platform === 'win32') {
        it('should handle Windows drive roots', () => {
            expect(isFilesystemRoot('C:\\')).toBe(true);
        });

        it('should handle UNC paths', () => {
            expect(isFilesystemRoot('\\\\server\\share')).toBe(true);
        });
    } else {
        it('should handle Unix root', () => {
            expect(isFilesystemRoot('/')).toBe(true);
        });
    }
});
```

**Deliverables**:
- [ ] Tests pass on Windows
- [ ] Tests pass on macOS (if available)
- [ ] Tests pass on Linux
- [ ] Platform-specific issues documented and fixed

**Notes**:
_Agent notes go here_

---

### Task 3.5: Real-World Testing
**Status**: ⏸️ PENDING
**Estimated Time**: 1.5 hours
**Progress**: 0%

**Test Codebases**:
- [ ] **Small codebase** (<100 files)
  - [ ] Index parent
  - [ ] Index subdirectory (should reuse parent)
  - [ ] Search from subdirectory
  - [ ] Verify results

- [ ] **Medium codebase** (1,000-10,000 files)
  - [ ] Index parent
  - [ ] Index multiple subdirectories
  - [ ] Test nested subdirectories
  - [ ] Verify performance

- [ ] **Large codebase** (>10,000 files)
  - [ ] Index parent
  - [ ] Test deep directory structures
  - [ ] Verify no performance degradation

- [ ] **Monorepo** (multiple projects)
  - [ ] Index root
  - [ ] Index individual project subdirectories
  - [ ] Verify nearest parent detection
  - [ ] Test with nested git repos

**Manual Testing Checklist**:
```bash
# Test 1: Basic parent reuse
cd /path/to/large-project
claude
> index this codebase
# Wait for indexing...
> exit

cd /path/to/large-project/src/components
claude
> index this codebase
# Should return: "Using parent index at /path/to/large-project"

# Test 2: Force subdirectory indexing
> index this codebase with scope="local"
# Should create new index at subdirectory level

# Test 3: Search from subdirectory
> search for authentication functions
# Should return results from entire project

# Test 4: Real-time sync
# Edit file in parent directory
> get sync status for this codebase
# Should show parent index syncing
```

**Performance Benchmarks**:
- [ ] Traversal time <100ms (small project, 5 levels deep)
- [ ] Traversal time <200ms (large project, 10 levels deep)
- [ ] No memory leaks after multiple traversals
- [ ] No regression in indexing speed

**Deliverables**:
- [ ] All test codebases verified
- [ ] Performance benchmarks met
- [ ] No issues with real-world usage
- [ ] User experience validated

**Notes**:
_Agent notes go here_

---

### Task 3.6: Backward Compatibility Testing
**Status**: ⏸️ PENDING
**Estimated Time**: 30 minutes
**Progress**: 0%

**Compatibility Scenarios**:
- [ ] **Existing indexed codebases**
  - [ ] Old snapshots still work
  - [ ] Migration from v1 to v2 works
  - [ ] No data loss

- [ ] **Default behavior**
  - [ ] scope parameter defaults to "auto"
  - [ ] Omitting scope works (backward compatible)
  - [ ] force=true still works as before

- [ ] **Existing tool calls**
  - [ ] Calls without scope parameter work
  - [ ] Existing error handling preserved
  - [ ] Response format extensions (reused flag) optional

**Test Cases**:
```typescript
it('should work without scope parameter (backward compat)', async () => {
    const response = await toolHandlers.handleIndexCodebase({
        path: '/project'
        // No scope parameter
    });
    expect(response).toBeDefined();
    expect(response.metadata.reused).toBeDefined();
});

it('should preserve force=true behavior', async () => {
    mockSnapshotManager.getIndexedCodebases.mockReturnValue(['/project']);

    const response = await toolHandlers.handleIndexCodebase({
        path: '/project/src',
        force: true
        // Should skip traversal and re-index
    });

    expect(response.metadata.reused).toBe(false);
    expect(response.content[0].text).toContain('background indexing');
});
```

**Deliverables**:
- [ ] All backward compat tests passing
- [ ] No breaking changes to existing API
- [ ] Old clients still work

**Notes**:
_Agent notes go here_

---

## ✅ Phase Completion Criteria

- [ ] All tasks marked 🟢 COMPLETED
- [ ] 90%+ code coverage for new code
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Cross-platform tests passing
- [ ] Real-world testing successful
- [ ] Backward compatibility verified
- [ ] Performance benchmarks met
- [ ] No regressions found
- [ ] Ready for Phase 4 (documentation)

---

## 🚧 Blockers & Issues Found

### Bugs Discovered
_Document bugs found during testing and their fixes_

### Performance Issues
_Document any performance problems and optimizations_

---

## 📝 Agent Session Notes

### Session #[N] - [DATE] [TIME]
**Agent**: [ID]
**Tasks Worked**: [List]
**Tests Written**: [Count]
**Tests Passing**: [Count/Total]

**Completed**:
- [Item]

**Issues Found**:
- [Bug/Issue]

**Fixes Applied**:
- [Fix]

**Next Actions**:
1. [Action]

---

*Phase 3 prerequisites: Phase 2 complete*
*Last updated: [DATE]*
