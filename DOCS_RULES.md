# Documentation Guidelines

## Auto-Write Instructions (READ ONLY WHEN EVENT TRIGGERED)

**Structure:** `/documentation/` with subdirs: changelogs, implementations, fixes, architecture, research

**Event Types:** FEATURE_ADD, BUG_FIX, REFACTOR, RESEARCH, ARCHITECTURE, CONFIG_CHANGE

**When Session/Task Completes:**
1. Determine event type, create files: changelog/YYYYMMDD_HHMM_[event].md + type-specific file
2. Update /documentation/INDEX.md with event entry using template below
3. Increment event counter

**Event Entry Template:**
```
### Event #XXX - YYYYMMDD_HHMM - [EVENT_TYPE]
**Description**: [One-line summary]
**Work Completed**: [3 bullet points max]
**Documents Created**: [type]: [filename]
**Files Modified**: [count] files - [key files]
**Impact**: [CRITICAL/MAJOR/MODERATE/MINOR/RESEARCH] - [user impact]
```

**File Templates:**
- **changelog**: Files: [list] | Changes: [bullets] | Reason: [why] | Result: [outcome]
- **implementation**: Purpose: [why] | How: [approach] | Location: [files] | Usage: [how]  
- **fix**: Problem: [what broke] | Cause: [why] | Solution: [how fixed] | Test: [verified]

**Index Maintenance:** Keep 10 recent events, archive older to "## Archive" section