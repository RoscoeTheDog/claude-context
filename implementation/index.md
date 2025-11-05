# Implementation Sprint: Token Efficiency Enhancements v0.5.0

**Created**: 2025-11-04 18:56
**Status**: active
**Sprint Goal**: Implement safe, backward-compatible token efficiency improvements for MCP search operations that reduce client token usage by 40-70% without sacrificing search accuracy

**Target Version**: v0.5.0
**Estimated Duration**: 1-2 weeks
**Risk Profile**: LOW to MEDIUM-LOW

---

## Sprint Principles

### Safety First
- ✅ **Backward Compatible**: All features use optional parameters with safe defaults
- ✅ **Accuracy Preserved**: Zero impact on search quality (no ranking/relevance changes)
- ✅ **Opt-In Only**: Features that affect output format are disabled by default
- ✅ **Feature Flags**: All enhancements can be disabled via environment variables
- ✅ **No Serena Conflicts**: Clear tool boundaries and agent decision trees

### Token Efficiency Focus
- 🎯 Target: 40-70% token reduction per search operation
- 🎯 No accuracy loss: Pure output formatting optimizations
- 🎯 Agent-friendly: Clear, predictable output formats

---

## Stories

### Story 1: Compressed Search Results Output Modes
**Status**: unassigned
**Priority**: HIGH
**Effort**: 2-3 days
**Token Savings**: 40-60% per search
**Risk**: 🟢 LOW

**Description**:
Add optional `output_mode` parameter to `search_code` tool with multiple output formats (full, compact, summary, locations). Default to "full" for backward compatibility.

**Rationale**:
- Pure output formatting (zero impact on search algorithm)
- Optional parameter (backward compatible)
- Clear use cases for each mode
- No conflicts with Serena (different tools)

**Acceptance Criteria**:
- [ ] Add `output_mode` parameter to search_code tool signature
- [ ] Implement "full" mode (existing behavior, default)
- [ ] Implement "compact" mode (60% token reduction)
- [ ] Implement "summary" mode (80% token reduction)
- [ ] Implement "locations" mode (90% token reduction)
- [ ] Update tool documentation with mode descriptions
- [ ] Add unit tests for each output mode
- [ ] Add integration tests verifying backward compatibility
- [ ] Update CHANGELOG.md

**Technical Details**:
```typescript
interface SearchCodeArgs {
  path: string
  query: string
  limit?: number
  output_mode?: 'full' | 'compact' | 'summary' | 'locations'  // NEW
}

// Output examples in story details
```

**Files to Modify**:
- `packages/mcp/src/index.ts` - Tool definition
- `packages/mcp/src/handlers.ts` - Add formatting logic
- `packages/mcp/src/__tests__/handlers.test.ts` - Tests
- `docs/api/mcp-tools.md` - Documentation
- `CHANGELOG.md` - Version entry

---

### Story 2: Feature Flag Infrastructure
**Status**: unassigned
**Priority**: HIGH
**Effort**: 1 day
**Token Savings**: N/A (enabler)
**Risk**: 🟢 LOW

**Description**:
Create centralized feature flag system to allow disabling enhancements if agents get confused or issues arise.

**Rationale**:
- Safety net for production rollout
- Easy rollback without code changes
- Per-feature granular control
- Debugging tool for identifying issues

**Acceptance Criteria**:
- [ ] Create `packages/mcp/src/config/feature-flags.ts`
- [ ] Define flags for all planned enhancements
- [ ] Environment variable support (CC_FEATURE_*)
- [ ] Default all new features to OFF (opt-in)
- [ ] Add flag status to health_check output
- [ ] Add unit tests for flag parsing
- [ ] Document flags in environment-variables.md
- [ ] Update CHANGELOG.md

**Technical Details**:
```typescript
export const FEATURE_FLAGS = {
  // Story 1
  COMPRESSED_RESULTS: parseFlag('CC_COMPRESSED_RESULTS', false),

  // Future stories (Story 3)
  LAZY_LOADING: parseFlag('CC_LAZY_LOADING', false),

  // Safety
  ALLOW_EXPERIMENTAL: parseFlag('CC_ALLOW_EXPERIMENTAL', false),
}
```

**Files to Create**:
- `packages/mcp/src/config/feature-flags.ts`

**Files to Modify**:
- `packages/mcp/src/handlers.ts` - Use flags
- `docs/getting-started/environment-variables.md` - Documentation
- `CHANGELOG.md` - Version entry

---

### Story 3: Lazy Content Loading (Two-Phase Search)
**Status**: unassigned
**Priority**: MEDIUM
**Effort**: 4-5 days
**Token Savings**: 50-70% on initial search
**Risk**: 🟡 MEDIUM

**Description**:
Implement two-phase search where initial query returns only metadata (paths, scores, line numbers), then agent requests full content for specific results via new `get_search_result_content` tool.

**Rationale**:
- Agents often only need file paths from search
- Huge token savings when browsing results
- Optional workflow (backward compatible)
- Common pattern in web APIs (pagination)

**⚠️ ACCURACY PRESERVATION**:
- **DOES NOT** affect search ranking or relevance
- **DOES NOT** filter or deduplicate results
- **ONLY** defers content loading to second phase
- Disabled by default (opt-in via mode="metadata")

**Acceptance Criteria**:
- [ ] Add "metadata" mode to search_code (returns paths + scores only)
- [ ] Implement server-side result storage (30 min TTL)
- [ ] Create new tool: get_search_result_content
- [ ] Add memory management (LRU cache, max 100 searches)
- [ ] Add unit tests for storage + retrieval
- [ ] Add integration tests for full workflow
- [ ] Update agent instructions (CLAUDE.md decision tree)
- [ ] Document workflow in docs/api/mcp-tools.md
- [ ] Update CHANGELOG.md

**Technical Details**:
```typescript
// Phase 1: Metadata only
const meta = await search_code({
  query: "authentication",
  mode: "metadata"  // NEW: lightweight
})
// Returns: { searchId, results: [{ path, score, lines }] }

// Phase 2: Fetch specific content
const content = await get_search_result_content({
  searchId: meta.searchId,
  indices: [0, 5, 12]  // Only these 3
})
```

**Files to Create**:
- `packages/mcp/src/storage/search-cache.ts` - Result storage

**Files to Modify**:
- `packages/mcp/src/index.ts` - Add new tool
- `packages/mcp/src/handlers.ts` - Implement handlers
- `packages/mcp/src/__tests__/handlers.test.ts` - Tests
- `docs/api/mcp-tools.md` - Documentation
- `CHANGELOG.md` - Version entry

---

### Story 4: Agent Decision Tree Documentation
**Status**: unassigned
**Priority**: HIGH
**Effort**: 1 day
**Token Savings**: N/A (prevents waste)
**Risk**: 🟢 LOW

**Description**:
Update CLAUDE.md and documentation with clear decision trees for when to use Claude-Context vs Serena vs new features.

**Rationale**:
- Prevents tool conflicts and confusion
- Guides agents to most efficient tool
- Documents synergy between CC and Serena
- Critical for avoiding token waste

**Acceptance Criteria**:
- [ ] Add "Tool Decision Tree" section to README.md
- [ ] Create docs/guides/tool-selection.md
- [ ] Document CC vs Serena use cases
- [ ] Document when to use each output_mode
- [ ] Document when to use lazy loading workflow
- [ ] Add examples for common scenarios
- [ ] Include anti-patterns (what NOT to do)
- [ ] Update FAQ with tool selection guidance
- [ ] Update CHANGELOG.md

**Technical Details**:
```yaml
# Decision tree structure (see full proposal)
CODE_SEARCH_DECISION:
  KNOWN_SYMBOL: serena:find_symbol
  CONCEPT_SEARCH: cc:search_code(mode=metadata) → review → get_content
  PATTERN_SEARCH:
    - Regex: serena:search_for_pattern
    - Concept: cc:search_code
```

**Files to Create**:
- `docs/guides/tool-selection.md`

**Files to Modify**:
- `README.md` - Add decision tree section
- `docs/troubleshooting/faq.md` - Update
- `CHANGELOG.md` - Version entry

---

### Story 5: Integration Testing Suite
**Status**: unassigned
**Priority**: MEDIUM
**Effort**: 2 days
**Token Savings**: N/A (quality assurance)
**Risk**: 🟢 LOW

**Description**:
Create comprehensive integration tests covering all new features and their interactions with existing functionality.

**Rationale**:
- Ensure backward compatibility
- Catch regressions early
- Verify feature flag behavior
- Test real-world workflows

**Acceptance Criteria**:
- [ ] Test search_code with all output_mode values
- [ ] Test lazy loading full workflow (metadata → content)
- [ ] Test feature flag enable/disable behavior
- [ ] Test backward compatibility (default params)
- [ ] Test error handling for invalid inputs
- [ ] Test result storage TTL expiration
- [ ] Test concurrent search result storage
- [ ] All tests pass in CI/CD
- [ ] Update CHANGELOG.md

**Files to Create**:
- `packages/mcp/src/__tests__/integration/token-efficiency.test.ts`

**Files to Modify**:
- `packages/mcp/src/__tests__/handlers-integration.test.ts` - Add tests
- `CHANGELOG.md` - Version entry

---

## Explicitly Excluded Enhancements

The following proposals are **NOT** included in this sprint due to accuracy concerns:

### ❌ Smart Result Deduplication (Excluded)
**Reason**: Merges overlapping chunks, which could affect agent understanding
**Risk**: May combine unrelated code sections, confuse agents
**Decision**: Exclude for now, revisit in future sprint with user study

### ❌ Semantic Result Clustering (Excluded)
**Reason**: Groups results by similarity, which changes result structure
**Risk**: May mis-cluster unrelated code, reduce discoverability
**Decision**: Exclude for now, revisit as optional experimental feature

### ❌ Context Caching with Deduplication (Excluded)
**Reason**: Session-based deduplication filters results across searches
**Risk**: May hide relevant results if agent searches similar topics
**Decision**: Exclude for now, too complex for accuracy/session management

**Philosophy**: If it changes what results are shown or how they're grouped, exclude it or make it experimental-only.

---

## Progress Log

### 2025-11-04 18:56 - Sprint Started
- Created sprint structure
- Archived previous implementation docs to `archive/2025-11-04-1856/`
- Defined 5 stories (3 features + 2 enablers)
- Excluded 3 proposals due to accuracy concerns
- Sprint goal: 40-70% token savings with zero accuracy loss

---

## Risk Mitigation Strategy

### Technical Risks
- **Risk**: New output modes confuse existing agents
  - **Mitigation**: Default to "full" mode, feature flags, clear docs

- **Risk**: Lazy loading workflow too complex for agents
  - **Mitigation**: Disabled by default, comprehensive examples, optional

- **Risk**: Result storage memory leaks
  - **Mitigation**: TTL (30 min), LRU eviction, max limit (100)

### Process Risks
- **Risk**: Breaking changes slip through
  - **Mitigation**: Integration tests, backward compat checklist

- **Risk**: Serena tool conflicts
  - **Mitigation**: Decision tree documentation, clear boundaries

---

## Success Metrics

### Performance Targets
- ✅ 40-60% token reduction with compressed results
- ✅ 50-70% token reduction with lazy loading
- ✅ Zero impact on search relevance/accuracy
- ✅ <5% performance overhead (processing time)

### Quality Targets
- ✅ 100% backward compatibility (all existing tests pass)
- ✅ Zero breaking changes
- ✅ All new features covered by tests
- ✅ Documentation complete before release

### Adoption Targets
- ✅ Feature flags documented in environment guide
- ✅ Decision tree published in README
- ✅ At least 2 example workflows documented

---

## Sprint Summary
{To be filled upon completion}
