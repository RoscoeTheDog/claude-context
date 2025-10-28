# Testing Directory

This directory contains ephemeral test files and artifacts.
All contents except this README are gitignored.

## Structure
- `test-codebases/` - Sample projects for testing auto-enable and sync features
- `test-results/` - Test output and logs (timestamped)
- `temp/` - Temporary files (auto-cleaned after tests)

## Usage

### Manual Testing
```bash
# Run auto-enable feature test
bash .testing/test-auto-enable.sh

# Results will be in .testing/test-results/
```

### Cleanup
```bash
# Clean temporary files
rm -rf .testing/temp/*

# Clean all test results
rm -rf .testing/test-results/*

# Full cleanup (keeps structure)
rm -rf .testing/temp/* .testing/test-results/*
```

## Policies

**P1: Ephemeral Files Only**
- All files here are ephemeral (except README.md and .gitignore)
- Never commit test artifacts, logs, or temporary files
- Use subdirectories for organization

**P2: Auto-Cleanup**
- Test scripts should clean `.testing/temp/` after completion
- Timestamped results in `.testing/test-results/` for debugging
- Manual cleanup for old test results

## Test Codebases

### small-project
- Purpose: Quick validation tests (<10 files)
- Use case: Rapid iteration during development

### medium-project (future)
- Purpose: Performance testing (50-100 files)
- Use case: Validate indexing and sync performance

### large-project (future)
- Purpose: Stress testing (500+ files)
- Use case: Enterprise-scale validation
