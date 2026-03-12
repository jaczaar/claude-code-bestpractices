# Context Management in Claude Code

> **Research note:** Initial content was based on Claude Code documentation, CLI behavior, and community knowledge through May 2025. Updated March 2026 with web research data on compaction mechanics, MCP token overhead, and context recovery strategies. All sources are flagged with dates below.

---

## Summary

Claude Code operates within a 200k-token context window. Every message, tool call, tool result, system prompt, CLAUDE.md file, and MCP tool schema counts against that budget. When the conversation approaches the limit, Claude Code automatically compresses older messages — keeping the session alive but losing fidelity. Effective context management is the single biggest lever for session quality, cost, and speed.

This document covers: token budgeting, the `/compact` and `/clear` and `/context` commands, how context window size maps to performance and cost, MCP's fixed-cost impact on context, auto-compaction mechanics, CLAUDE.md as persistent context, and practical strategies for long sessions.

---

## Table of Contents

1. [How Tokens Are Consumed](#1-how-tokens-are-consumed)
2. [Optimal Token Usage Strategies](#2-optimal-token-usage-strategies)
3. [The /compact Slash Command](#3-the-compact-slash-command)
4. [The /context Slash Command](#4-the-context-slash-command)
5. [The /clear Slash Command](#5-the-clear-slash-command)
6. [Context Window Size: Performance and Cost](#6-context-window-size-performance-and-cost)
7. [MCP Impact on Context](#7-mcp-impact-on-context)
8. [Auto-Compaction and Context Compression](#8-auto-compaction-and-context-compression)
9. [CLAUDE.md as Persistent Context](#9-claudemd-as-persistent-context)
10. [Practical Tips for Long Sessions](#10-practical-tips-for-long-sessions)
11. [Quick Reference](#11-quick-reference)
12. [Sources](#12-sources)

---

## 1. How Tokens Are Consumed

Every API call to the Claude model includes the full conversation context. The 200k-token window is shared across all sources.

| Source | Typical Token Cost | Notes |
|---|---|---|
| System prompt (built-in) | ~2,000–4,000 | Claude Code's internal instructions; always present |
| CLAUDE.md files (all levels) | Varies — aim for < 1,500 total | Re-injected every turn |
| MCP tool schemas | ~200–800 per tool | All active tools always present |
| User message | Proportional to length | Includes pasted code, file contents |
| Assistant response | Proportional to length | Includes reasoning, code output |
| Tool calls + results | Often the largest consumer | File reads, grep output, bash output |
| Deferred tool stubs | ~10–30 per tool (name only) | Minimal until fetched via ToolSearch |

### The Hidden Multiplier

Tokens are billed on both input and output. But the **input cost compounds**: every new turn sends the entire conversation history again. A 50k-token conversation with 20 turns means you're paying for 50k input tokens on that 20th turn — not just the incremental message. This is why keeping context lean saves real money.

---

## 2. Optimal Token Usage Strategies

### Strategy 1: Ask Precise Questions

"What does `handleAuth` return in `src/auth/service.ts`?" triggers one file read.
"How does auth work?" triggers a broad search cascade — multiple greps, multiple file reads, all dumped into context.

### Strategy 2: Let Claude Code Read Files (Don't Paste Them)

Tool results are managed by the system and can be compressed. Raw pastes in user messages persist in context and cannot be selectively compressed.

### Strategy 3: Scope Tool Calls Tightly

Use specific glob patterns and file paths instead of repo-wide searches. A grep across a monorepo can dump thousands of lines into context. Prefer:
```
grep for "handleAuth" in src/auth/
```
Over:
```
grep for "handleAuth" across the entire repo
```

### Strategy 4: Offload Research to Subagents

The Task tool spawns a child agent with its own context. The child does exploratory work (reading many files, running searches) and returns only a summary to the parent. The parent context receives the summary, not the raw search results.

```
Good: "Use a subagent to find all usages of DeviceConfigService and summarize the patterns."
Bad:  "Search the entire monorepo for DeviceConfigService" (dumps results into main context)
```

### Strategy 5: Clear When Switching Topics

Don't carry context from a database migration into a frontend feature. Use `/clear` and start fresh. CLAUDE.md files reload automatically.

### Strategy 6: Use /cost to Monitor Spend

Run `/cost` periodically during long sessions to see current token usage and estimated cost. This gives you a signal for when to compact or clear.

### Pros/Cons of Lean Context

| Pros | Cons |
|---|---|
| Lower cost (fewer input tokens billed) | Must re-read files if cleared too aggressively |
| Faster responses (less to process) | May lose helpful earlier context |
| Higher quality (less noise for the model to parse) | Requires more deliberate prompting |

---

## 3. The `/compact` Slash Command

### What It Does

`/compact` triggers an immediate context compression. Claude Code summarizes the entire conversation history into a condensed form, replacing the full message log with a shorter representation that preserves key facts, decisions, and file state.

### Syntax

```
/compact
/compact [focus-hint]
```

### Examples

```
> /compact
> /compact focus on the auth refactor changes
> /compact focus on the API contract: POST /api/v2/devices returns { id, status, config }
```

The focus hint tells the compression which parts of the conversation to prioritize preserving. Without a hint, compression treats everything equally.

### When to Use

- **Proactively**, before auto-compression triggers — manual compression with a focus hint preserves more relevant detail than automatic compression.
- After completing a subtask but before starting the next one in the same session.
- When responses start slowing down (a sign you're approaching the context limit).
- When Claude Code starts "forgetting" things you told it earlier.

### Best Practices

1. Provide a focus hint when your session covers multiple topics. The argument is free-form: `/compact retain the error handling patterns` or `/compact focus on the API contract`.
2. Don't rely on compression to preserve exact code — after compaction, Claude Code may need to re-read files.
3. Compact mid-task at natural breakpoints (finished the API, moving to frontend). Manual compacting at strategic breakpoints prevents workflow disruption from unexpected auto-compaction.
4. Verify Claude remembers key decisions by asking a quick follow-up after compacting.
5. Use `/compact` when context exceeds ~80%; use `/clear` when switching tasks entirely.

### Comparison: `/compact` vs `/clear`

| | `/compact` | `/clear` |
|---|---|---|
| Preserves conversation history | Yes (summarized) | No |
| Frees context tokens | Partially | Completely |
| CLAUDE.md files | Remain loaded | Remain loaded |
| MCP tool schemas | Remain loaded | Remain loaded |
| Best for | Mid-session cleanup | Topic switches, fresh starts |

---

## 4. The `/context` Slash Command

### What It Does

`/context` explicitly adds files, directories, or URLs to Claude's working context. It is the direct way to say "look at this" rather than hoping Claude discovers it through search.

### Syntax

```
/context <path-or-url>
/context src/components/Header.tsx
/context ./docs/
/context https://docs.anthropic.com/en/docs/claude-code
```

### How It Works

- **Files:** Claude reads the file contents into context immediately.
- **Directories:** Claude reads the tree structure (not every file). It then selectively reads individual files as needed.
- **URLs:** Claude fetches the page content (requires the URL to be publicly accessible with no auth wall).

### When to Use

- When Claude needs to reference a specific file but hasn't been pointed to it.
- When loading a directory's structure so Claude knows what's available.
- When referencing external documentation via URL.

### Best Practices

1. Use `/context` for targeted loading — don't load an entire `src/` tree when you only need one module.
2. After adding large files or many files, consider running `/compact` to manage the context growth.
3. Multiple paths can be added by running the command multiple times.
4. You can also just mention a file path in your message and Claude will typically read it, but `/context` makes it explicit and immediate.

### Gotchas

- Adding very large files or many files at once eats context window fast.
- URL fetching depends on content being accessible — no auth walls, reasonable page size.
- Everything loaded via `/context` persists in the conversation history until compressed or cleared.

---

## 5. The `/clear` Slash Command

### What It Does

Wipes the entire conversation history. Claude loses all memory of the current session. CLAUDE.md files and MCP tool schemas are re-loaded automatically — they are not affected.

### Syntax

```
/clear
```

### When to Use

- When switching tasks within the same terminal session.
- When the context window is full and `/compact` won't free enough space.
- After completing a distinct unit of work.

### Key Difference from `/compact`

`/clear` is a hard reset. There is no summary, no retained context. If you had important decisions or constraints from the session, they are gone unless they live in `CLAUDE.md`.

---

## 6. Context Window Size: Performance and Cost

### The 200k Token Budget

Claude Code uses Anthropic's 200k-token context window (as of Claude 3.5 Sonnet / Claude 3 Opus era models — check current model docs for updates). This is shared across:

- System prompt and internal instructions
- All CLAUDE.md content (global + project + directory)
- MCP tool definitions
- Full conversation history (or its compressed form)
- Pending tool calls and their results

### How Size Affects Performance, Quality, and Cost

| Context Usage | Quality | Speed | Cost |
|---|---|---|---|
| **< 50k tokens** | Optimal attention and recall | Fast | Low |
| **50k–100k tokens** | Good quality, occasional misses on early context | Moderate | Medium |
| **100k–150k tokens** | Noticeable degradation in recalling early context | Slower | High |
| **150k–200k tokens** | Auto-compression triggers; older detail lost | Slowest pre-compression | Highest |

### Why Quality Degrades

Large context windows create a "needle in a haystack" problem. As context grows, the model must attend to more tokens, and its ability to recall specific details from early in the conversation weakens. Research on long-context LLMs consistently shows that information in the middle of a long context is recalled less reliably than information at the beginning or end.

### Key Insight

The context window is not a hard wall. Auto-compression means conversations can run indefinitely in theory. But each compression cycle is lossy. A session compressed 3–4 times has much less precise recall of early decisions than a fresh session with the same information re-loaded.

**Practical ceiling:** Aim to keep active context under 100k tokens for best results. Use `/compact` or `/clear` before hitting that threshold.

### Cost Implications

Claude Code bills on input + output tokens. With the input token cost compounding every turn (the full context is re-sent each time):

- A 20-turn conversation at 100k average context = ~2M input tokens processed
- The same work split into 4 focused 5-turn sessions at 25k average = ~500k input tokens processed
- That's a **4x cost difference** for the same amount of work

Shorter, focused sessions are not just better for quality — they are significantly cheaper.

---

## 7. MCP Impact on Context

### How MCP Tools Consume Tokens

Each MCP server exposes tools. Each tool's JSON schema (name, description, parameter definitions) is serialized into the system prompt on **every turn**. This is a fixed cost that persists for the entire session, whether or not you call those tools.

### Quantifying the Cost

| MCP Server | Typical Tools | Estimated Token Cost |
|---|---|---|
| GitHub (gh) | ~10–15 tools | ~3,000–5,000 tokens |
| Notion | ~8–12 tools | ~2,500–4,000 tokens |
| Context7 | ~2–4 tools | ~800–1,500 tokens |
| Playwright | ~15–20 tools | ~5,000–8,000 tokens |
| Figma | ~5–8 tools | ~2,000–3,000 tokens |
| **5 servers loaded** | **~50–60 tools** | **~13,000–20,000 tokens** |

**Updated 2026 measurements** show the overhead can be even higher than initial estimates:

- MCP tools can consume **66,000+ tokens** before the conversation even starts, depending on server configuration.
- A single server with 20 tools (e.g., omnisearch): ~14,214 tokens.
- Five servers with 58 total tools: ~55K tokens of fixed overhead.
- **Tool Search lazy loading** reduces this dramatically — up to **95% reduction** in tool schema overhead.
- Real-world example: 51K tokens reduced to 8.5K with Tool Search (a **46.9% reduction** of total context overhead).

With 5 MCP servers active, you lose 10–55k tokens (5–28% of the context window) before a single user message is sent. Over a 20-turn conversation, that's billed on **every single turn**.

### MCP vs Alternative Approaches

| Approach | Context Cost | Capability | When to Prefer |
|---|---|---|---|
| **MCP server (always on)** | High fixed cost per turn | Full tool access, model decides when to call | Core workflow tools used every session |
| **MCP server (on-demand)** | Zero when off, high when on | Same as above, toggled with `mcp-on`/`mcp-off` | Tools needed occasionally |
| **Deferred tools** | Minimal (~10-30 tokens per stub) | Name only until fetched via ToolSearch | Large tool surfaces where most tools are rarely used |
| **Bash + CLI directly** | Per-call only (no fixed overhead) | Whatever the CLI supports | One-off commands, no schema needed |
| **Subagent with tool access** | Isolated (parent pays nothing) | Full tools in child context | Heavy integrations that produce large outputs |

### Best Practices

1. **Load MCP servers on demand.** Use `mcp-on` / `mcp-off` to toggle. Don't keep Playwright active during backend work.
2. **Audit your MCP config.** Remove servers you rarely use. Each idle server still consumes tokens.
3. **Prefer fewer, well-scoped servers.** A custom MCP server with 3 focused tools beats a general-purpose one with 20 tools you never call.
4. **Check tool count.** Run `/tools` in Claude Code to see all loaded tools and estimate token overhead.
5. **Use deferred tools** for large tool surfaces where most tools go unused in a given session.

### Pros/Cons of Many MCP Servers

| Pros | Cons |
|---|---|
| Broader capabilities | Higher baseline token cost every turn |
| Less context switching | Slower response times |
| Integrated workflows | More tool definitions for the model to parse |
| Model can choose the right tool | Compounding cost over long conversations |

---

## 8. Auto-Compaction and Context Compression

### How Auto-Compression Works

When the conversation approaches the 200k token limit, Claude Code automatically compresses older messages. The process:

1. **Detection:** The system monitors total token count after each turn.
2. **Trigger:** Auto-compaction triggers at ~83.5% of the total window (~167K tokens for a 200K window). The system reserves a buffer of ~33,000 tokens (16.5%), which provides ~12K more usable space compared to the previous 45K buffer.
3. **Summarization:** Claude summarizes the conversation into a condensed block, preserving: code patterns, file states, and key decisions. Recent messages are preserved verbatim.
4. **Replacement:** The compressed summary replaces the original messages in the context.
5. **Continuation:** The conversation continues with the compressed history + recent messages + system prompt.

### Tuning the Compaction Trigger

The `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` environment variable controls when auto-compaction triggers. It accepts values from 1–100, representing the percentage of the context window that must be filled before compaction activates. For example, setting it to `70` triggers compaction earlier (at 140K tokens), giving you more breathing room but compacting more aggressively.

### What Gets Preserved vs Lost

| Preserved | Potentially Lost |
|---|---|
| Recent messages (last ~10–20 turns) | Exact code snippets from early reads |
| Key decisions and conclusions | Nuanced reasoning from early turns |
| File paths referenced | Intermediate search results |
| Current task state | Alternative approaches discussed and rejected |
| CLAUDE.md content (always re-loaded) | Exact error messages from early debugging |

### Manual vs Automatic Compression

| | Manual (`/compact`) | Automatic (system-triggered) |
|---|---|---|
| **Timing** | You control when | System decides (near limit) |
| **Focus hint** | You can provide one | None — system decides what matters |
| **Quality** | Better — you guide what to keep | Worse — generic summarization |
| **Predictability** | High | Low (you may not notice it happened) |

Manual compression with a focus hint is always preferable. Auto-compression is the safety net.

### Repeated Compression: The Fidelity Cascade

Each compression cycle is lossy. Information degrades through successive compressions:

```
Turn 1-20:  Full fidelity (original messages)
Compression 1: ~80% fidelity (good summary, most detail preserved)
Turn 21-40: Full fidelity for new turns, compressed for old
Compression 2: ~60% fidelity for original context (summary of a summary)
Turn 41-60: Full fidelity for new turns
Compression 3: ~40% fidelity for original context (increasingly lossy)
```

By the 3rd or 4th compression, early context is a high-level sketch at best. This is why CLAUDE.md is critical — it bypasses the compression chain entirely.

### Mitigation Strategies

1. **Put critical instructions in CLAUDE.md**, not in chat messages. CLAUDE.md is re-injected every turn — it never compresses.
2. **Use `/compact` with focus hints proactively** before auto-compression triggers.
3. **Re-state important constraints periodically** in long sessions to keep them in the "recent" window.
4. **Use `/clear` and start fresh** when the task fundamentally changes.
5. **Break long work into multiple short sessions** — each gets a fresh, full-fidelity context.

### Context Recovery via Hooks

For critical long-running sessions, automated context recovery hooks can serve as a safety net:

- **Backup sessions** starting at 50K tokens, updating every 10K tokens.
- **Percentage-based thresholds**: trigger alerts or actions at 30%, 15%, and 5% free context remaining.

These hooks write session summaries to disk, allowing you to restore context if auto-compaction loses critical information or the session crashes.

---

## 9. CLAUDE.md as Persistent Context

### Why It Matters for Context Management

CLAUDE.md files are injected into context on every turn. They survive `/compact` and `/clear`. This makes them the single most reliable mechanism for persistent instructions — and the most important context management tool.

### The Three Levels

| Level | Path | Scope | Loaded When |
|---|---|---|---|
| Global | `~/.claude/CLAUDE.md` | All projects, all sessions | Always |
| Project | `CLAUDE.md` (repo root) | This repository | When working in the repo |
| Directory | `CLAUDE.md` (any subdirectory) | That directory's code | When working in that directory |

### Sizing Guidelines

Every token in CLAUDE.md is a fixed cost on every API call. Oversized files waste context and money. Target **under 200 lines per file**. For each line, ask: "Would removing this cause Claude to make mistakes?" If the answer is no, cut it.

| Level | Target | Roughly |
|---|---|---|
| Global | < 500 tokens | ~400 words |
| Project | < 800 tokens | ~600 words |
| Directory | < 300 tokens | ~200 words |
| **Total across all levels** | **< 1,500 tokens** | **~1,200 words** |

### The `.claude/rules/` Directory

All `.md` files inside `.claude/rules/` are auto-loaded with the same priority as the project-level `CLAUDE.md`. Use this directory to split large CLAUDE.md files into focused rule sets (e.g., `git-workflow.md`, `code-style.md`, `security.md`) without changing behavior.

### What Belongs in CLAUDE.md (Context Perspective)

**Good (persistent, universal):**
- Code style rules, naming conventions
- Stack and framework choices
- Git workflow (branch naming, commit conventions)
- Common commands (build, test, deploy)
- Security rules (never commit secrets)

**Bad (transient, wasteful):**
- Current task details ("I'm working on ticket MC-1234")
- Long code examples or API documentation
- Temporary workarounds
- Anything that changes weekly

---

## 10. Practical Tips for Long Sessions

### Tip 1: Structure Work as Multiple Short Sessions

Instead of one 2-hour marathon:

1. **Session 1:** Research and plan → end with `/clear`
2. **Session 2:** Implement core logic → end with `/clear`
3. **Session 3:** Tests and edge cases → end with `/clear`
4. **Session 4:** Review and cleanup

Each session gets fresh, focused context. Use CLAUDE.md to carry forward decisions between sessions.

### Tip 2: Compact at Natural Breakpoints

After finishing the API endpoint and before moving to frontend integration:

```
> /compact focus on the API contract: POST /api/v2/devices returns { id, status, config }
```

### Tip 3: Offload Research to Subagents

```
Good: "Use a subagent to find all usages of DeviceConfigService across the monorepo and summarize the patterns."

Bad:  "Search the entire monorepo for DeviceConfigService" (dumps raw results into main context)
```

### Tip 4: Re-State Critical Constraints

After compression, Claude doesn't know what it forgot. If something is critical:

```
"Reminder: we're using the v2 API schema, not v1. The endpoint changed from /config to /device-config."
```

### Tip 5: Monitor Context Health

Signs your context is bloated:
- Responses take noticeably longer
- Claude re-reads files it already read
- Answers contradict earlier decisions
- The model "forgets" constraints you set
- `/cost` shows rapidly growing token usage

When you see these signs, `/compact` or `/clear`.

### Tip 6: Minimize MCP Server Activation

Document your MCP activation strategy in CLAUDE.md:

```markdown
## MCP Servers
Always active: github (core workflow)
On-demand:
- playwright — `mcp-on playwright` for UI testing
- figma — `mcp-on figma` for design work
- notion — `mcp-on notion` for docs
Deactivate with `mcp-off <name>` when done.
```

---

## 11. Quick Reference

| Action | Command | Context Impact |
|---|---|---|
| Reset conversation | `/clear` | Drops to baseline (system + CLAUDE.md + MCP schemas) |
| Compress conversation | `/compact` | Reduces token count, lossy |
| Compress with focus | `/compact focus on X` | Reduces tokens, preserves X |
| Add file/dir/URL to context | `/context <path>` | Increases token count |
| Check token usage | `/cost` | Read-only, shows spend |
| Check loaded tools | `/tools` | Read-only, shows MCP overhead |
| Toggle MCP server | `mcp-on` / `mcp-off` | Adds/removes tool schema tokens |
| Offload research | Use subagent / Task tool | Keeps parent context clean |

### Context Budget Cheat Sheet

```
200k total context window
 -  3k  system prompt (built-in)
 -  1.5k CLAUDE.md files (if well-sized)
 - 10k  MCP tool schemas (3 servers, moderate tool count)
 - 33k  reserved buffer (auto-compaction triggers at ~167k)
 -----
~152k  usable before auto-compaction

With heavy MCP (5 servers, 58 tools): subtract ~55k instead of 10k.
With Tool Search lazy loading: MCP overhead drops to ~8.5k.

Target: keep active conversation under 100k for best quality.
Override trigger: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=<1-100>
```

---

## 12. Sources

Initial content based on training knowledge (May 2025 cutoff). Updated March 2026 with web research.

### Original Sources (2025)

- [Anthropic Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code) [SOURCE DATE: 2025-05]
- [Claude Code GitHub Repository](https://github.com/anthropics/claude-code) [SOURCE DATE: 2025-05]
- [Anthropic Model Context Protocol Specification](https://modelcontextprotocol.io/) [SOURCE DATE: 2024-11]
- [Anthropic API Documentation — Models and Context Windows](https://docs.anthropic.com/en/docs/about-claude/models) [SOURCE DATE: 2025-05]
- [Anthropic Blog: Claude Code](https://www.anthropic.com/news/claude-code) [SOURCE DATE: 2025-02]
- [Claude Code CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference) [SOURCE DATE: 2025-05]

### 2026 Update Sources

- [Anthropic Platform Docs — Compaction](https://platform.claude.com/docs/en/build-with-claude/compaction) [SOURCE DATE: 2026]
- [ClaudeFast — Context Buffer Management](https://claudefa.st/blog/guide/mechanics/context-buffer-management) [SOURCE DATE: 2026]
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) [SOURCE DATE: 2026]
- [Scott Spence — Optimising MCP Server Context Usage in Claude Code](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code) [SOURCE DATE: 2026]
- [Joe Njenga — Claude Code MCP Context Reduction with Tool Search](https://medium.com/@joe.njenga/claude-code-just-cut-mcp-context-bloat-by-46-9-51k-tokens-down-to-8-5k-with-new-tool-search-ddf9e905f734) [SOURCE DATE: 2026]
- [ClaudeFast — Context Recovery Hook](https://claudefa.st/blog/tools/hooks/context-recovery-hook) [SOURCE DATE: 2026]

> Token estimates are approximations based on observed behavior and may vary with Claude Code updates.
