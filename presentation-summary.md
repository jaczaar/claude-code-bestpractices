# Claude Code Best Practices — Presentation Summary

---

## 1. Extensibility: MCP, Agents, Skills, Slash Commands

### MCP Servers (Model Context Protocol)
- Open protocol for connecting Claude Code to external data sources and tools (GitHub, Notion, Slack, Figma, databases)
- Configured in `.claude/settings.json` — spawned as child processes on startup
- Tool schemas injected into system prompt = **fixed token cost every turn**
- Token overhead: ~1,500–15,000+ tokens per server; 5 servers with 58 tools = ~55K tokens before conversation starts
- **Tool Search (deferred loading)** reduces schema overhead by up to **95%** — only tool names loaded upfront, full schemas fetched on demand
- Best practice: load MCP servers **on-demand** (`mcp-on`/`mcp-off`), keep tool surfaces minimal

### Agents / Subagents
- Autonomous task execution loops — Claude Code itself is an agent
- **Subagents** (via `Task` tool): isolated child contexts for heavy research, parallel work, or context-sensitive tasks
- Subagent output = summary only → keeps parent context clean
- **Agent Teams (Swarm Mode)** — released Feb 2026 with Opus 4.6:
  - Multi-agent coordination with planning, dependency tracking, mailbox communication
  - Each agent gets own **git worktree** + **1M token context**
  - Patterns: Leader, Swarm, Pipeline, Watchdog
  - Enable: `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### Skills
- Named, reusable capability bundles (SKILL.md files with YAML frontmatter + markdown instructions)
- Invoked manually (`/frontend-design`) or auto-triggered by description match
- Zero permanent context overhead — load only when relevant
- **Hot reload**, **forked context** (run in isolation), composable
- Ecosystem: official repo (`anthropics/skills`), `/plugin` browser, community marketplaces (SkillsMP, SkillHub)
- Top skills: Frontend Design (277K+ installs), Simplify, CLAUDE.md Improver, Skill Creator, Planning with Files

### Additional Mechanisms
- **Rules Directory** (`.claude/rules/`): Path-scoped instructions with YAML frontmatter — activate only when matching files are touched. Use for file-type-specific guidelines (e.g., API rules for API files, test conventions for test files). Zero context cost until relevant.
- **Settings** (`settings.json` / `settings.local.json`): Permissions, model choice, allowed/denied tools, hooks config. Zero context cost (config only). Three levels: user (`~/.claude/settings.json`), project (`.claude/settings.json`), local (`.claude/settings.local.json`, gitignored).
- **Agent Teams (Swarm Mode)**: Multi-agent coordination with planning, dependency tracking, mailbox communication. Each agent gets own worktree + 1M context. Experimental: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Patterns: Leader, Swarm, Pipeline, Watchdog. Released Feb 2026.
- **Custom Agents** (`.claude/agents/` or `--agent` flag): Named personas with specialized prompts and restricted tool access. Use for consistent code review, security auditing, or documentation roles.
- **Memory / MEMORY.md**: Auto-saved notes from corrections and preferences. First 200 lines loaded at startup; topic files on demand. Toggle via `/memory` or `autoMemoryEnabled` setting. Stored in `~/.claude/projects/<project>/memory/MEMORY.md`.
- **LSP Servers** (via plugins): Language Server Protocol integration for real-time code intelligence (type checking, diagnostics, go-to-definition). Configured via `.lsp.json` in plugins. Pre-built plugins for TypeScript, Python, Rust.
- **Note on `.claudeignore`**: Despite community expectations, `.claudeignore` is NOT an officially supported file. Use `permissions.deny` rules in `settings.json` for access restrictions instead.

### How They Interact
```
User Input → Slash Commands (CLI) → Skills (prompt bundles) → Built-in Tools + MCP Tools → Subagents
```

### Additional Mechanisms (cont.)
- **Plugins** (`/plugin` or `--plugin-dir`): Distribution packages that bundle skills + agents + hooks + MCP servers + LSP servers. Plugin manifest at `.claude-plugin/plugin.json`. Skills namespaced as `/plugin-name:skill-name`. Official marketplace at `claude.ai/settings/plugins/submit`.
- **Worktrees** (`--worktree` flag): Isolated git working directories per agent session. Each worktree gets independent builds/tests. Agent Teams use worktrees internally. Requires git; manual cleanup needed.
- **Hooks** (12+ lifecycle events): Not just pre/post tool — also SessionStart, SessionEnd, Stop, SubagentStart, SubagentStop, Compaction, InstructionsLoaded, WorktreeCreate, WorktreeRemove, TeammateIdle, TaskCompleted. Four handler types: command (shell), HTTP, prompt (LLM-powered), MCP tool.

### Slash Commands (3 types — they look the same but work differently)
- **Built-in** (zero token cost, no model involvement, 30+ commands): `/help`, `/clear`, `/compact`, `/context`, `/cost`, `/model`, `/init`, `/doctor`, `/config`, `/vim`, `/login`, `/logout`, `/memory`, `/permissions`, `/mcp`, `/hooks`, `/status`, `/agents`, `/add-dir`, `/bug`, `/exit`, `/export`, `/ide`, `/install-github-app`, `/output-style`, `/plugin`, `/reload-plugins`, `/rewind`, `/sandbox`
- **Bundled skills** (ship with Claude Code, load prompt + tools on demand): `/simplify`, `/batch`, `/debug`, `/loop`, `/claude-api`
- **Installed skills** (added via `/plugin` or marketplace): `/commit`, `/review-pr`, `/frontend-design`, `/gsd:*`, `/keybindings-help`, etc.
- **Custom** (your own — `.claude/commands/` or `.claude/skills/`): `/project:<name>` | `/user:<name>`
  - Supports `$ARGUMENTS` placeholder for flexible reuse
  - Legacy `.claude/commands/` still works but `.claude/skills/` with SKILL.md is the recommended approach
  - The difference matters: built-in = free, skill-based = context cost when loaded, custom = entire file injected

### Decision Framework
- Project-wide instructions that every session needs? → **CLAUDE.md**
- File-type-specific guidelines (e.g., only for API files)? → **Rules** (`.claude/rules/`)
- Persistent learning from corrections across sessions? → **Memory** (`MEMORY.md`)
- Control permissions, model, or allowed tools? → **Settings** (`settings.json`)
- Quick repeatable prompt for your team? → **Custom Command / Skill**
- Reusable workflow with specialized prompting? → **Skill** (SKILL.md)
- Need external system/API? → **MCP Server**
- Real-time code intelligence (types, diagnostics)? → **LSP Server** (via plugin)
- Must enforce behavior deterministically (linting, gates)? → **Hooks** (12+ events)
- Bundle and distribute a full extension? → **Plugin** (skills + agents + hooks + MCP + LSP)
- Heavy/parallel subtask that would pollute context? → **Subagent**
- Large-scale coordinated parallel work? → **Agent Teams**
- Consistent review/audit persona? → **Custom Agent**
- Safe parallel edits without file conflicts? → **Worktrees**

### The Key Architectural Insight
- **MCP** extends what Claude *can do* (new tools)
- **LSP** gives Claude real-time *code intelligence* (types, diagnostics)
- **Hooks** enforce what Claude *must do* (deterministic — the only one)
- **Settings** control what Claude *can see and touch*
- **Everything else** (CLAUDE.md, rules, memory, skills, commands, agents) *guides* what Claude should do (advisory)
- **Plugins** are the *distribution layer* — they bundle any combination of the above

---

## 2. Context Management

### The 200K Token Budget
Everything shares one 200K context window: system prompt (~3K), CLAUDE.md files (~1.5K ideal), MCP schemas (10K–55K), conversation history, tool results.

**Input cost compounds**: every turn re-sends the full history. A 20-turn conversation at 100K avg = ~2M input tokens processed. Same work in 4 focused sessions at 25K avg = ~500K tokens — **4x cost difference**.

### Quality Degradation by Context Size

| Context Usage | Quality | Speed |
|---|---|---|
| < 50K | Optimal recall | Fast |
| 50K–100K | Good, occasional misses | Moderate |
| 100K–150K | Noticeable degradation | Slower |
| 150K–200K | Auto-compression triggers | Slowest |

### Key Commands

| Command | What It Does | When to Use |
|---|---|---|
| `/compact [hint]` | Compress conversation (lossy summary) | At ~80% context, between subtasks |
| `/clear` | Wipe entire history | Switching tasks entirely |
| `/context <path\|url>` | Add files/dirs/URLs to context | Explicit file loading |
| `/cost` | Show token usage and spend | Monitor session health |
| `/model` | Switch models mid-session | Haiku for cheap tasks, Opus for complex |

### Auto-Compaction
- Triggers at **~83.5%** of window (~167K tokens)
- Summarizes older messages, preserves recent ones
- Each compression cycle is **lossy** — ~80% fidelity after 1st, ~60% after 2nd, ~40% after 3rd
- Tunable: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=<1-100>`
- Manual `/compact` with focus hint is **always better** than auto-compression

### 6 Strategies for Lean Context
1. **Ask precise questions** — "What does `handleAuth` return in `src/auth/service.ts`?" vs "How does auth work?"
2. **Let Claude read files** (don't paste) — tool results can be compressed; pasted text cannot
3. **Scope tool calls tightly** — specific glob patterns, not repo-wide searches
4. **Offload research to subagents** — parent gets summary, not raw results
5. **`/clear` when switching topics** — don't carry stale context forward
6. **Monitor with `/cost`** — signals when to compact or clear

### Context Budget Cheat Sheet
```
200K total
 -  3K  system prompt
 -  1.5K CLAUDE.md (if well-sized)
 - 10K  MCP schemas (3 servers, moderate)
 - 33K  reserved buffer
~152K usable before auto-compaction

With heavy MCP (5 servers, 58 tools): ~55K overhead
With Tool Search lazy loading: ~8.5K overhead
Target: keep active conversation under 100K
```

---

## 3. RALPH Loops — Autonomous Agent Loops

### What Is RALPH?
A continuous `while` loop that invokes Claude Code with the same prompt until all tasks in a PRD are complete. Named after Ralph Wiggum. Popularized by Geoffrey Huntley.

**Key insight**: Shifts state from LLM context (tokens) to filesystem (git history, progress files).

### The Core Loop
1. **Read** — PRD, progress file, current codebase
2. **Ask/Plan** — gap analysis, generate/update implementation plan
3. **Log** — update AGENTS.md with learnings for future iterations
4. **Execute** — implement next item, commit, mark complete
5. **Repeat** — until all items checked off

### Why It Works
- **Git as cumulative memory** — avoids repeated mistakes via `git log`
- **File-based state** — no bloated conversation; each round starts fresh
- **Self-healing** — failed iterations leave artifacts the next one can learn from
- **PRD-driven** — clear success criteria prevent scope creep

### The `/loop` Command (Built-in v2.1.71+)
```
/loop [interval] <prompt or /command>
/loop 5m check deploy status
/loop 30m /simplify
/loop 1h run tests and fix failures
```
- Default interval: 10 minutes
- Max 50 concurrent tasks per session
- Auto-expires after 3 days
- Requires active session

### RALPH vs `/loop`

| Scenario | RALPH Script | `/loop` |
|----------|-------------|---------|
| Multi-hour autonomous dev | Yes | No |
| PRD-driven feature implementation | Yes | No |
| Deploy/CI monitoring | No | Yes |
| Recurring code quality checks | No | Yes |
| PR babysitting | No | Yes |
| Survives session restart | Yes | No |

---

## 4. GSD Framework — Get Shit Done

### The Problem: Context Rot
Claude degrades at **40-50% context utilization**. GSD's solution: keep sessions small and fresh.

### Core Principles
1. **Context Engineering** — meta-prompting with structured XML, thin orchestrators delegate to fresh subagent contexts
2. **Spec-Driven Development** — every task has explicit success criteria, no vibe coding
3. **Aggressive Atomicity** — 2-3 tasks per plan, each fits in ~50% of a fresh context window
4. **Wave-Based Parallelism** — Wave 1 (blocking/sequential), Wave 2 (independent/parallel), Wave 3 (depends on Wave 2)
5. **Goal-Backward Verification** — verify output against goals, every commit is surgical and git-bisectable

### Workflow Phases
1. **Design** (`/gsd:new-project`, `/gsd:discuss-phase`) — capture scope and decisions
2. **Plan** (`/gsd:plan-phase`) — break into atomic plans with wave structure
3. **Execute** (`/gsd:execute-phase`) — each task in fresh subagent context
4. **Verify** — goal-backward validation against specs

### The Lean Orchestrator Pattern
- **Orchestrator**: thin coordinator, reads specs, assigns tasks, uses minimal context
- **Subagents**: fresh Claude instances per task, clean 200K context, no rot
- **File-based state**: all state externalized to files

### GSD vs Traditional AI Coding

| Aspect | Traditional | GSD |
|--------|------------|-----|
| Context | One long session | Fresh per task |
| Quality over time | Degrades (rot) | Consistent |
| Granularity | Ad-hoc | 2-3 tasks/plan |
| Traceability | Unclear commits | 1 commit = 1 task |
| Parallelism | Manual | Wave-based |

Install: `npx get-shit-done`

---

## 5. Skills Store & Ecosystem

### How to Install Skills
1. **`/plugin`** — built-in browser (recommended)
2. **`/plugin install <source>`** — direct from GitHub repos or registries
3. **Manual** — create `SKILL.md` in `.claude/skills/` or `~/.claude/skills/`
4. **Community registries** — SkillsMP (400K+), SkillHub (7K+), Claude Skills Market (119+)

### SKILL.md Format
```yaml
---
name: my-skill
description: When and how to use this skill
model: opus              # Optional
disable-model-invocation: false  # Optional
---
Markdown instructions here.
```

### Top Skills
| Skill | What It Does |
|-------|-------------|
| **Frontend Design** (277K installs) | Solves "distributional convergence" — distinctive UI, not generic AI look |
| **Simplify** | 3 parallel review agents → auto-fix quality issues |
| **CLAUDE.md Improver** | Audits CLAUDE.md against codebase, suggests fixes |
| **Skill Creator** | Meta-skill to generate new skills |
| **Planning with Files** (13K stars) | Multi-step plans as markdown files |
| **Valyu** | 36+ data sources, SEC filings, PubMed, academic |

---

## 6. Integrations & Tools

### Scheduled Execution
- **In-session**: `/loop` (interval-based), `CronCreate` (cron expressions)
- **External**: `claude -p "prompt"` with cron, launchd, or GitHub Actions
- Key flags: `--max-budget-usd`, `--output-format json`, `--effort low|medium|high|max`, `--fallback-model`

### Agent Teams (Swarm Mode)
- Team Lead → plan → worker agents in independent worktrees → mailbox communication → synthesize
- Patterns: **Leader** (default), **Swarm** (peer comms), **Pipeline** (sequential), **Watchdog** (monitoring)
- Enable: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### Worktrees
- `claude --worktree [name]` — isolated git worktree per session
- `claude --worktree name --tmux` — with tmux integration
- Each worktree: independent builds, tests, branches

### Hooks
- Pre/post tool execution callbacks in `.claude/settings.json`
- Use cases: auto-formatting, audit logging, security gates, validation

### IDE Integration
- **VS Code**: official extension, inline panel, diff view, context sharing
- **JetBrains**: CLI in terminal, `--ide` flag
- **Vim/Neovim**: terminal + pipe with `-p`

### GitHub Integration
- PR reviews: `/review-pr <num>` or `claude --from-pr 123`
- CI/CD: GitHub Actions with `claude -p` and `--dangerously-skip-permissions`
- Issue management: `claude -p "Look at issue #456 and create a PR"`

### Chrome Integration
- `claude --chrome` — visual web debugging, UI verification

### Custom Agents
- `claude --agent reviewer` or define in settings.json
- Prompt-based specialization for reviews, security audits, docs

---

## 7. Long-Term Memory

### Memory Architecture
Claude Code is **stateless between sessions**. Memory is simulated via markdown files injected at startup.

### Load Order
1. `~/.claude/CLAUDE.md` (global preferences)
2. `<project>/CLAUDE.md` (project instructions)
3. `<subdir>/CLAUDE.md` (directory-specific)
4. `~/.claude/projects/<hash>/MEMORY.md` (personal project memories)

### Memory Types

| Type | Location | Authorship | Shared? |
|------|----------|-----------|---------|
| Global | `~/.claude/CLAUDE.md` | Manual | No (local) |
| Project instructions | `<project>/CLAUDE.md` | Manual | Yes (git) |
| Project memories | `~/.claude/projects/<hash>/MEMORY.md` | Auto/manual | No (local) |
| Directory rules | `<subdir>/CLAUDE.md` | Manual | Yes (git) |
| Rules directory | `.claude/rules/*.md` | Manual | Yes (git) |

### Auto Memory (2026)
- Claude autonomously saves session learnings to MEMORY.md — on by default
- **200-line hard limit** — only first 200 lines loaded; rest truncated
- Strategy: MEMORY.md as concise **index** → topic files for details
- Memory types: user, feedback, project, reference

### CLAUDE.md vs MEMORY.md

| | CLAUDE.md | MEMORY.md |
|---|---|---|
| Authorship | Manual (you/team) | Auto (Claude decides) |
| Scope | Team-shared (git) | Local-only |
| Purpose | Rules, conventions | Session learnings, corrections |
| Maintenance | Manually curated | Grows auto; needs periodic pruning |

### The Capture-Promote-Prune Cycle
1. **Capture** — "remember this" / `/memory` → MEMORY.md
2. **Promote** — weekly, move validated items to CLAUDE.md
3. **Prune** — monthly, remove stale/redundant entries from both

---

## 8. CLAUDE.md Best Practices

### The Golden Rule
Include information Claude **cannot infer from the codebase** and that **changes how Claude should behave**.

### The Removal Test
For every line: "Would removing this cause Claude to make mistakes?" If no → cut it.

### Structure: WHAT / WHY / HOW
- **WHAT**: tech stack, structure, dependencies
- **WHY**: project purpose (one line)
- **HOW**: conventions, commands, workflows, gotchas (bulk of the file)

### Three-Level Hierarchy

| Level | Location | Target Size | Loaded When |
|-------|----------|-------------|-------------|
| Global | `~/.claude/CLAUDE.md` | < 30 lines | Always |
| Project | `<project>/CLAUDE.md` | < 100 lines | In project |
| Directory | `<subdir>/CLAUDE.md` | < 10 lines | In that directory |

**Combined total**: < 150 lines / < 1,500 tokens

### Formatting Rules
- **Imperative mood**: "Use named exports" not "We prefer named exports because..."
- **Bullets and tables only** — no prose paragraphs
- **Two nesting levels max**
- **Most critical rules at the top** (primacy bias)

### Size Impact on Performance

| Size | Tokens | % of 200K | Impact |
|------|--------|-----------|--------|
| 20 lines | ~150 | 0.08% | Ideal |
| 100 lines | ~700 | 0.35% | Typical, fine |
| 500 lines | ~3,500 | 1.75% | Review for bloat |
| 2,000+ lines | ~14,000+ | 7%+ | Claude starts ignoring instructions |

### Common Mistakes
1. **Too verbose** — target < 200 lines per file
2. **Duplicating code/config** — if tsconfig has `strict: true`, don't repeat it
3. **Stale instructions** — update same-day after tooling changes
4. **Contradictions between levels** — keep global truly global
5. **Including secrets** — never; use env vars
6. **Writing for humans** — write actionable directives, not documentation
7. **Overriding Claude's strengths** — specify exceptions, not blanket rules

### `/init` — Bootstrap a CLAUDE.md
Run `/init` to generate a starter CLAUDE.md from codebase analysis. Always review and refine.

### `/claude-md-improver` — Audit & Fix
- Scans CLAUDE.md against codebase
- Detects gaps, staleness, verbosity, contradictions
- Run after major refactors and quarterly

### Maintenance Cadence
- **After tooling changes**: same day
- **Quarterly**: full audit with `/claude-md-improver`
- **When Claude repeats mistakes**: add a directive

### Template (Project-Level)
```markdown
# <Project Name>

## Stack
- Frontend: <framework, language, UI library>
- Backend: <framework, language, ORM, database>

## Code Conventions
- <convention 1>
- <convention 2>

## Git Workflow
- Branch from `<default-branch>`.
- Branch naming: `<pattern>`.

## Testing
- <framework>. Run: `<command>`.

## Build & Deploy
- Dev: `<command>`. Build: `<command>`.

## Security
- Never commit secrets or .env files.
```

---

## Quick Reference: All Slash Commands

### Built-in (Zero Token Cost)
| Command | Purpose |
|---------|---------|
| `/help` | Show commands and shortcuts |
| `/clear` | Wipe conversation |
| `/compact [hint]` | Compress conversation |
| `/context <path\|url>` | Add to context |
| `/init` | Generate CLAUDE.md |
| `/model` | Switch model |
| `/review` | Code review local changes |
| `/cost` | Token/cost usage |
| `/doctor` | Diagnose environment |
| `/config` | Manage settings |
| `/vim` | Toggle vim keybindings |

### Skill-Based
| Command | Purpose |
|---------|---------|
| `/commit` | Auto-commit with generated message |
| `/review-pr <num>` | Review a GitHub PR |
| `/simplify` | 3 parallel agents review + auto-fix |
| `/loop [interval] [cmd]` | Recurring tasks (default 10m) |
| `/batch` | Parallelize independent changes |
| `/plugin` | Browse/install skills |
| `/frontend-design` | Production-grade UI |
| `/claude-api` | Anthropic SDK help |
| `/gsd:*` | GSD framework phases |

### Custom
| Pattern | Source |
|---------|--------|
| `/project:<name>` | `.claude/commands/<name>.md` |
| `/user:<name>` | `~/.claude/commands/<name>.md` |