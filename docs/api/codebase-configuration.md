# Codebase Configuration API

**Version**: v0.4.0
**Status**: Stable
**Category**: Configuration Management

---

## Overview

The Codebase Configuration API provides database-backed, per-codebase configuration for indexed codebases. Each codebase can have independent settings that persist across sessions.

### Key Features

- **Database Storage**: Configurations stored in Milvus (no filesystem pollution)
- **Per-Codebase**: Each indexed codebase has independent configuration
- **Persistent**: Settings survive across sessions
- **Partial Updates**: Update only specific settings without affecting others
- **Default Behavior**: By default, indexes ALL files for complete search accuracy

---

## MCP Tools

### 1. get_codebase_config

Get the current configuration for a specific indexed codebase.

**Parameters:**
```typescript
{
  path: string  // Absolute path to the codebase
}
```

**Returns:**
```typescript
{
  ignorePatterns: string[]      // Patterns to ignore during indexing
  maxFileSize: number           // Maximum file size in bytes (default: 10MB)
  fileExtensions: string[]      // Only index these extensions (empty = all)
  followSymlinks: boolean       // Follow symbolic links (default: false)
  indexHiddenFiles: boolean     // Index hidden files (default: true)
  indexBinaryFiles: boolean     // Index binary files (default: false)
  enableDirectoryPruning: boolean  // Reserved for future use (default: true)
}
```

**Example:**
```typescript
await mcp__claude_context__get_codebase_config({
  path: "/absolute/path/to/codebase"
});
```

**Output:**
```
Configuration for: /absolute/path/to/codebase

{
  "ignorePatterns": [],
  "maxFileSize": 10485760,
  "fileExtensions": [],
  "followSymlinks": false,
  "indexHiddenFiles": true,
  "indexBinaryFiles": false,
  "enableDirectoryPruning": true
}
```

---

### 2. update_codebase_config

Update configuration for a specific codebase. All parameters are optional - only provided values will be updated.

**Parameters:**
```typescript
{
  path: string                    // Required: Absolute path to the codebase
  ignorePatterns?: string[]       // Optional: Patterns to ignore
  maxFileSize?: number            // Optional: Max file size in bytes
  fileExtensions?: string[]       // Optional: Specific extensions to index
  followSymlinks?: boolean        // Optional: Follow symlinks
  indexHiddenFiles?: boolean      // Optional: Index hidden files
  indexBinaryFiles?: boolean      // Optional: Index binary files
}
```

**Example 1: Enable Performance Optimization**
```typescript
await mcp__claude_context__update_codebase_config({
  path: "/absolute/path/to/codebase",
  ignorePatterns: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "*.log"
  ]
});
```

**Example 2: Index Only TypeScript Files**
```typescript
await mcp__claude_context__update_codebase_config({
  path: "/absolute/path/to/codebase",
  fileExtensions: [".ts", ".tsx"],
  ignorePatterns: ["node_modules/**"]
});
```

**Example 3: Increase File Size Limit**
```typescript
await mcp__claude_context__update_codebase_config({
  path: "/absolute/path/to/codebase",
  maxFileSize: 20971520  // 20MB
});
```

**Output:**
```
✅ Configuration updated for: /absolute/path/to/codebase

{
  "ignorePatterns": ["node_modules/**", ".git/**", "dist/**"],
  "maxFileSize": 10485760,
  ...
}

💡 Tip: Run sync_now to apply changes to existing index.
```

---

### 3. reset_codebase_config

Reset configuration to defaults for a specific codebase. This removes all custom ignore patterns and restores default settings (index everything).

**Parameters:**
```typescript
{
  path: string  // Absolute path to the codebase
}
```

**Example:**
```typescript
await mcp__claude_context__reset_codebase_config({
  path: "/absolute/path/to/codebase"
});
```

**Output:**
```
✅ Configuration reset to defaults for: /absolute/path/to/codebase

{
  "ignorePatterns": [],
  "maxFileSize": 10485760,
  "fileExtensions": [],
  "followSymlinks": false,
  "indexHiddenFiles": true,
  "indexBinaryFiles": false,
  "enableDirectoryPruning": true
}
```

---

### 4. list_codebase_configs

List all codebases that have custom configurations stored in the database.

**Parameters:**
```typescript
{}  // No parameters required
```

**Example:**
```typescript
await mcp__claude_context__list_codebase_configs();
```

**Output (No Configurations):**
```
No codebases have custom configurations.

All codebases are using default settings (index everything).
```

**Output (With Configurations):**
```
Configured Codebases (2):

1. /home/user/projects/my-app
   Ignore patterns: 3
   Patterns: node_modules/**, .git/**, dist/**

2. /home/user/projects/library
   Ignore patterns: 5
   Patterns: node_modules/**, .git/**, build/**, ...
```

---

## Configuration Options Reference

### ignorePatterns

**Type**: `string[]`
**Default**: `[]` (empty - index everything)

Glob patterns to exclude during indexing. When set, enables directory pruning optimization for faster sync operations.

**Common Patterns:**
```typescript
ignorePatterns: [
  "node_modules/**",      // JavaScript dependencies
  ".git/**",              // Git repository data
  "dist/**",              // Build output
  "build/**",             // Build artifacts
  "coverage/**",          // Test coverage reports
  ".vscode/**",           // Editor settings
  ".idea/**",             // IDE settings
  "*.min.js",             // Minified files
  "*.log",                // Log files
  "*.map",                // Source maps
  ".DS_Store",            // macOS metadata
  "Thumbs.db"             // Windows metadata
]
```

**Performance Impact:**
- Empty (default): Indexes ALL files for complete accuracy
- With patterns: Can reduce sync time by 90-95% on large codebases

---

### maxFileSize

**Type**: `number`
**Default**: `10485760` (10MB)

Maximum file size to index in bytes. Files larger than this will be skipped.

**Examples:**
```typescript
maxFileSize: 5242880       // 5MB
maxFileSize: 10485760      // 10MB (default)
maxFileSize: 20971520      // 20MB
maxFileSize: 52428800      // 50MB
```

---

### fileExtensions

**Type**: `string[]`
**Default**: `[]` (empty - all extensions)

Only index files with these extensions. Empty array means index all file types.

**Examples:**
```typescript
// TypeScript/JavaScript only
fileExtensions: [".ts", ".tsx", ".js", ".jsx"]

// Python only
fileExtensions: [".py"]

// Documentation only
fileExtensions: [".md", ".txt", ".rst"]

// Code and config
fileExtensions: [".ts", ".js", ".json", ".yaml"]
```

**Note:** Extensions must include the dot prefix.

---

### followSymlinks

**Type**: `boolean`
**Default**: `false`

Whether to follow symbolic links during indexing.

**Warning:** Enabling this can lead to infinite loops if symlinks create circular references.

---

### indexHiddenFiles

**Type**: `boolean`
**Default**: `true`

Whether to index hidden files (files starting with `.`).

**Examples:**
- `true` (default): Index `.env`, `.gitignore`, `.config` files
- `false`: Skip all hidden files

---

### indexBinaryFiles

**Type**: `boolean`
**Default**: `false`

Whether to attempt indexing binary files.

**Note:** Binary files typically don't contain searchable text and can cause issues during indexing.

---

## Usage Patterns

### Pattern 1: Default (Index Everything)

**Use Case:** You want complete search accuracy, don't care about performance.

**Configuration:**
```typescript
// No configuration needed - this is the default
// Or explicitly reset:
await mcp__claude_context__reset_codebase_config({
  path: "/path/to/codebase"
});
```

**Behavior:**
- ✅ Indexes ALL files (including node_modules, .git, etc.)
- ✅ Complete search accuracy
- ⚠️ Slower sync operations on large codebases

---

### Pattern 2: Performance Optimized

**Use Case:** You want fast sync operations, willing to exclude dependencies.

**Configuration:**
```typescript
await mcp__claude_context__update_codebase_config({
  path: "/path/to/codebase",
  ignorePatterns: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**"
  ]
});
```

**Behavior:**
- ✅ Fast sync operations (90-95% faster)
- ✅ Indexes your source code
- ⚠️ Excludes dependencies and build artifacts

---

### Pattern 3: Focused Indexing

**Use Case:** You only care about specific file types.

**Configuration:**
```typescript
await mcp__claude_context__update_codebase_config({
  path: "/path/to/codebase",
  fileExtensions: [".ts", ".tsx"],
  ignorePatterns: ["node_modules/**"]
});
```

**Behavior:**
- ✅ Only indexes TypeScript files
- ✅ Fast and focused
- ⚠️ Won't find code in other file types

---

### Pattern 4: Large Files

**Use Case:** Your codebase has some very large files you want to index.

**Configuration:**
```typescript
await mcp__claude_context__update_codebase_config({
  path: "/path/to/codebase",
  maxFileSize: 52428800  // 50MB
});
```

**Behavior:**
- ✅ Can index larger files
- ⚠️ May increase memory usage

---

## Migration from v0.3.x

### Old Way (Environment Variables)
```bash
# This no longer works
export CUSTOM_IGNORE_PATTERNS="node_modules/**,.git/**,dist/**"
```

### New Way (Per-Codebase Configuration)
```typescript
// Configure via MCP tool
await mcp__claude_context__update_codebase_config({
  path: "/path/to/codebase",
  ignorePatterns: ["node_modules/**", ".git/**", "dist/**"]
});
```

**Benefits of New Approach:**
- ✅ Per-codebase settings (not global)
- ✅ Persistent (stored in database)
- ✅ Can be updated at runtime
- ✅ No environment variable management

---

## Best Practices

### 1. Start with Defaults
Begin with the default configuration (index everything) to ensure complete search accuracy. Only add ignore patterns if you experience performance issues.

### 2. Apply Changes with sync_now
After updating configuration, run `sync_now` to apply changes to the existing index:
```typescript
await mcp__claude_context__sync_now({
  path: "/path/to/codebase"
});
```

### 3. Use Specific Patterns
Be specific with ignore patterns to avoid accidentally excluding important files:
```typescript
// Good: Specific patterns
ignorePatterns: ["node_modules/**", "dist/**"]

// Bad: Too broad
ignorePatterns: ["**/test/**"]  // Might exclude important test files
```

### 4. Test Your Configuration
After updating configuration, verify files are indexed as expected:
```typescript
// Check what's indexed
await mcp__claude_context__get_index_tree({
  path: "/path/to/codebase"
});

// Search for something you know exists
await mcp__claude_context__search_code({
  path: "/path/to/codebase",
  query: "function myImportantFunction"
});
```

---

## Troubleshooting

### Configuration Not Applied

**Problem:** Changes to configuration don't seem to take effect.

**Solution:** Run `sync_now` to apply changes to the existing index:
```typescript
await mcp__claude_context__sync_now({
  path: "/path/to/codebase"
});
```

---

### Can't Find Files After Configuration

**Problem:** Search no longer finds files that used to be indexed.

**Solution:** Check your ignore patterns - you may be excluding too much:
```typescript
// View current config
await mcp__claude_context__get_codebase_config({
  path: "/path/to/codebase"
});

// Reset to defaults if needed
await mcp__claude_context__reset_codebase_config({
  path: "/path/to/codebase"
});
```

---

### Performance Still Slow

**Problem:** Sync is still slow even with ignore patterns.

**Solution:**
1. Verify patterns are actually being applied
2. Check if you're excluding the right directories
3. Use `get_index_tree` to see what's being indexed

---

## See Also

- [Performance Tuning Guide](../troubleshooting/performance-issues.md)
- [File Inclusion Rules](../dive-deep/file-inclusion-rules.md)
- [MCP Tools Reference](../api/mcp-tools.md)
