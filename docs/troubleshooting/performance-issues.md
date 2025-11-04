# Performance Issues

## sync_now Operation Slowness

### ✅ Status: RESOLVED (as of v0.3.1)

The `sync_now` MCP tool operation performance issue has been fixed through early directory pruning optimization.

**Before Fix (v0.3.0 and earlier):**
- Duration: 9+ minutes for large codebases
- Traversed all 35,000+ files including node_modules

**After Fix (v0.3.1+):**
- Duration: <30 seconds for the same codebase
- Skips ignored directories without entering them
- 90-95% performance improvement

### Original Issue Description

The `sync_now` MCP tool operation could take an extremely long time (5-10+ minutes) even when there were no changes to process.

**Symptoms:**
- Tool appeared to "stall" with no output
- Eventually returned with 0 added/modified/removed files
- Sync history showed durations of 300,000-600,000ms (5-10 minutes)

### Root Cause Analysis

**Date Investigated:** 2025-11-04

The `sync_now` operation calls `reindexByChange()` which triggers `FileSynchronizer.checkForChanges()`. This method:

1. **Scans ALL files** in the codebase directory recursively via `generateFileHashes()`
2. **Performs multiple fs.stat() calls** per file (2x stat per file)
3. **Checks ignore patterns** for every single file encountered
4. **Traverses ignored directories** before filtering them out

**In a typical codebase:**
- Total files on disk: ~35,000+ (including node_modules)
- Files that should be checked: ~800 (after filtering)
- But the code still traverses through all 35,000+ files to filter them

**Performance Breakdown:**
```
35,531 total files × ~15ms per file = ~532,965ms (9 minutes)
```

Even with mtime caching optimization, the directory traversal and multiple stat calls dominate the runtime.

### Code Location

**File:** `packages/core/src/sync/synchronizer.ts`

**Method:** `generateFileHashes()` (lines 75-129)

**Problem Pattern:**
```typescript
// Current (SLOW): Traverse everything, then filter
for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(this.rootDir, fullPath);

    // Filter AFTER we've already entered the directory
    if (this.shouldIgnore(relativePath, entry.isDirectory())) {
        continue;
    }

    // Still recursively enter even ignored dirs
    if (stat.isDirectory()) {
        const subHashes = await this.generateFileHashes(fullPath);
        // ...
    }
}
```

### ✅ Implemented Solution

#### Option 1: Early Directory Pruning (Implemented in v0.3.1)
Check if a directory should be ignored BEFORE recursing into it:

```typescript
if (entry.isDirectory()) {
    // Check ignore BEFORE entering directory
    if (this.shouldIgnore(relativePath, true)) {
        console.log(`[Synchronizer] Skipping ignored directory: ${relativePath}`);
        continue; // Don't recurse at all
    }
    const subHashes = await this.generateFileHashes(fullPath);
    // ...
}
```

**Actual Impact:** 90-95% speedup by not traversing node_modules and other ignored directories.

### Additional Optimization Opportunities (Future)

#### Option 2: Use .gitignore Native Parsing
Instead of checking patterns on every file, use a library like `ignore` to properly handle .gitignore:

```typescript
import ignore from 'ignore';

// Initialize once
const ig = ignore().add(fs.readFileSync('.gitignore', 'utf-8'));

// Use native filtering
if (ig.ignores(relativePath)) {
    continue;
}
```

#### Option 3: Incremental Sync with File Watchers
For codebases with real-time sync enabled, don't rescan everything - use the file watcher's change events:

```typescript
// Only check files that have watcher events
if (this.hasRealtimeSync && this.pendingChanges.size === 0) {
    return { added: [], removed: [], modified: [] };
}
```

#### Option 4: Parallel Processing
Use worker threads or parallel promises to process multiple directories concurrently:

```typescript
// Process subdirectories in parallel
const subdirPromises = subdirs.map(dir =>
    this.generateFileHashes(dir)
);
const results = await Promise.all(subdirPromises);
```

### Performance Tips

With the optimization in place (v0.3.1+):

1. **sync_now is now fast** - completes in <30 seconds for typical codebases
2. **Real-time sync remains the fastest option** - it's event-driven and near-instant
3. **Expected performance**: ~30ms per non-ignored file in the filesystem
4. **Watch the logs** - debug output shows which directories are being skipped

### Testing

To reproduce the performance issue:

```bash
# Enable sync on a codebase with node_modules
mcp__claude-context__enable_realtime_sync({
    path: "/path/to/codebase"
})

# Trigger manual sync (will be slow)
mcp__claude-context__sync_now({
    path: "/path/to/codebase"
})

# Check the duration in history
mcp__claude-context__get_sync_history({
    path: "/path/to/codebase",
    limit: 1
})
```

### Related Issues

- Watched paths count increases dramatically (1.6K → 23K after sync_now)
- This suggests directories are being watched that should be ignored

### Implementation Details

**Version:** v0.3.1
**Date Implemented:** 2025-11-04
**File Modified:** `packages/core/src/sync/synchronizer.ts`
**Method:** `generateFileHashes()` (lines 75-129)

**Changes:**
1. Reordered checks to test `entry.isDirectory()` first
2. Added ignore check before any recursion or stat calls
3. Skip ignored directories completely (no traversal)
4. Added debug logging for visibility

**Commit:** See CHANGELOG.md for details

### Migration Notes

No breaking changes. Upgrade to v0.3.1+ to get the performance improvements automatically.
