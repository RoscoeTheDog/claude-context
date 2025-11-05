# Manual Testing Guide - Token Efficiency Features v0.5.0

This guide helps you manually test all new token efficiency features implemented in v0.5.0.

## Prerequisites

1. **Build the MCP server**:
   ```bash
   pnpm install
   pnpm build
   ```

2. **Configure the MCP server** in your Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "claude-context": {
         "command": "node",
         "args": ["C:/Users/Admin/Documents/GitHub/claude-context/packages/mcp/dist/index.js"],
         "env": {
           "CC_SMART_RESULTS": "true"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** to load the updated MCP server

---

## Feature 1: Smart Adaptive Search Results

### Test 1.1: Auto-Detection with Few Results (Full Mode)

**Setup**: Index a small codebase or search for something specific

**Test**:
```
Ask Claude: "Search for 'feature flags' in the codebase"
```

**Expected Behavior**:
- If 1-3 results found → Full detail mode automatically selected
- Response shows complete code snippets with full metadata
- No need to specify any parameters

**Verification**:
- Check response contains full code blocks
- Check response includes file paths, line numbers, and context

---

### Test 1.2: Auto-Detection with Medium Results (Compact Mode)

**Setup**: Search for a moderately common term

**Test**:
```
Ask Claude: "Search for 'test' in the packages/mcp directory"
```

**Expected Behavior**:
- If 4-10 results found → Compact mode automatically selected
- Response shows summaries with key code snippets (~50% token reduction)
- Results are readable but less verbose than full mode

**Verification**:
- Response is noticeably shorter than full mode
- Still contains enough context to understand each result
- File paths and line numbers visible

---

### Test 1.3: Auto-Detection with Many Results (Summary Mode)

**Setup**: Search for a common term across the codebase

**Test**:
```
Ask Claude: "Search for 'function' in the entire codebase"
```

**Expected Behavior**:
- If 11-25 results found → Summary mode automatically selected
- Response shows high-level summaries only (~75% token reduction)
- Minimal code snippets, focus on metadata and descriptions

**Verification**:
- Response is much shorter than compact mode
- Contains file paths and brief descriptions
- Enough info to identify relevant files for deeper inspection

---

### Test 1.4: Auto-Detection with Too Many Results (Locations Mode)

**Setup**: Search for a very common term

**Test**:
```
Ask Claude: "Search for 'const' in the entire codebase"
```

**Expected Behavior**:
- If 26+ results found → Locations mode automatically selected
- Response shows only file paths and line numbers (~90% token reduction)
- Minimal metadata, just enough to identify where to look

**Verification**:
- Response is extremely concise
- Contains only file paths and line ranges
- Agent can then use Read tool on specific files

---

### Test 1.5: Power User Override - Force Full Mode

**Test**:
```
Ask Claude: "Search for 'test' with full detail mode"
```

**Expected Behavior**:
- Even if many results, full mode is used
- Response shows complete code snippets for all results
- Agent respects explicit override

**Verification**:
- Response contains full code blocks regardless of result count

---

### Test 1.6: Power User Override - Force Locations Mode

**Test**:
```
Ask Claude: "Search for 'authentication' and just show me the locations"
```

**Expected Behavior**:
- Even if only 2-3 results, locations mode is used
- Response shows only file paths
- Agent respects explicit override

**Verification**:
- Response contains only paths, no code snippets

---

## Feature 2: Feature Flags

### Test 2.1: Check Feature Flag Status

**Test**:
```
Ask Claude: "What's the health status of the claude-context MCP server?"
```

**Expected Behavior**:
- Response includes feature flag section
- Shows CC_SMART_RESULTS: enabled (or disabled)
- Shows CC_ALLOW_EXPERIMENTAL: enabled/disabled

**Verification**:
- Look for "Feature Flags" section in health_check output
- Verify flags match your environment variables

---

### Test 2.2: Disable Smart Results Feature

**Setup**: Modify Claude Desktop config:
```json
{
  "mcpServers": {
    "claude-context": {
      "command": "node",
      "args": ["C:/Users/Admin/Documents/GitHub/claude-context/packages/mcp/dist/index.js"],
      "env": {
        "CC_SMART_RESULTS": "false"
      }
    }
  }
}
```

**Test**:
```
Restart Claude Desktop
Ask Claude: "Search for 'test' in the codebase"
```

**Expected Behavior**:
- Feature disabled → falls back to full mode silently
- No errors or warnings shown to user
- All searches return full details regardless of result count

**Verification**:
- Response shows full code snippets even with many results
- No error messages about disabled features

---

### Test 2.3: Re-enable Smart Results

**Setup**: Set `CC_SMART_RESULTS=true` in config, restart Claude Desktop

**Test**:
```
Ask Claude: "Search for 'function' in the codebase"
```

**Expected Behavior**:
- Auto-detection resumes working
- Results formatted based on count (summary or locations for many results)

**Verification**:
- Response uses appropriate detail level based on result count

---

## Feature 3: Self-Documenting Tool Descriptions

### Test 3.1: Tool Discovery via Natural Questions

**Test**:
```
Ask Claude: "How do I search for code in the codebase?"
```

**Expected Behavior**:
- Claude suggests using search_code tool
- Explains when to use it (semantic search)
- Mentions when NOT to use it (known symbols → use serena)
- Provides basic usage example

**Verification**:
- Response includes clear guidance on tool usage
- Mentions alternative tools for different use cases

---

### Test 3.2: Progressive Discovery Pattern

**Test**:
```
Ask Claude: "What optional parameters does search_code support?"
```

**Expected Behavior**:
- Claude lists optional parameters (limit, detail, extensionFilter)
- Explains defaults for each
- Shows progressive examples (basic → advanced)

**Verification**:
- Response includes all optional parameters with defaults
- Examples show increasing complexity

---

### Test 3.3: Anti-Pattern Guidance

**Test**:
```
Ask Claude: "Can I use search_code to find a specific function name?"
```

**Expected Behavior**:
- Claude suggests using serena:find_symbol instead
- Explains search_code is for semantic/conceptual search
- Redirects to appropriate tool

**Verification**:
- Response clearly distinguishes between use cases
- Recommends correct tool for the task

---

## Feature 4: Integration Testing

### Test 4.1: Backward Compatibility

**Setup**: Use existing Claude Code patterns without new parameters

**Test**:
```
Ask Claude: "Search the codebase for error handling patterns"
```

**Expected Behavior**:
- Works exactly as before for agents not aware of new features
- Auto-detection applies automatically (zero-thought savings)
- No breaking changes to existing workflows

**Verification**:
- Response is successful and well-formatted
- Agent doesn't need to know about detail levels

---

### Test 4.2: Mixed Workflows

**Test**:
```
Ask Claude: "Search for 'parser' in the codebase, then read the most relevant file in full"
```

**Expected Behavior**:
- First search uses auto-detected detail level (likely compact/summary)
- Agent can then use Read tool for full file content
- Two-step workflow works seamlessly

**Verification**:
- Search returns appropriate summary
- Agent successfully reads full file afterward
- Workflow feels natural

---

## Token Efficiency Validation

### Test 5.1: Measure Token Savings

**Setup**: Use a tool to count tokens in responses (rough estimate: 1 token ≈ 4 characters)

**Test Sequence**:
1. Disable smart results: `CC_SMART_RESULTS=false`
2. Search for common term, note response length
3. Enable smart results: `CC_SMART_RESULTS=true`
4. Same search, note response length
5. Compare lengths

**Expected Results**:
- Compact mode: ~50% shorter than full
- Summary mode: ~75% shorter than full
- Locations mode: ~90% shorter than full

**Example**:
```
Full mode: "const handleClick = () => { ... }" (500 chars)
Compact mode: "handleClick function in component" (200 chars)
Summary mode: "Click handler - line 42" (100 chars)
Locations mode: "src/App.tsx:42" (50 chars)
```

---

## Edge Cases

### Test 6.1: Empty Results

**Test**:
```
Ask Claude: "Search for 'nonexistent_term_xyz123' in the codebase"
```

**Expected Behavior**:
- Returns empty results gracefully
- No errors thrown
- Clear message about no results found

---

### Test 6.2: Single Result

**Test**:
```
Ask Claude: "Search for a unique function name"
```

**Expected Behavior**:
- Single result → full mode automatically
- Complete code snippet shown
- All context provided

---

### Test 6.3: Exactly at Threshold Boundaries

**Test sequences** (requires crafting searches that return specific counts):

1. **Exactly 3 results** → Should use full mode
2. **Exactly 4 results** → Should switch to compact mode
3. **Exactly 10 results** → Should stay in compact mode
4. **Exactly 11 results** → Should switch to summary mode
5. **Exactly 25 results** → Should stay in summary mode
6. **Exactly 26 results** → Should switch to locations mode

---

## Performance Testing

### Test 7.1: Response Time

**Test**:
```
Time several searches:
- Small result set (3 results)
- Medium result set (10 results)
- Large result set (50 results)
```

**Expected Behavior**:
- Auto-detection adds <10ms overhead
- Total response time dominated by search, not formatting
- No noticeable slowdown from token efficiency features

---

## Troubleshooting

### Issue: Smart results not working

**Check**:
1. Verify `CC_SMART_RESULTS=true` in Claude Desktop config
2. Restart Claude Desktop after config changes
3. Check health_check output for feature flag status
4. Verify build succeeded: `ls packages/mcp/dist/`

### Issue: Getting too much detail

**Solutions**:
1. Set explicit limit: "Search for X, limit 25 results"
2. Request locations only: "Show me just the file locations for X"
3. Adjust threshold by using more specific queries

### Issue: Getting too little detail

**Solutions**:
1. Request full detail explicitly: "Search for X with full details"
2. Use smaller result limit: "Search for X, limit 5"
3. Search in specific directory to reduce result count

---

## Success Criteria

✅ All tests pass without errors
✅ Token savings are noticeable (50-90% reduction)
✅ Search accuracy unchanged (same results, different formatting)
✅ No breaking changes to existing workflows
✅ Feature flags work correctly (enable/disable behavior)
✅ Tool descriptions are clear and helpful
✅ Auto-detection feels natural and invisible

---

## Reporting Issues

If you find issues during testing:

1. **Note the test case** that failed
2. **Capture the input** (exact query to Claude)
3. **Capture the output** (actual response)
4. **Expected vs Actual** behavior
5. **Environment details**:
   - Node version: `node --version`
   - Feature flag settings
   - Result count (if relevant)

Report to: [GitHub Issues](https://github.com/zilliztech/claude-context/issues)

---

## Next Steps After Testing

Once manual testing is complete:

1. **Verify all tests pass**: Run through each test case
2. **Measure token savings**: Compare before/after response sizes
3. **Test with real workflows**: Use in actual development tasks
4. **Provide feedback**: Report any issues or suggestions
5. **Consider production deployment**: Enable features for wider use

---

**Version**: v0.5.0
**Last Updated**: 2025-11-05
**Status**: Ready for testing
