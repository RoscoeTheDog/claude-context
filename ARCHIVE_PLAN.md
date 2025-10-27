# Claude Context - Archive & Migration Plan

**Date**: 2025-10-27
**Purpose**: Archive custom documentation and prepare for claude-mcp-installer template integration
**Status**: Ready for execution

---

## Overview

This plan archives the custom installation documentation and scripts created for the claude-context fork, then installs standardized claude-mcp-installer templates for long-term maintenance.

### Goals
1. ✅ Preserve all custom work in `/archive/pre-installer-migration/`
2. ✅ Clear root directory for standardized templates
3. ✅ Install claude-mcp-installer templates to project root
4. ✅ Maintain full version history via git commits
5. ✅ Enable self-maintaining documentation system

---

## Archive Directory Structure

```
/archive/
└── pre-installer-migration/
    ├── ARCHIVE_README.md                    # Archive documentation index
    ├── FORK_ANALYSIS.md                     # Differential analysis (copy)
    ├── docs/
    │   ├── INSTALL.md                       # Original installation guide (18.8KB)
    │   ├── CLAUDE_INIT_LEGACY.md            # Claude Code init template (22.9KB)
    │   ├── DOCS_RULES.md                    # Documentation policies
    │   └── DEPLOYMENT_READY.md              # Deployment status
    ├── scripts/
    │   ├── install.js                       # Automated installer (18.5KB)
    │   ├── uninstall.js                     # Uninstaller (12.1KB)
    │   ├── verify.js                        # Verification suite (17.7KB)
    │   ├── install-config.json              # Installation config (2.8KB)
    │   ├── install-config.schema.json       # JSON schema (3.3KB)
    │   └── templates/
    │       ├── README.md                    # Template documentation
    │       ├── config-development.json      # Dev config preset
    │       ├── config-minimal.json          # Minimal config preset
    │       ├── config-ollama-local.json     # Ollama local preset
    │       ├── config-openai-zilliz.json    # OpenAI+Zilliz preset
    │       └── config-voyageai.json         # VoyageAI preset
    └── config/
        └── env.example                      # Environment template (copy)
```

**Total Archive Size**: ~85KB documentation + ~51KB scripts = ~136KB

---

## Execution Plan

### Phase 1: Create Archive Structure

**Commands:**
```bash
cd /c/Users/Admin/Documents/GitHub/claude-context

# Create archive directories
mkdir -p archive/pre-installer-migration/docs
mkdir -p archive/pre-installer-migration/scripts/templates
mkdir -p archive/pre-installer-migration/config
```

**Status**: ⏳ Pending execution

---

### Phase 2: Archive Documentation

**Files to Archive:**

1. **Root Documentation**
   ```bash
   # Move custom docs to archive
   mv INSTALL.md archive/pre-installer-migration/docs/
   mv CLAUDE_INIT_LEGACY.md archive/pre-installer-migration/docs/

   # Copy analysis (keep original for reference)
   cp FORK_ANALYSIS.md archive/pre-installer-migration/
   ```

2. **Optional Documentation** (if exists)
   ```bash
   # Move if present
   [ -f DOCS_RULES.md ] && mv DOCS_RULES.md archive/pre-installer-migration/docs/
   [ -f DEPLOYMENT_READY.md ] && mv DEPLOYMENT_READY.md archive/pre-installer-migration/docs/
   ```

**Status**: ⏳ Pending execution

---

### Phase 3: Archive Scripts & Configs

**Scripts to Archive:**
```bash
# Archive installation scripts
mv scripts/install.js archive/pre-installer-migration/scripts/
mv scripts/uninstall.js archive/pre-installer-migration/scripts/
mv scripts/verify.js archive/pre-installer-migration/scripts/

# Archive configs
mv scripts/install-config.json archive/pre-installer-migration/scripts/
mv scripts/install-config.schema.json archive/pre-installer-migration/scripts/

# Archive templates
mv scripts/templates/* archive/pre-installer-migration/scripts/templates/
# Note: Keep scripts/templates/README.md if it documents template system
```

**Configuration Archive:**
```bash
# Copy environment template (keep original for users)
cp .env.example archive/pre-installer-migration/config/env.example
```

**Status**: ⏳ Pending execution

---

### Phase 4: Create Archive Documentation

**Create ARCHIVE_README.md:**
```bash
cat > archive/pre-installer-migration/ARCHIVE_README.md << 'EOF'
# Pre-Installer Migration Archive

**Date Archived**: 2025-10-27
**Reason**: Migration to claude-mcp-installer standardized templates
**Original Version**: v0.1.3 + custom real-time sync features

---

## Archive Contents

This directory contains the custom installation documentation and automation scripts created for the claude-context fork before migrating to the claude-mcp-installer template system.

### Documentation (/docs/)
- **INSTALL.md**: Comprehensive installation guide with cross-platform support
- **CLAUDE_INIT_LEGACY.md**: Claude Code initialization template (ultra-compressed)
- **DOCS_RULES.md**: Documentation standards (if exists)
- **DEPLOYMENT_READY.md**: Deployment status tracking (if exists)

### Scripts (/scripts/)
- **install.js**: Automated cross-platform installer with validation
- **uninstall.js**: Clean uninstallation with backup restoration
- **verify.js**: Post-installation verification suite
- **install-config.json**: Installation configuration template
- **install-config.schema.json**: JSON schema for config validation

### Templates (/scripts/templates/)
- **config-development.json**: Development environment preset
- **config-minimal.json**: Minimal configuration preset
- **config-ollama-local.json**: Local Ollama setup preset
- **config-openai-zilliz.json**: OpenAI + Zilliz Cloud preset
- **config-voyageai.json**: VoyageAI provider preset
- **README.md**: Template system documentation

### Configuration (/config/)
- **env.example**: Environment variable template (reference copy)

---

## Migration Summary

**From**: Custom installation system (INSTALL.md + install.js)
**To**: claude-mcp-installer templates (CLAUDE_INSTALL.md + standardized docs)

**Key Features Preserved**:
- ✅ Cross-platform installation instructions
- ✅ API key setup and validation
- ✅ Configuration templates (7 presets)
- ✅ Troubleshooting guide (comprehensive)
- ✅ Feature documentation (real-time sync, performance, monitoring)
- ✅ Tool reference (16 MCP tools)

**New Capabilities** (claude-mcp-installer):
- ✅ Self-maintaining documentation with agent directives
- ✅ Git-first version control (commits > changelog files)
- ✅ Semantic versioning automation
- ✅ Platform validation tracking (✅⚠️❌)
- ✅ Interactive migration wizard
- ✅ Token-optimized templates

---

## Restoration Instructions

If you need to restore the original installation system:

```bash
# From claude-context root directory
cd /c/Users/Admin/Documents/GitHub/claude-context

# Restore documentation
cp archive/pre-installer-migration/docs/INSTALL.md ./
cp archive/pre-installer-migration/docs/CLAUDE_INIT_LEGACY.md ./

# Restore scripts
cp archive/pre-installer-migration/scripts/*.js scripts/
cp archive/pre-installer-migration/scripts/*.json scripts/
cp -r archive/pre-installer-migration/scripts/templates scripts/
```

---

## Reference

- **Full Analysis**: See `FORK_ANALYSIS.md` in this directory
- **Upstream**: https://github.com/zilliztech/claude-context
- **Fork**: https://github.com/RoscoeTheDog/claude-context
- **Template System**: claude-code-tooling/claude-mcp-installer/

---

**Archived by**: Claude Code Agent
**Migration Status**: See root CLAUDE_README.md for current documentation structure
EOF
```

**Status**: ⏳ Pending execution

---

### Phase 5: Clean Up Root Directory

**Verify Archive Completeness:**
```bash
# Check that all files were archived
ls -la archive/pre-installer-migration/docs/
ls -la archive/pre-installer-migration/scripts/
ls -la archive/pre-installer-migration/scripts/templates/
ls -la archive/pre-installer-migration/config/

# Verify files are in archive before proceeding
```

**Files to Keep in Root:**
- ✅ README.md (enhanced with v0.1.3 features)
- ✅ .env.example (user reference for environment setup)
- ✅ .gitignore (enhanced with MCP cache exclusions)
- ✅ package.json, pnpm-lock.yaml, tsconfig.json
- ✅ All source code (packages/, docs/, examples/, evaluation/)
- ✅ FORK_ANALYSIS.md (keep for reference)

**Files Archived (Removed from Root):**
- ❌ INSTALL.md → archive/pre-installer-migration/docs/
- ❌ CLAUDE_INIT_LEGACY.md → archive/pre-installer-migration/docs/
- ❌ scripts/install.js → archive/pre-installer-migration/scripts/
- ❌ scripts/uninstall.js → archive/pre-installer-migration/scripts/
- ❌ scripts/verify.js → archive/pre-installer-migration/scripts/
- ❌ scripts/install-config.json → archive/pre-installer-migration/scripts/
- ❌ scripts/templates/* → archive/pre-installer-migration/scripts/templates/

**Status**: ⏳ Pending execution

---

### Phase 6: Git Commit (Archive)

**Commit Changes:**
```bash
cd /c/Users/Admin/Documents/GitHub/claude-context

# Stage all changes
git add archive/
git add -u  # Stage deletions

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
chore(docs): Archive pre-installer migration documentation

Archived custom installation documentation and scripts to prepare for
claude-mcp-installer template integration.

Archived:
- INSTALL.md (18.8KB comprehensive installation guide)
- CLAUDE_INIT_LEGACY.md (22.9KB Claude Code init template)
- scripts/install.js (automated installer)
- scripts/uninstall.js (uninstaller)
- scripts/verify.js (verification suite)
- scripts/install-config.json (configuration template)
- scripts/templates/ (7 configuration presets)

Archive location: /archive/pre-installer-migration/

Next: Install claude-mcp-installer templates for standardized docs

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Status**: ⏳ Pending execution

---

## Claude-MCP-Installer Integration

### Phase 7: Copy Template Files

**Source**: `claude-code-tooling/claude-mcp-installer/`
**Destination**: `claude-context/` (root)

**Files to Copy:**
```bash
cd /c/Users/Admin/Documents/GitHub

# Copy templates to claude-context root
cp claude-code-tooling/claude-mcp-installer/CLAUDE_README.md claude-context/
cp claude-code-tooling/claude-mcp-installer/CLAUDE_INSTALL.md claude-context/
cp claude-code-tooling/claude-mcp-installer/CLAUDE_MIGRATE.md claude-context/

# Note: Do NOT copy CLAUDE_INSTALL_CHANGELOG.md (git-first mode)
```

**Status**: ⏳ Pending execution

---

### Phase 8: Populate Templates

**CLAUDE_README.md Customization:**

Replace template placeholders:
- `[Project Name]` → "Claude Context MCP Server"
- `[Purpose]` → "Semantic code search with real-time filesystem synchronization"
- `[Version]` → "v0.2.0 (0.1.3 + real-time sync features)"
- `[Repository]` → "https://github.com/RoscoeTheDog/claude-context"
- `[Features]` → "16 MCP tools (4 core + 4 sync + 4 monitor + 4 enhanced)"

**CLAUDE_INSTALL.md Customization:**

Migrate content from archived INSTALL.md:
1. **Prerequisites Section**
   - Node.js 20+ (not compatible with 24.0.0)
   - pnpm installation
   - OpenAI API key
   - Zilliz Cloud API key

2. **Installation Options**
   - **Option 1**: NPX (recommended)
     ```bash
     claude mcp add claude-context \
       -e OPENAI_API_KEY=sk-your-key \
       -e MILVUS_TOKEN=your-token \
       -- npx @zilliz/claude-context-mcp@latest
     ```
   - **Option 2**: Local Installation (from repo)
     ```bash
     node scripts/install.js  # (if restored from archive)
     ```
   - **Option 3**: Manual Configuration
     ```json
     {
       "mcpServers": {
         "claude-context": {
           "command": "npx",
           "args": ["-y", "@zilliz/claude-context-mcp@latest"],
           "env": {
             "OPENAI_API_KEY": "sk-...",
             "MILVUS_TOKEN": "..."
           }
         }
       }
     }
     ```

3. **Configuration Section**
   - API key setup (OpenAI, Zilliz)
   - Environment variables (.env.example reference)
   - Feature flags (realtimeSync, performance, monitoring)
   - Configuration presets (reference archived templates)

4. **Platform-Specific Instructions**
   - Windows: PowerShell, Git Bash, WSL
   - macOS: zsh, bash
   - Linux: bash, zsh
   - Configuration file locations per platform

5. **Tools Reference**
   ```
   Core Tools (4):
   - index_codebase: Index codebase with AST-based hybrid search
   - search_code: Natural language semantic code search
   - clear_index: Remove codebase index
   - get_indexing_status: Check indexing progress and stats

   Real-time Sync Tools (4):
   - enable_realtime_sync: Enable filesystem watching (0ms delay)
   - disable_realtime_sync: Disable automatic sync
   - get_realtime_sync_status: Check sync status
   - sync_now: Force immediate synchronization

   Monitoring Tools (4):
   - get_sync_status: Detailed sync metrics and file tracking
   - get_performance_stats: Performance analytics
   - health_check: System diagnostics and DB connectivity
   - get_sync_history: Complete audit trail of operations

   Enhanced Features:
   - Connection pooling (5x faster sync operations)
   - Mtime caching (avoid redundant file operations)
   - Incremental sync (process only changed files)
   - Audit logging (complete operation history)
   ```

6. **Troubleshooting Section**
   - Cross-platform diagnostics
   - Common issues (API validation, permissions, sync issues)
   - Shell environment refresh strategies
   - Performance optimization tips

7. **Platform Validation Tracking**
   ```
   Windows:
   - ✅ PowerShell - Tested and working
   - ⚠️ Git Bash - Partially tested
   - ⚠️ WSL - Requires testing

   macOS:
   - ⚠️ zsh - Requires testing
   - ⚠️ bash - Requires testing

   Linux:
   - ⚠️ bash - Requires testing
   - ⚠️ zsh - Requires testing
   ```

**CLAUDE_MIGRATE.md Customization:**

Create migration wizard:
```markdown
# Claude Context - Migration Wizard

This wizard helps migrate your existing claude-context installation to the
standardized claude-mcp-installer template system.

## Auto-Detection

The wizard will detect:
- ✅ Existing installation method (NPX vs local)
- ✅ API keys (from install-config.json or environment)
- ✅ Feature flags (realtimeSync, performance, monitoring)
- ✅ Configuration presets
- ✅ Environment variables

## Migration Steps

1. **Archive Check**: Verify /archive/pre-installer-migration/ exists
2. **Detect Installation**: Check current MCP configuration
3. **Extract Config**: Read install-config.json or environment
4. **Populate Templates**: Generate CLAUDE_INSTALL.md with detected values
5. **Validate**: Ensure all functionality preserved
6. **Commit**: Git commit with migration record

## Manual Migration (if needed)

[Detailed manual steps...]
```

**Status**: ⏳ Pending execution

---

### Phase 9: Git Commit (Template Installation)

**Commit Changes:**
```bash
cd /c/Users/Admin/Documents/GitHub/claude-context

# Stage new template files
git add CLAUDE_README.md CLAUDE_INSTALL.md CLAUDE_MIGRATE.md

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
feat(docs): Install claude-mcp-installer templates v1.2.0

Installed standardized documentation templates from claude-mcp-installer
for self-maintaining installation documentation.

Added:
- CLAUDE_README.md: Component entrypoint and navigation hub
- CLAUDE_INSTALL.md: Installation guide with 16 MCP tools
- CLAUDE_MIGRATE.md: Migration wizard for existing installations

Features:
- Git-first version control (commits > changelog files)
- Self-maintaining with agent directives
- Platform validation tracking (✅⚠️❌)
- Semantic versioning automation
- Token-optimized templates

Migration from: /archive/pre-installer-migration/docs/INSTALL.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Status**: ⏳ Pending execution

---

### Phase 10: Version Bump & Tag

**Update Version:**
```bash
# Update package.json version
cd packages/mcp
npm version minor -m "feat: Release v0.2.0 with real-time sync"

# Tag release
git tag -a v0.2.0-realtime-sync -m "Release v0.2.0: Real-time filesystem sync + claude-mcp-installer templates"
```

**Status**: ⏳ Pending execution

---

## Rollback Plan

If issues arise during migration:

**Restore Original Documentation:**
```bash
cd /c/Users/Admin/Documents/GitHub/claude-context

# Restore from archive
cp archive/pre-installer-migration/docs/INSTALL.md ./
cp archive/pre-installer-migration/docs/CLAUDE_INIT_LEGACY.md ./

# Restore scripts
cp archive/pre-installer-migration/scripts/*.js scripts/
cp archive/pre-installer-migration/scripts/*.json scripts/
cp -r archive/pre-installer-migration/scripts/templates scripts/

# Commit restoration
git add .
git commit -m "revert: Restore original installation documentation"
```

**Remove Templates:**
```bash
# Remove claude-mcp-installer templates
rm CLAUDE_README.md CLAUDE_INSTALL.md CLAUDE_MIGRATE.md

git add -u
git commit -m "revert: Remove claude-mcp-installer templates"
```

---

## Verification Checklist

After migration, verify:

- [ ] Archive directory created at `/archive/pre-installer-migration/`
- [ ] All original docs archived (INSTALL.md, CLAUDE_INIT_LEGACY.md)
- [ ] All scripts archived (install.js, uninstall.js, verify.js)
- [ ] Configuration templates archived (7 presets)
- [ ] ARCHIVE_README.md created with restoration instructions
- [ ] Root directory cleaned (archived files removed)
- [ ] Git commit created for archive phase
- [ ] claude-mcp-installer templates copied to root
- [ ] Templates populated with project-specific data
- [ ] All 16 MCP tools documented
- [ ] Platform-specific instructions included
- [ ] Troubleshooting guide comprehensive
- [ ] Git commit created for template installation
- [ ] Version bumped to v0.2.0
- [ ] Git tag created (v0.2.0-realtime-sync)
- [ ] No functionality lost in migration
- [ ] Documentation remains accessible

---

## Timeline

**Estimated Duration**: 30-45 minutes

1. **Create Archive Structure**: 2 minutes
2. **Archive Documentation**: 5 minutes
3. **Archive Scripts**: 5 minutes
4. **Create Archive README**: 5 minutes
5. **Clean Root Directory**: 3 minutes
6. **Git Commit (Archive)**: 2 minutes
7. **Copy Templates**: 2 minutes
8. **Populate Templates**: 10-15 minutes
9. **Git Commit (Templates)**: 2 minutes
10. **Version & Tag**: 2 minutes
11. **Verification**: 5 minutes

---

## Next Steps

After this plan is executed:

1. ✅ Test installation with new templates
2. ✅ Verify all MCP tools accessible
3. ✅ Update README.md references to new docs
4. ✅ Consider PR to upstream (real-time sync features)
5. ✅ Document new maintenance workflow
6. ✅ Update contribution guidelines

---

**Status**: ⏳ **Ready for Execution**
**Approval Required**: User confirmation to proceed

---

**Prepared by**: Claude Code Agent
**Date**: 2025-10-27
**Reference**: FORK_ANALYSIS.md
