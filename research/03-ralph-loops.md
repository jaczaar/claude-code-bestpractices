# RALPH Loops

## Summary

RALPH (named after Ralph Wiggum from The Simpsons) is an autonomous AI agent loop pattern popularized by Geoffrey Huntley. It runs an AI coding agent (Claude Code, Amp, etc.) in a continuous loop until all tasks in a PRD are complete. The technique has become one of the defining development patterns of 2026, spawning multiple implementations, Vercel's official SDK integration, and ultimately influencing Claude Code's built-in `/loop` command.

**Key insight:** RALPH shifts state management from the LLM's context window (tokens) to the filesystem (git history, progress files, log files), enabling hours-long autonomous development sessions.

---

## Key Concepts

### What Is a RALPH Loop?

A RALPH loop is a `while` loop that repeatedly invokes an AI coding agent with the same prompt until a stop condition is met. Each iteration is essentially a fresh session — the agent reads the current project state from disk rather than relying on conversation history.

The name comes from the Ralph Wiggum meme philosophy: "I'm in danger" → keep going anyway. It embodies persistent iteration despite setbacks — deterministically bad in an undeterministic world.

### The Core Loop Pattern

Each iteration follows this sequence:

1. **Read** — The agent reads the PRD (requirements), progress file, and current codebase. It finds the next unchecked item.
2. **Ask/Plan** — The agent examines existing code, performs gap analysis, and generates or updates an `IMPLEMENTATION_PLAN.md`.
3. **Log** — After implementation, Ralph updates `AGENTS.md` (or similar log files) with learnings, patterns discovered, gotchas, and conventions. Future iterations automatically benefit from these logs.
4. **Execute** — The agent implements the next item, commits changes, and marks it complete in the progress file.
5. **Repeat** — Loop back to step 1 until all items are checked off or a stop condition triggers.

### Why It Works

- **Git as cumulative memory**: The agent views previous attempt paths via `git log`, avoiding repeated mistakes.
- **File-based state**: No bloated conversation history. Each round starts fresh, scanning project structure and log files directly.
- **Self-healing**: If an iteration fails, the next one sees the failure artifacts and can course-correct.
- **PRD-driven**: Success criteria are defined upfront. The agent iterates toward them rather than being manually directed.

---

## Implementations

### Original (Geoffrey Huntley)

The simplest form — a bash `while` loop:

```bash
while true; do
  claude -p "Read PRD.md and PROGRESS.md. Find the next unchecked item. Implement it. Update PROGRESS.md. Commit."
  sleep 5
done
```

### ralph (snarktank/ralph)

Full-featured implementation with:
- Intelligent exit detection
- API cost safeguards
- Progress tracking via markdown checklists
- Git-based state management

GitHub: [snarktank/ralph](https://github.com/snarktank/ralph)

### ralph-claude-code (frankbria)

Claude Code-specific fork with:
- Built-in safeguards against infinite loops
- API usage monitoring
- Configurable max iterations

GitHub: [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)

### Vercel Labs ralph-loop-agent

Official Vercel implementation for the AI SDK:
- Continuous autonomy pattern
- SDK-native integration

GitHub: [vercel-labs/ralph-loop-agent](https://github.com/vercel-labs/ralph-loop-agent)

---

## The `/loop` Slash Command

Claude Code absorbed the RALPH pattern into a built-in feature with v2.1.71. The `/loop` skill provides cron-based scheduled task execution.

### Syntax

```
/loop [interval] <prompt or /command>
```

- **Interval**: Leading (`/loop 5m ...`) or trailing (`... every 2 hours`). Units: `s`, `m`, `h`, `d`. Default: **10 minutes**.
- **Natural language**: `/loop check the build every 2 hours` works.

### Examples

```
/loop 5m check the deploy status
/loop 30m /simplify
/loop 1h run the test suite and fix any failures
/loop review open PRs every 3 hours
```

### Technical Details

| Property | Value |
|----------|-------|
| Default interval | 10 minutes |
| Max concurrent tasks per session | 50 |
| Auto-expiry | 3 days after creation |
| Jitter | Up to 10% of period, capped at 15 min |
| Requires active session | Yes — closing terminal cancels all |

Under the hood, `/loop` converts the interval to a cron expression using `CronCreate`, which accepts standard 5-field cron expressions (minute, hour, day-of-month, month, day-of-week).

---

## Real-World Examples

### 1. Overnight Feature Development

```bash
# Set up PRD and progress tracking
echo "# Progress\n- [ ] Auth module\n- [ ] API routes\n- [ ] Tests" > PROGRESS.md

# Run RALPH loop
while true; do
  claude -p "Read PRD.md and PROGRESS.md. Implement the next unchecked item. Commit when done."
  sleep 10
done
```

Result: Wake up to a feature branch with incremental commits, each implementing one checklist item.

### 2. Continuous Test Monitoring

```
/loop 5m run the test suite. If any tests fail, fix them and commit.
```

### 3. PR Babysitting

```
/loop 10m check open PRs for CI failures. If any fail, investigate and suggest fixes.
```

### 4. Deploy Monitoring

```
/loop 2m check if the staging deploy completed. Report status.
```

---

## Pros and Cons

### Pros

| Benefit | Detail |
|---------|--------|
| Autonomous execution | Runs for hours without human intervention |
| Self-correcting | Each iteration learns from previous failures via git history |
| No context bloat | Fresh session each iteration; state lives on disk |
| PRD-driven | Clear success criteria prevent scope creep |
| Composable | Works with any AI coding agent, not just Claude |

### Cons / Limitations

| Limitation | Detail |
|------------|--------|
| API cost | Unbounded loops can burn through tokens fast |
| Infinite loop risk | Without proper stop conditions, loops may never terminate |
| Quality variance | Unsupervised iterations may introduce subtle bugs |
| Session dependency (`/loop`) | Built-in `/loop` requires an active Claude Code session |
| No human review | Changes accumulate without review gates unless explicitly configured |
| 3-day expiry (`/loop`) | Scheduled tasks auto-delete after 3 days |

### Mitigations

- Set max iteration counts in external RALPH scripts
- Use cost caps on your API account
- Review git diffs periodically
- Use `/loop` for monitoring tasks, external RALPH scripts for heavy development

---

## RALPH vs `/loop` — When to Use Each

| Scenario | Use RALPH Script | Use `/loop` |
|----------|-----------------|-------------|
| Multi-hour autonomous development | Yes | No |
| PRD-driven feature implementation | Yes | No |
| Deploy/CI monitoring | No | Yes |
| Recurring code quality checks | No | Yes |
| PR babysitting | No | Yes |
| Needs to survive session restart | Yes (external script) | No |
| Quick interval-based tasks | No | Yes |

---

## Sources

- [snarktank/ralph — GitHub](https://github.com/snarktank/ralph)
- [frankbria/ralph-claude-code — GitHub](https://github.com/frankbria/ralph-claude-code)
- [vercel-labs/ralph-loop-agent — GitHub](https://github.com/vercel-labs/ralph-loop-agent)
- [Everything is a Ralph Loop — Geoffrey Huntley](https://ghuntley.com/loop/)
- [The Ralph Wiggum Approach: Running AI Coding Agents for Hours](https://blog.sivaramp.com/blog/claude-code-the-ralph-wiggum-approach/)
- [From Ralph Wiggum to /loop: The Absorption Continues](https://paddo.dev/blog/claude-code-loop-ralph-wiggum-evolution/)
- [2026 — The Year of the Ralph Loop Agent](https://dev.to/alexandergekov/2026-the-year-of-the-ralph-loop-agent-1gkj)
- [From ReAct to Ralph Loop — Alibaba Cloud](https://www.alibabacloud.com/blog/from-react-to-ralph-loop-a-continuous-iteration-paradigm-for-ai-agents_602799)
- [Claude Code /loop — Run Prompts on a Schedule](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code v2.1.71 Release](https://github.com/anthropics/claude-code/releases/tag/v2.1.71)
- [Ralph Wiggum: Autonomous Loops for Claude Code](https://paddo.dev/blog/ralph-wiggum-autonomous-loops/)
- [Claude Code + Ralph: Ship Production Code While You Sleep](https://medium.com/coding-nexus/claude-code-ralph-how-i-built-an-ai-that-ships-production-code-while-i-sleep-3ca37d08edaa)
