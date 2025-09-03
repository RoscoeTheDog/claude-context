# Notion MCP Documentation Rules

## Auto-Write Instructions (READ ONLY WHEN EVENT TRIGGERED)

**Workspace Structure:** 
- Database: "[ProjectName] - Development Log" (events)
- Database: "[ProjectName] - Documentation" (detailed docs)
- Page: "[ProjectName] - Context Index" (navigation)

**Event Types:** FEATURE_ADD, BUG_FIX, REFACTOR, RESEARCH, ARCHITECTURE, CONFIG_CHANGE

**When Session/Task Completes:**
1. Create event entry in Development Log database with properties below
2. Create detailed documentation page linked to event
3. Update Context Index page with latest events

**Development Log Database Properties:**
- Title: Event #XXX - [EVENT_TYPE] - [One-line summary]
- Event_Type: Select (FEATURE_ADD, BUG_FIX, REFACTOR, RESEARCH, ARCHITECTURE, CONFIG_CHANGE)
- Date: Date property
- Impact: Select (CRITICAL, MAJOR, MODERATE, MINOR, RESEARCH)
- Files_Modified: Rich text (file list)
- Documentation_Link: Relation to Documentation database
- Work_Completed: Rich text (3 bullet points max)

**Documentation Page Template:**
```markdown
# [Event Type]: [Summary]

## Overview
**Purpose**: [why needed]
**Impact**: [user-facing changes]

## Implementation Details
- **Files Modified**: [list with key changes]
- **Approach**: [how implemented]
- **Location**: [specific functions/classes]

## Usage/Testing
[How to use new feature OR how fix was verified]

## Related
- Event: [link to Development Log entry]
- Files: [key file references]
```

**Context Loading:**
Query Development Log database for latest 3 events, read linked documentation pages

**Search Optimization:**
- Tag events with relevant components/technologies
- Use consistent naming for searchability
- Link related events through relations