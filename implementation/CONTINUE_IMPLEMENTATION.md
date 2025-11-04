# Continue Implementation Prompt

Use this prompt to continue any feature implementation in this repository.

---

## 📋 Copy-Paste Prompt for Next Agent

```
I'm continuing implementation work on the claude-context repository.

TASK:
1. Check the implementation/ folder for active feature work
2. Read any proposal, estimate, or phase documents
3. Identify what has been completed and what remains
4. Continue from where the previous agent left off
5. Update implementation documents as I work
6. Track progress using TodoWrite

Please start by exploring implementation/ and telling me what feature is being worked on and what the current status is.
```

---

## 📖 How This Works

### For the Agent

1. **Explore** the `implementation/` folder
2. **Read** proposal and planning documents
3. **Identify** current status from document markers:
   - ✅ COMPLETED
   - 🔄 IN PROGRESS
   - ⏸️ PENDING
   - ❌ BLOCKED
4. **Continue** from the first IN PROGRESS or PENDING task
5. **Update** status markers as work progresses
6. **Document** any issues or decisions made

### Document Conventions

Implementation documents should use these status markers:

- `✅ COMPLETED` - Task finished
- `🔄 IN PROGRESS` - Currently being worked on
- `⏸️ PENDING` - Not started yet
- `❌ BLOCKED` - Waiting on dependency
- `⚠️ NEEDS REVIEW` - Completed but requires validation

### Living Documentation Pattern

Documents in `implementation/` are **living documents**:
- Agents update task statuses as they work
- Add notes in task sections about decisions made
- Mark timestamp when starting/completing tasks
- Document any blockers or issues encountered
- Update progress percentages

### Example Task Tracking

```markdown
### Task 2.3: Implement renderList() function
**Status**: 🔄 IN PROGRESS
**Started**: 2025-11-03 14:30
**Assigned**: Agent Session #2
**Progress**: 60%

**Notes**:
- Completed basic list rendering
- Working on stats formatting
- Need to handle edge case: empty directories

**Next**: Add unit tests for list format
```

---

## 🔍 What Agents Should Look For

### Priority 1: Current Feature Work
- Look for `FEATURE_PROPOSAL_*.md` files
- Check for `IMPLEMENTATION_ESTIMATE_*.md` files
- Find phase documents with IN PROGRESS status

### Priority 2: Session Handoffs
- Look for `SESSION_HANDOFF_*.md` files
- These contain context from previous agents
- May have specific notes about blockers or decisions

### Priority 3: Overall Status
- Check `IMPLEMENTATION_INDEX.md` if present
- Look for roadmap or planning documents
- Review recent git commits for context

---

## 📝 Best Practices for Continuing Work

### Before Starting
1. ✅ Read all relevant documents in `implementation/`
2. ✅ Check git log for recent changes
3. ✅ Identify clear starting point
4. ✅ Set up TodoWrite for task tracking

### While Working
1. ✅ Update task status markers as you progress
2. ✅ Add notes about decisions or issues
3. ✅ Commit frequently with clear messages
4. ✅ Keep documents synchronized with code

### When Finishing
1. ✅ Mark completed tasks as ✅ COMPLETED
2. ✅ Update progress percentages
3. ✅ Document any remaining work
4. ✅ Note any blockers for next agent
5. ✅ Commit all documentation updates

---

## 🎯 Success Pattern

**Good continuation looks like:**

```
Agent starts
  ↓
Reads implementation/ docs (5-10 min)
  ↓
Identifies: "Index Tree Viewer, Phase 1, Task 1.5 in progress"
  ↓
Continues from Task 1.5
  ↓
Updates document: Task 1.5 → ✅ COMPLETED
  ↓
Starts Task 1.6 → Mark as 🔄 IN PROGRESS
  ↓
Works on Task 1.6
  ↓
Completes and marks → ✅ COMPLETED
  ↓
Commits code + documentation updates
```

---

## ⚠️ What NOT to Do

- ❌ Don't start without reading implementation docs
- ❌ Don't assume what needs to be done
- ❌ Don't skip updating document status
- ❌ Don't work on multiple phases simultaneously
- ❌ Don't leave tasks marked IN PROGRESS when done

---

## 🔄 If Implementation Folder is Empty

If `implementation/` has no active work:

1. Check git history for recently completed features
2. Look in main README.md for roadmap or planned features
3. Check GitHub issues (if applicable)
4. Ask the user what feature to work on next

---

*This is a living document. Agents should follow this pattern for all feature implementations.*
