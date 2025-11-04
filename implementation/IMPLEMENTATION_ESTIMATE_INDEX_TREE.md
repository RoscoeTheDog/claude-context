# Implementation Estimate: Index Tree Viewer (v0.3.0)

**Created**: 2025-11-03
**Feature**: `get_index_tree` MCP tool
**Estimated by**: Analysis based on v0.2.0 implementation experience

---

## 📊 Complexity Analysis

### Comparison to v0.2.0 (Parent Detection)

| Aspect | v0.2.0 Parent Detection | v0.3.0 Index Tree | Complexity Ratio |
|--------|-------------------------|-------------------|------------------|
| **New Code** | ~200 lines (utils + handlers) | ~300-400 lines (tree builder + handler) | **1.5-2x** |
| **Tests** | 74 tests (3 files) | ~40-50 tests (2-3 files) | **0.5-0.7x** |
| **DB Queries** | Snapshot only (no DB) | Metadata query (simple) | **1.5x** |
| **Algorithms** | Path traversal (simple) | Tree building (moderate) | **2x** |
| **Edge Cases** | Windows/Unix paths, symlinks | Path filtering, depth limiting | **1x** |
| **Documentation** | README, CHANGELOG, migration | Same + examples | **1x** |

**Overall Complexity**: **~1.3x simpler** than v0.2.0

### Why Simpler?

1. **No cross-platform path handling** - Uses existing indexed metadata (already normalized)
2. **No filesystem access** - Pure data transformation
3. **No backward compatibility concerns** - Brand new tool (not modifying existing)
4. **Less integration risk** - Standalone tool, minimal dependencies
5. **Simpler testing** - No real filesystem setup, just mock DB responses

---

## 🎯 Detailed Phase Breakdown

### Phase 1: Minimal Viable Product (MVP)

**Goal**: Basic working `get_index_tree` tool

**Tasks** (8 tasks, all <45 min each):

1. **Task 1.1**: Create `tree-builder.ts` scaffold
   - Define `TreeNode` interface
   - Define `FileInfo` interface
   - Export main `buildTree()` function
   - **Time**: 20 min

2. **Task 1.2**: Implement `buildTreeFromPaths()` algorithm
   - Parse file paths into tree structure
   - Handle nested directories
   - Basic structure only (no stats yet)
   - **Time**: 30 min

3. **Task 1.3**: Implement `calculateStats()` function
   - Post-order traversal for aggregation
   - Calculate `fileCount` and `chunkCount` per node
   - **Time**: 20 min

4. **Task 1.4**: Implement `renderTree()` function
   - Tree format with box-drawing characters
   - Respect depth limit
   - Include stats in output
   - **Time**: 30 min

5. **Task 1.5**: Add `handleGetIndexTree()` to handlers.ts
   - Query vector DB for metadata (relativePath, fileExtension)
   - Group chunks by file path
   - Call tree builder
   - Return formatted response
   - **Time**: 40 min

6. **Task 1.6**: Add MCP tool definition to index.ts
   - Define tool schema with parameters
   - Add description for agents
   - Wire up to handler
   - **Time**: 15 min

7. **Task 1.7**: Write basic unit tests
   - Test `buildTreeFromPaths()` with sample data
   - Test `calculateStats()` accuracy
   - Test `renderTree()` output format
   - **Time**: 40 min

8. **Task 1.8**: Manual testing with real codebase
   - Index a small test project
   - Call `get_index_tree` via MCP
   - Verify output correctness
   - Fix any bugs found
   - **Time**: 30 min

**Phase 1 Total**: ~3.5 hours (8 tasks × ~25 min avg)

**Deliverable**: Working `get_index_tree` tool with:
- Tree format output
- Basic stats (file count, chunk count)
- Depth limiting
- Manual testing complete

---

### Phase 2: Relative Path & List Format

**Goal**: Add subdirectory filtering and alternative output

**Tasks** (6 tasks, all <45 min each):

1. **Task 2.1**: Add `relative_path` parameter support
   - Filter files to subdirectory
   - Adjust paths to be relative to subdirectory
   - Handle edge cases (trailing slashes, etc.)
   - **Time**: 30 min

2. **Task 2.2**: Implement path filtering tests
   - Test with various relative paths
   - Test with non-existent paths
   - Test with file paths (not directories)
   - **Time**: 25 min

3. **Task 2.3**: Implement `renderList()` function
   - Flat list format (one path per line)
   - Include stats inline
   - **Time**: 20 min

4. **Task 2.4**: Add `format` parameter to handler
   - Support 'tree' and 'list' formats
   - Default to 'tree'
   - **Time**: 15 min

5. **Task 2.5**: Add `show_files` parameter
   - Option to show only directories
   - Update rendering functions
   - **Time**: 20 min

6. **Task 2.6**: Integration tests
   - Test with subdirectory filtering
   - Test list vs tree format
   - Test with real indexed codebase
   - **Time**: 30 min

**Phase 2 Total**: ~2.5 hours (6 tasks × ~23 min avg)

**Deliverable**: Enhanced tool with:
- Subdirectory filtering
- List format option
- Directory-only view option

---

### Phase 3: Performance & Documentation

**Goal**: Optimize and document

**Tasks** (6 tasks, all <45 min each):

1. **Task 3.1**: Performance optimization
   - Add simple in-memory cache (Map<codebasePath, TreeNode>)
   - Cache invalidation on indexing completion
   - Benchmark before/after
   - **Time**: 40 min

2. **Task 3.2**: Add tree to snapshot (optional caching)
   - Update `CodebaseInfoIndexed` interface
   - Store tree in snapshot on indexing completion
   - Load from snapshot if available
   - **Time**: 35 min

3. **Task 3.3**: Update README.md
   - Add tool to "Available Tools" section
   - Add usage examples
   - Add "Index Tree Viewer" feature highlight
   - **Time**: 25 min

4. **Task 3.4**: Update CHANGELOG.md
   - Document v0.3.0 changes
   - List benefits and use cases
   - **Time**: 15 min

5. **Task 3.5**: Create migration guide
   - docs/migration/v0.3.0-index-tree.md
   - No breaking changes, just new feature
   - Usage examples for agents
   - **Time**: 20 min

6. **Task 3.6**: Final testing and cleanup
   - Run full test suite
   - Test on Windows/Unix (if possible)
   - Clean up console.log statements
   - Version bump to 0.3.0
   - **Time**: 30 min

**Phase 3 Total**: ~2.5 hours (6 tasks × ~27 min avg)

**Deliverable**: Production-ready feature with:
- Performance optimization
- Complete documentation
- Version bumped to 0.3.0

---

## 📅 Session Estimates

### Based on v0.2.0 Experience

**v0.2.0 Actual**:
- Planning/Design: 1 session
- Implementation: 1 session (13 tasks)
- Testing: 1 session (6 tasks)
- Documentation: 1 session (6 tasks)
- **Total**: 4 sessions (excluding audit)

**v0.3.0 Projected** (with 1.3x simplicity factor):

### Conservative Estimate (Safe)

| Phase | Tasks | Est. Time | Sessions |
|-------|-------|-----------|----------|
| Phase 1: MVP | 8 tasks | 3.5 hours | **1-2 sessions** |
| Phase 2: Enhancement | 6 tasks | 2.5 hours | **1 session** |
| Phase 3: Polish | 6 tasks | 2.5 hours | **1 session** |
| **Total** | 20 tasks | 8.5 hours | **3-4 sessions** |

### Optimistic Estimate (If Everything Goes Well)

| Phase | Tasks | Est. Time | Sessions |
|-------|-------|-----------|----------|
| Phase 1+2: Core | 14 tasks | 6 hours | **2 sessions** |
| Phase 3: Polish | 6 tasks | 2.5 hours | **1 session** |
| **Total** | 20 tasks | 8.5 hours | **3 sessions** |

### Realistic Estimate (Recommended)

**Most Likely**: **3-4 sessions**

**Why?**
- Similar task count to v0.2.0 (20 vs 24 tasks)
- Simpler algorithms (no filesystem, no cross-platform complexity)
- Less testing needed (no integration with external systems)
- But: New feature, might encounter unexpected issues

**Buffer**: Add +1 session for:
- Unexpected edge cases
- Performance tuning
- Cross-platform testing (if doing Unix/Windows both)

**Recommendation**: Plan for **4 sessions**, might finish in 3

---

## 🎲 Risk Factors

### Low Risk (Unlikely to Impact Timeline)

1. **Vector DB Query Performance**
   - Mitigation: Metadata-only query is fast
   - Fallback: Add caching immediately if slow

2. **Tree Building Algorithm**
   - Mitigation: Well-established algorithm, plenty of examples
   - Fallback: Use existing npm package if needed

3. **Path Normalization**
   - Mitigation: Paths already normalized in index
   - Fallback: Use existing path utilities

### Medium Risk (Could Add 1 Session)

1. **Large Codebase Performance**
   - Risk: 50K+ files might be slow
   - Mitigation: Phase 3 adds caching
   - Impact: Might need to implement caching earlier

2. **Output Format Token Count**
   - Risk: Tree output too verbose for huge codebases
   - Mitigation: Default depth=3 keeps it reasonable
   - Impact: Might need smart truncation logic

### Negligible Risk

1. **Cross-Platform Issues** - Already handled in indexed metadata
2. **Backward Compatibility** - New tool, no breaking changes
3. **MCP Integration** - Well-understood pattern from v0.2.0

---

## 📈 Comparison to v0.2.0

### v0.2.0 (Parent Detection)

- **Planning**: Extensive audit, 4 phase documents
- **Sessions**: 5 sessions (1 planning + 4 implementation)
- **Lines of Code**: ~500 lines (implementation + tests)
- **Complexity**: Cross-platform paths, filesystem access, integration

### v0.3.0 (Index Tree) - Projected

- **Planning**: 1 proposal document (already done!)
- **Sessions**: 3-4 sessions (no separate planning needed)
- **Lines of Code**: ~400-500 lines (implementation + tests)
- **Complexity**: Data transformation, no filesystem, standalone

**Efficiency Gain**: ~20-30% faster than v0.2.0

---

## 💡 Implementation Strategy Recommendations

### Option 1: Sequential (Safest)

```
Session 1: Phase 1 (MVP)
Session 2: Phase 2 (Enhancement)
Session 3: Phase 3 (Polish & Documentation)
[Session 4: Buffer for issues]
```

**Pros**: Lower risk, can test between phases
**Cons**: More session overhead

### Option 2: Accelerated (Recommended)

```
Session 1: Phase 1 + 2 (Core Feature Complete)
Session 2: Phase 3 (Polish & Documentation)
[Session 3: Buffer if needed]
```

**Pros**: Faster delivery, fewer context switches
**Cons**: Less time to catch issues between phases

### Option 3: Single Push (Aggressive)

```
Session 1: All phases (if very focused)
[Session 2: Fixes and polish]
```

**Pros**: Fastest possible
**Cons**: High risk of burnout, might miss edge cases

**Recommendation**: **Option 2 (Accelerated)**
- Finish core feature in 1-2 sessions
- Polish and document in 1 session
- Keep 1 buffer session just in case

---

## 🎯 Success Criteria

### Minimum Viable (After Phase 1)

- ✅ `get_index_tree` tool works
- ✅ Tree format output
- ✅ File and chunk counts accurate
- ✅ Depth limiting works
- ✅ Basic tests passing

### Feature Complete (After Phase 2)

- ✅ Subdirectory filtering works (`relative_path`)
- ✅ List format available
- ✅ Directory-only view works
- ✅ Integration tests passing

### Production Ready (After Phase 3)

- ✅ Performance optimized (<200ms for 10K files)
- ✅ Documentation complete
- ✅ Version bumped to 0.3.0
- ✅ All tests passing (40+ tests)
- ✅ Manual testing on real codebase successful

---

## 📝 Final Recommendation

**Phase Structure**: Keep 3 phases as proposed
- Phase 1: MVP (core functionality)
- Phase 2: Enhancement (filtering & formats)
- Phase 3: Polish (performance & docs)

**Session Estimate**: **3-4 sessions** (realistic with buffer)
- Optimistic: 3 sessions
- Conservative: 4 sessions
- Worst case: 5 sessions (if major issues found)

**Complexity vs v0.2.0**: **Simpler** (~1.3x easier)
- Less cross-platform complexity
- No filesystem access
- Standalone feature
- Well-defined scope

**Risk Level**: **Low-Medium**
- Most risks have clear mitigations
- Similar patterns to existing code
- Good test coverage planned

**Confidence**: **High** (85-90%)

This feature is very achievable and should be smoother than v0.2.0 was!

---

*Last Updated: 2025-11-03*
