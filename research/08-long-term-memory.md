# Long-Term Memory in Claude Code

## Summary

Claude Code is stateless between sessions at the model level — every conversation starts from zero. "Long-term memory" is achieved through a layered system of markdown files that Claude Code reads at startup: `CLAUDE.md` files for project context (manual, team-shared), `MEMORY.md` files in `~/.claude/` for user-level persistence (auto-generated, local-only), and the `/memory` skill for explicit in-session memory capture. As of 2026, **auto memory** lets Claude autonomously save session learnings to `MEMORY.md` without user intervention, with a 200-line hard limit and a topic-file overflow strategy. Understanding how these layers compose — and their sharp limitations — is the difference between Claude Code that "knows" your project and one that asks the same questions every session.

> **Research note:** Original content was based on official Anthropic documentation, the Claude Code CLI source/behavior, and direct usage. Updated 2026-03-11 with web research data covering auto memory, MEMORY.md, and 2026 evolution features. Sources 6-11 added from external research.

---

## Table of Contents

1. [How Memory Works in Claude Code](#1-how-memory-works-in-claude-code)
2. [Memory Types](#2-memory-types)
3. [Auto Memory (MEMORY.md) — 2026 Feature](#3-auto-memory-memorymd--2026-feature)
4. [The Memory Skill (`/memory`)](#4-the-memory-skill-memory)
5. [CLAUDE.md vs MEMORY.md](#5-claudemd-vs-memorymd)
6. [Memory vs Other Persistence Mechanisms](#6-memory-vs-other-persistence-mechanisms)
7. [Implementing Effective Long-Term Memory](#7-implementing-effective-long-term-memory)
8. [CLAUDE.md as Persistent Context](#8-claudemd-as-persistent-context)
9. [Limitations](#9-limitations)
10. [2026 Evolution and Roadmap](#10-2026-evolution-and-roadmap)
11. [Workarounds and Advanced Strategies](#11-workarounds-and-advanced-strategies)
12. [Practical Examples](#12-practical-examples)
13. [Best Practices Checklist](#13-best-practices-checklist)
14. [Sources](#14-sources)

---

## 1. How Memory Works in Claude Code

> **2026 update:** Claude Code now supports **auto memory** — Claude autonomously saves learnings to `MEMORY.md` without user intervention. See [Section 3](#3-auto-memory-memorymd--2026-feature) for full details.

Claude Code is stateless between sessions. Each time you start a new conversation (or the context window resets), the model has no recollection of previous interactions. "Memory" is simulated by injecting text files into the system prompt at startup.

### The injection pipeline

When Claude Code starts a session, it reads files in this order:

1. **Global user instructions** — `~/.claude/CLAUDE.md`
2. **Project-level instructions** — `CLAUDE.md` at the project root (and optionally in subdirectories)
3. **Project memory files** — `~/.claude/projects/<project-path-hash>/MEMORY.md`
4. **Session context** — any files explicitly added via `/add` or `@` references

All of these are concatenated into the system prompt before the first user message.

### Directory structure

```
~/.claude/
  CLAUDE.md                          # Global user preferences (manual)
  rules/                             # All .md files here auto-loaded at same priority as CLAUDE.md
  projects/
    <encoded-path>/
      MEMORY.md                      # Project-specific memories (auto + manual)
      memory/
        MEMORY.md                    # Index file — first 200 lines auto-loaded
        debugging.md                 # Topic file (loaded on demand or via index)
        api-conventions.md           # Topic file
      settings.json                  # Project settings (allowed tools, etc.)
```

The `<project-path-hash>` is derived from the absolute path of the project root. This means the same repo cloned to two different paths will have separate memory files.

### How memories are stored

Memories are plain text appended to markdown files. When Claude Code's `/memory` skill fires (or when the user says "remember this"), the agent appends a line to the appropriate `MEMORY.md` file. The format is typically a bullet point or short paragraph. There is no structured schema, no tagging, no metadata — just text.

### Key architectural point

The entire memory system is file-based. There is no database, no vector store, no semantic index. Every memory file is loaded in full every session. This is simple and reliable, but it means memory scales linearly with file size and has no retrieval intelligence.

---

## 2. Memory Types

Claude Code's memory system can be categorized into four functional types. The underlying mechanism (markdown files read at startup) is the same for all.

### User memories (`~/.claude/CLAUDE.md`)

- Persist across all projects and sessions
- Contain global preferences: coding style, communication preferences, tool configurations
- Manually authored by the user or written by Claude Code when asked
- Committed to no repository — local to the machine

**Example content:**
```markdown
- Be concise and direct. No fluff.
- TypeScript strict mode, no `any`.
- Prefer named exports over default exports.
- Use NestJS for backend services.
```

### Project memories (`~/.claude/projects/<hash>/MEMORY.md`)

- Scoped to a specific project directory
- Automatically read when Claude Code detects you're in that project
- Capture project-specific conventions, architectural decisions, gotchas
- Written by the `/memory` skill or by Claude Code when you say "remember this"
- Not committed to git (lives in `~/.claude/`, not the project directory)

**Example content:**
```markdown
- This monorepo uses NX. Run builds with `nx run <project>:build`.
- The API gateway is in apps/gateway, not apps/api.
- Database migrations use TypeORM — never modify migration files after they've been applied.
- TimescaleDB hypertables are in the `telemetry` schema.
```

### Feedback memories (implicit)

- When you correct Claude Code during a session ("no, use pnpm not npm", "always add error handling"), it can store these as memories if you tell it to
- These corrections become future instructions
- Stored in either `CLAUDE.md` or project `MEMORY.md` depending on scope
- Claude Code may also proactively suggest saving a correction as a memory after repeated corrections

### Reference memories (manual)

- Files explicitly added to context via `/add`, `@file`, or `CLAUDE.md` include directives
- Not "memory" in the traditional sense, but serve the same purpose: giving Claude Code knowledge it wouldn't otherwise have
- Useful for API schemas, architecture docs, style guides
- Only loaded when explicitly referenced — not automatic

### How the types relate

```
                        ┌─────────────────────────┐
                        │   Always loaded          │
                        │                          │
                        │  ~/.claude/CLAUDE.md     │  ← User memories (global)
                        │  <project>/CLAUDE.md     │  ← Project instructions (team)
                        │  ~/.claude/projects/     │
                        │    <hash>/MEMORY.md      │  ← Project memories (personal)
                        └─────────────────────────┘
                        ┌─────────────────────────┐
                        │   Loaded on demand       │
                        │                          │
                        │  @file references        │  ← Reference memories
                        │  /add file.md            │
                        └─────────────────────────┘
                        ┌─────────────────────────┐
                        │   Created during session │
                        │                          │
                        │  /memory or "remember"   │  ← Feedback memories
                        │  (appended to MEMORY.md) │
                        └─────────────────────────┘
```

---

## 3. Auto Memory (MEMORY.md) — 2026 Feature

Auto memory is a 2026 addition to Claude Code that lets Claude autonomously accumulate knowledge across sessions without requiring the user to explicitly save anything. It is on by default.

### How it works

- Claude decides what is worth remembering during a session and writes it to `MEMORY.md`
- Saved learnings include: build commands, debugging insights, architecture notes, code style preferences, workflow habits
- The file is injected into the system prompt at the start of every subsequent session
- Local to the machine — never committed to git, never touches remote

### File location

```
~/.claude/projects/<encoded-path>/memory/MEMORY.md
```

The `<encoded-path>` is derived from the absolute path of the project root.

### Memory directory structure

Auto memory uses a directory-based layout to keep content organized:

```
~/.claude/projects/<encoded-path>/memory/
  MEMORY.md              # Index file — auto-loaded (first 200 lines)
  debugging.md           # Topic file (detailed debugging notes)
  api-conventions.md     # Topic file (API patterns and conventions)
  ...                    # Additional topic files as needed
```

### Memory types within auto memory

| Type | Description | Example |
|------|-------------|---------|
| **User** | Personal preferences and habits | "Prefers named exports over default exports" |
| **Feedback** | Corrections and refinements from sessions | "Use pnpm, not npm for this project" |
| **Project** | Architecture and structural knowledge | "API gateway is in apps/gateway, not apps/api" |
| **Reference** | Technical facts and conventions | "TimescaleDB hypertables in the telemetry schema" |

### The 200-line hard limit

MEMORY.md has a **200-line hard limit**. Only the first 200 lines are loaded into the system prompt; everything beyond that is truncated with a warning. This is a critical constraint that shapes how auto memory should be managed.

**Strategy:** Keep MEMORY.md as a concise index that points to detailed topic files. Put deep content (debugging notes, API conventions, architecture details) in separate `.md` files within the memory directory.

```markdown
# MEMORY.md (index — stays under 200 lines)

## Build & Dev
- `pnpm dev` starts all services
- `nx run api-gateway:serve` for just the API
- See debugging.md for common build failures

## Architecture
- Monorepo managed by NX
- See api-conventions.md for route patterns

## Gotchas
- Port 5432 conflicts with local Postgres — use 5433
- TimescaleDB migrations run separately
```

### Key characteristics

- **On by default** — no opt-in required
- **Claude decides** what is worth saving — the user does not need to say "remember this"
- **Additive** — Claude appends learnings; it does not overwrite or reorganize automatically
- **Local-only** — stays on the machine, not shared with team members
- **Complements CLAUDE.md** — auto memory captures session learnings; CLAUDE.md holds intentional, team-shared instructions

---

## 4. The Memory Skill (`/memory`)

Claude Code includes a built-in `/memory` skill. This is not a separate installable plugin — it is part of the core Claude Code agent.

### What it does

- Provides a structured way to save information to `MEMORY.md` files
- Determines the appropriate scope (global vs. project) based on context
- Appends the memory as a bullet point to the relevant file
- Can be triggered explicitly or through natural language

### How to trigger it

```
# Explicit command
/memory "This project uses pnpm workspaces"

# Natural language (Claude Code interprets intent)
"Remember that we use port 3001 for the dev server"
"Save this: the staging DB is read-only on weekends"
"Add to memory: always run migrations before starting the API"
```

### What it writes

When triggered, the skill appends to `~/.claude/projects/<hash>/MEMORY.md` (project scope) or `~/.claude/CLAUDE.md` (global scope):

```markdown
- This project uses pnpm workspaces
- Dev server runs on port 3001
- Staging DB is read-only on weekends
```

### Scope determination

The skill determines where to write based on context:

| Signal | Scope | Target file |
|--------|-------|-------------|
| "Remember for all projects..." | Global | `~/.claude/CLAUDE.md` |
| "Remember for this project..." | Project | `~/.claude/projects/<hash>/MEMORY.md` |
| No explicit scope, but project-specific info | Project (default) | `~/.claude/projects/<hash>/MEMORY.md` |
| Personal preference, coding style | Global | `~/.claude/CLAUDE.md` |

### Limitations of the skill

- It can only write to memory during an active session
- It does not organize or categorize memories — just appends
- Over time, memory files can become a disorganized list of facts
- The skill has no mechanism to update or remove stale memories
- No deduplication — saying "remember X" twice creates two entries
- No confirmation of what was written unless you ask to see the file

---

## 5. CLAUDE.md vs MEMORY.md

These two files serve distinct purposes and should not be conflated.

| Dimension | CLAUDE.md | MEMORY.md |
|-----------|-----------|-----------|
| **Authorship** | Manual — written by user or team | Auto-generated — Claude decides what to save |
| **Scope** | Team-shared (committed to git) | Local-only (never touches git) |
| **Purpose** | Persistent instructions, conventions, rules | Session learnings, corrections, discoveries |
| **Maintenance** | Manually curated and reviewed in PRs | Grows automatically; requires periodic pruning |
| **Loading** | Always loaded (global, project, directory levels) | Always loaded (first 200 lines of project MEMORY.md) |
| **Best for** | "How we work" — stable, intentional directives | "What Claude learned" — ephemeral, evolving knowledge |

### The `.claude/rules/` directory

All `.md` files placed in `.claude/rules/` are auto-loaded at the same priority as `CLAUDE.md`. This provides a way to split persistent instructions into multiple files without cluttering the root `CLAUDE.md`:

```
.claude/
  rules/
    testing.md        # Testing conventions
    api-standards.md  # API design rules
    naming.md         # Naming conventions
```

Every file in `rules/` is injected alongside `CLAUDE.md` — they are additive.

### When to use which

- **Rule, convention, or team standard** -> CLAUDE.md (or `.claude/rules/`)
- **Personal correction or session insight** -> MEMORY.md (auto or via `/memory`)
- **Validated learning ready for the team** -> Promote from MEMORY.md to CLAUDE.md

---

## 6. Memory vs Other Persistence Mechanisms

Claude Code has several persistence mechanisms beyond memory files. Understanding when to use each one prevents redundancy and keeps context efficient.

### Comparison table

| Mechanism | Scope | Persistence | Auto-loaded | Best for |
|-----------|-------|-------------|-------------|----------|
| `~/.claude/CLAUDE.md` | Global | Permanent | Yes, every session | Personal style, universal preferences |
| `<project>/CLAUDE.md` | Project | Permanent (git) | Yes, in project | Team conventions, architecture, commands |
| `<dir>/CLAUDE.md` | Directory | Permanent (git) | Yes, in that dir | Module-specific rules |
| `~/.claude/projects/<hash>/MEMORY.md` | Project | Permanent (local) | Yes, in project | Personal project notes, corrections |
| `/add` / `@file` | Session | Session only | No | One-off reference docs |
| Plans (markdown files) | Project | Permanent | No | Multi-step task breakdowns |
| Task tool (subagents) | Session | Session only | No | Parallel research, isolated work |
| Git commit messages | Project | Permanent (git) | No | Decision history (via `git log`) |

### Decision guide

**Use CLAUDE.md when:**
- The information applies to every session in a project (or globally)
- It's a rule, convention, or behavioral directive
- The whole team should benefit (project-level, committed to git)

**Use MEMORY.md when:**
- It's a personal observation or correction specific to your workflow
- It's project-specific but not appropriate for the whole team
- You want to quickly capture something mid-session without editing CLAUDE.md

**Use plans when:**
- You're working on a multi-step task and need to track progress
- The information is task-scoped and will be irrelevant after completion

**Use `/add` or `@file` when:**
- You need one-time reference material (API spec, design doc)
- The information is too large or too volatile for CLAUDE.md

---

## 7. Implementing Effective Long-Term Memory

### What to store

| Store | Don't store |
|-------|-------------|
| Project conventions and standards | Secrets, API keys, credentials |
| Build/run/test commands | Large code blocks (reference files instead) |
| Architectural decisions and rationale | Temporary workarounds (remove when fixed) |
| Common gotchas and pitfalls | Obvious defaults the model already knows |
| Team preferences (naming, formatting) | Conversation-specific context |
| File/directory purpose map | Duplicates of what's in README/docs |

### Structuring memory files

Flat bullet lists degrade quickly. Use sections:

```markdown
# Project: machine-cloud

## Architecture
- Monorepo managed by NX
- Frontend apps in apps/web-*, shared UI in libs/ui
- Backend services in apps/api-*, shared logic in libs/core

## Commands
- `pnpm install` — install deps
- `nx run api-gateway:serve` — start API locally
- `nx affected:test` — run tests for changed packages

## Conventions
- All API routes prefixed with /v1/
- Use DTOs for all request/response shapes (libs/dto)
- Never import directly from another app — use libs

## Gotchas
- TimescaleDB migrations must be run separately: `nx run db:migrate:timescale`
- The staging env uses a VPN — connect before running integration tests
- Port 5432 conflicts with local Postgres — use 5433 for dev
```

### Memory file size guidelines

- Keep `CLAUDE.md` under 500 lines — beyond this, startup context consumption becomes significant
- `MEMORY.md` has a **200-line hard limit** — only the first 200 lines are loaded; the rest is truncated with a warning
- If a memory file exceeds these limits, split into referenced files:

```markdown
# In CLAUDE.md
See @architecture.md for system design details.
See @conventions.md for coding standards.
```

### The memory lifecycle

```
Correction in session → "Remember this" → Appended to MEMORY.md
      ↓ (after validation)
Promoted to CLAUDE.md (structured, permanent)
      ↓ (when stale)
Pruned from CLAUDE.md
```

This lifecycle — capture, promote, prune — is the key to maintaining useful memory without bloat.

---

## 8. CLAUDE.md as Persistent Context

`CLAUDE.md` is the primary mechanism for long-term memory in Claude Code. It operates at three levels:

### Level 1: Global (`~/.claude/CLAUDE.md`)

- Read in every Claude Code session regardless of project
- Best for: personal preferences, communication style, universal coding standards

```
~/.claude/
  CLAUDE.md    <-- Always loaded
```

### Level 2: Project root (`<project>/CLAUDE.md`)

- Read when Claude Code is started from within the project directory
- Best for: project-specific rules, architecture overview, team conventions
- Committed to git so the whole team benefits

```
my-project/
  CLAUDE.md    <-- Loaded when working in my-project/
  src/
  package.json
```

### Level 3: Directory-level (`<project>/src/module/CLAUDE.md`)

- Read when Claude Code operates on files within that directory
- Best for: module-specific conventions, API contract details, migration rules

```
my-project/
  CLAUDE.md
  src/
    auth/
      CLAUDE.md    <-- Loaded when working on auth/ files
    billing/
      CLAUDE.md    <-- Loaded when working on billing/ files
```

### Precedence rules

- Directory-level overrides project-level on conflicts
- Project-level overrides global on conflicts
- All levels are additive (non-conflicting rules from all levels apply)

### Pros and cons of CLAUDE.md as memory

| Pros | Cons |
|------|------|
| Version-controlled (project-level) | Manually maintained |
| Shared across team | Can become stale without discipline |
| Hierarchical scoping | No automatic updates from corrections |
| Plain text, easy to audit | Consumes context window tokens |
| Works offline, no API dependency | No semantic search — full file is injected |

---

## 9. Limitations

### Context window constraints

- All memory files are injected into the system prompt, consuming tokens from the context window
- A 500-line CLAUDE.md might consume 2,000-4,000 tokens — significant when the context window is 200K tokens and you need room for code
- There is no semantic retrieval — the entire file is loaded, not just relevant sections

### Memory file size limits

- No hard technical limit, but files beyond ~1,000 lines cause noticeable degradation:
  - Slower session startup
  - Less room for actual work context
  - Model may "forget" instructions buried deep in long files (lost-in-the-middle effect)

### Staleness

- Memories are never automatically pruned or updated
- A memory like "the API uses Express" remains even after migrating to Fastify
- No mechanism to detect or flag contradictions between memories
- No expiration dates or timestamps on individual memory entries

### Cross-session learning (partially addressed by auto memory)

- Prior to auto memory, Claude Code had zero cross-session learning — every session started from scratch
- Auto memory (2026) partially addresses this: Claude now saves learnings to MEMORY.md automatically, meaning subsequent sessions benefit from prior corrections and discoveries
- However, there is still no true feedback loop — Claude does not evaluate whether past memories led to good or bad outcomes
- The 200-line limit on MEMORY.md constrains how much cross-session knowledge can accumulate

### No semantic search or retrieval

- Unlike RAG-based systems, Claude Code loads all memories regardless of relevance
- Working on frontend code still loads backend memories and vice versa (at the project level)
- Directory-level CLAUDE.md files mitigate this but only for committed project files, not for `MEMORY.md`

### No memory sharing

- `~/.claude/` is local to your machine
- Team members cannot share project memories unless they commit `CLAUDE.md` to git
- `MEMORY.md` files in `~/.claude/projects/` are inherently personal and non-portable
- No sync mechanism between machines (e.g., home and work laptops get separate memories)

### No conflict resolution

- If `CLAUDE.md` says "use Express" and `MEMORY.md` says "use Fastify," both are injected and the model must resolve the contradiction on its own
- No tooling to detect or surface these conflicts
- The model generally favors more recent/specific information, but behavior is not guaranteed

---

## 10. 2026 Evolution and Roadmap

The memory system has evolved significantly in 2026. Key developments:

### Auto memory (shipped)

- Claude autonomously saves session learnings to MEMORY.md without user action
- On by default for all users
- 200-line hard limit with topic-file overflow strategy
- See [Section 3](#3-auto-memory-memorymd--2026-feature) for full details

### Team collaborative memory (in development)

- Features for sharing memory across team members are in progress
- Goal: bridge the gap between local-only MEMORY.md and team-shared CLAUDE.md
- Expected to allow teams to pool session learnings while maintaining individual preferences

### CLAUDE.md templates by project type

- Pre-built CLAUDE.md templates for common project types (NestJS API, React app, Python library, etc.)
- Reduces onboarding friction for new projects
- Templates provide sensible defaults that teams can customize

### Pre-compact hooks

- Hook system that fires before auto-compaction of the context window
- Allows backing up critical context before Claude Code truncates conversation history
- Enables custom logic for preserving session state across compaction boundaries

---

## 11. Workarounds and Advanced Strategies

### Strategy 1: Tiered memory architecture

Split information across multiple files by stability and scope:

```
~/.claude/CLAUDE.md                    # Rarely changes: personal style, global prefs
<project>/CLAUDE.md                    # Changes quarterly: architecture, conventions
<project>/docs/claude/                 # Reference docs, imported on demand
  api-contracts.md
  database-schema.md
  deployment-guide.md
```

Use `@file` references in CLAUDE.md to pull in specific docs only when needed rather than loading everything.

### Strategy 2: Regular memory pruning

Schedule monthly reviews of memory files:

```bash
# Quick audit: show all memory files and their sizes
find ~/.claude -name "MEMORY.md" -exec wc -l {} \;
find . -name "CLAUDE.md" -exec wc -l {} \;
```

Remove entries that are:
- No longer accurate
- Duplicated elsewhere
- Too specific to a past task
- Already captured in project documentation

### Strategy 3: Session bootstrapping

For complex tasks, create a "session bootstrap" file:

```markdown
# Current Sprint Context

## Active work
- Migrating auth service from Express to Fastify (MC-1234)
- Target: apps/api-auth/

## Key files
- apps/api-auth/src/main.ts — entry point (being rewritten)
- libs/auth-core/src/strategies/ — passport strategies (keeping as-is)
- apps/api-auth/test/ — integration tests (must all pass before merge)

## Decisions made
- Using @fastify/passport for strategy compat
- Keeping session store in Redis (no change)
- New health check endpoint at /healthz (replaces /health)
```

Load it with `/add session-context.md` at the start of each session.

### Strategy 4: Git-committed CLAUDE.md with team conventions

```markdown
# In project CLAUDE.md (committed to git)

## For all contributors using Claude Code
- Run `pnpm install` after pulling — lock file changes frequently
- Tests: `nx affected:test --base=master`
- Lint: `nx affected:lint --base=master`
- This repo uses conventional commits: feat|fix|chore|refactor(scope): message

## Architecture
- See docs/architecture.md for full system diagram
- API gateway: apps/gateway (Fastify + NestJS)
- Frontend: apps/web (React + Vite)
- Shared types: libs/types (source of truth for all interfaces)
```

### Strategy 5: Use directory-level CLAUDE.md for module isolation

Prevent memory bloat by scoping instructions to where they're relevant:

```
apps/
  api-gateway/
    CLAUDE.md  # "This service uses Fastify. Routes are in src/routes/.
                #  All routes must have OpenAPI decorators."
  web/
    CLAUDE.md  # "React app with Vite. Use Material-UI v5 components.
                #  State management via Zustand, not Redux."
libs/
  database/
    CLAUDE.md  # "TypeORM entities. Never modify existing migrations.
                #  Use TimescaleDB hypertables for time-series data."
```

### Strategy 6: The capture-promote-prune cycle

The most effective long-term memory strategy is a three-phase cycle:

**Phase 1 — Capture:** During sessions, use "remember this" or `/memory` to quickly save corrections and discoveries to `MEMORY.md`. Don't worry about organization.

**Phase 2 — Promote:** Weekly (or after a burst of work), review `MEMORY.md`. Move validated, stable facts into the structured `CLAUDE.md` in the appropriate section. Reword them as imperative directives.

**Phase 3 — Prune:** Monthly, audit both files. Remove entries that are stale, redundant, or too granular. The goal is to keep total memory under the size guidelines.

```
MEMORY.md (raw capture, personal, temporary)
    ↓ promote validated items
CLAUDE.md (structured, team-shared, permanent)
    ↓ prune stale items
/dev/null
```

### Strategy 7: Automated memory management script

```bash
#!/bin/bash
# claude-memory-audit.sh
# Run periodically to check memory health

echo "=== Global CLAUDE.md ==="
wc -l ~/.claude/CLAUDE.md 2>/dev/null || echo "Not found"

echo ""
echo "=== Project MEMORY.md files ==="
for f in ~/.claude/projects/*/MEMORY.md; do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    echo "  $f: $lines lines"
    if [ "$lines" -gt 200 ]; then
      echo "    WARNING: exceeds 200 line recommendation"
    fi
  fi
done

echo ""
echo "=== Project CLAUDE.md files ==="
find . -name "CLAUDE.md" -not -path "*/node_modules/*" -exec sh -c '
  lines=$(wc -l < "$1")
  echo "  $1: $lines lines"
' _ {} \;
```

---

## 12. Practical Examples

### Example 1: New project onboarding

**Day 1 — Create project CLAUDE.md:**

```markdown
# Project: invoice-service

## Stack
- NestJS + Fastify
- TypeORM + PostgreSQL 15
- pnpm workspaces

## Commands
- `pnpm dev` — start with hot reload
- `pnpm test` — jest tests
- `pnpm db:migrate` — run migrations

## Structure
- src/modules/ — feature modules (invoices, payments, customers)
- src/common/ — shared decorators, guards, pipes
- src/database/ — entities, migrations, seeds
```

**Day 3 — After getting corrections, add memories:**

```
> "Remember: this project uses class-validator for DTOs, not zod"
> "Remember: all endpoints need @ApiTags decorator for Swagger grouping"
```

These get appended to `~/.claude/projects/<hash>/MEMORY.md`.

**Day 10 — Prune and consolidate:**

Move validated memories from `MEMORY.md` into the structured `CLAUDE.md`:

```markdown
## Conventions
- DTOs use class-validator (not zod)
- All endpoints require @ApiTags decorator for Swagger
- ...
```

Clear the now-redundant entries from `MEMORY.md`.

### Example 2: Multi-module monorepo workflow

```
machine-cloud/
  CLAUDE.md                    # NX commands, git conventions, CI info
  apps/
    web-dashboard/
      CLAUDE.md                # React, MUI, Zustand specifics
    api-gateway/
      CLAUDE.md                # NestJS, Fastify, route patterns
    machine-logic/
      CLAUDE.md                # Python, Poetry, MQTT protocols
  libs/
    types/
      CLAUDE.md                # "Source of truth. Never duplicate types."
    ui/
      CLAUDE.md                # "MUI theme customization in theme.ts"
```

When editing `apps/web-dashboard/src/pages/Dashboard.tsx`, Claude Code loads:
1. `~/.claude/CLAUDE.md` (global)
2. `machine-cloud/CLAUDE.md` (project root)
3. `machine-cloud/apps/web-dashboard/CLAUDE.md` (directory-level)

It does NOT load `api-gateway/CLAUDE.md` or `machine-logic/CLAUDE.md` — scoping keeps context focused.

### Example 3: Evolving memory over time

**Week 1 MEMORY.md:**
```markdown
- Use pnpm not npm
- Tests are in __tests__ directories
- Database is PostgreSQL
```

**Week 4 MEMORY.md (after pruning + restructuring):**
```markdown
# Consolidated into CLAUDE.md — see project root.
# Only active/temporary items below:

- Migration to Fastify in progress — apps/api-auth is partially converted
- Temporary: skip e2e tests in CI until Docker fix lands (MC-2100)
```

**Week 8 MEMORY.md:**
```markdown
# Temporary items only:

(empty — all items either promoted to CLAUDE.md or no longer relevant)
```

---

## 13. Best Practices Checklist

### Memory organization

- [ ] Global `CLAUDE.md` contains only universal, cross-project preferences
- [ ] Project `CLAUDE.md` committed to git with team conventions
- [ ] Directory-level `CLAUDE.md` files used for module isolation in monorepos
- [ ] `MEMORY.md` treated as a personal scratch pad, not a permanent store

### Auto memory management

- [ ] Monitor MEMORY.md line count — stay under the 200-line hard limit
- [ ] Use topic files (debugging.md, api-conventions.md) for detailed content
- [ ] Keep MEMORY.md as a concise index pointing to topic files
- [ ] Review auto-saved memories periodically — remove noise, promote valuable items

### Memory hygiene

- [ ] Total memory across all levels stays under 1,500 tokens (~150 lines combined)
- [ ] Monthly pruning of `MEMORY.md` — promote or delete every item
- [ ] Quarterly review of `CLAUDE.md` — remove stale instructions
- [ ] No secrets, credentials, or sensitive data in any memory file
- [ ] No duplicated information between `CLAUDE.md` and `MEMORY.md`

### Memory quality

- [ ] Every line in `CLAUDE.md` is an imperative directive, not documentation
- [ ] Corrections from sessions are captured via `/memory` or "remember this"
- [ ] Validated corrections are promoted from `MEMORY.md` to `CLAUDE.md`
- [ ] Most important rules placed at the top of each file (primacy bias)
- [ ] No narrative prose — bullets and tables only

### Team practices

- [ ] Project `CLAUDE.md` is reviewed in PRs like any other code
- [ ] New team members read `CLAUDE.md` to verify accuracy
- [ ] `CLAUDE.md` is updated same-day after major tooling/framework changes
- [ ] The `claude-md-improver` skill is run quarterly for automated audit

---

## 14. Sources

1. Anthropic, "Claude Code Documentation — Memory" — [docs.anthropic.com/en/docs/claude-code/memory](https://docs.anthropic.com/en/docs/claude-code/memory) [SOURCE DATE: 2025-03]
2. Anthropic, "Claude Code Overview" — [docs.anthropic.com/en/docs/claude-code](https://docs.anthropic.com/en/docs/claude-code) [SOURCE DATE: 2025-02]
3. Anthropic GitHub, "Claude Code" — [github.com/anthropics/claude-code](https://github.com/anthropics/claude-code) [SOURCE DATE: 2025-04]
4. Anthropic, "Best practices for Claude Code" — [docs.anthropic.com/en/docs/claude-code/best-practices](https://docs.anthropic.com/en/docs/claude-code/best-practices) [SOURCE DATE: 2025-03]
5. Direct observation of Claude Code CLI behavior and `~/.claude/` directory structure — author's usage [SOURCE DATE: 2025-01 through 2026-03]
6. Anthropic, "Claude Code Memory" — [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) [SOURCE DATE: 2026]
7. Joe Njenga, "Anthropic Just Added Auto Memory to Claude Code (MEMORY.md) — I Tested It" — [medium.com/@joe.njenga/anthropic-just-added-auto-memory-to-claude-code-memory-md-i-tested-it-0ab8422754d2](https://medium.com/@joe.njenga/anthropic-just-added-auto-memory-to-claude-code-memory-md-i-tested-it-0ab8422754d2) [SOURCE DATE: 2026]
8. Jose Parreo Garcia, "Claude Code Memory Explained" — [joseparreogarcia.substack.com/p/claude-code-memory-explained](https://joseparreogarcia.substack.com/p/claude-code-memory-explained) [SOURCE DATE: 2026]
9. Giuseppe Gurgone, "Claude Memory" — [giuseppegurgone.com/claude-memory](https://giuseppegurgone.com/claude-memory) [SOURCE DATE: 2026]
10. Yuan Chang, "Claude Code Auto Memory and Hooks" — [yuanchang.org/en/posts/claude-code-auto-memory-and-hooks/](https://yuanchang.org/en/posts/claude-code-auto-memory-and-hooks/) [SOURCE DATE: 2026]
11. Agent Native Dev, "Persistent Memory for Claude Code: Never Lose Context Setup Guide" — [agentnativedev.medium.com/persistent-memory-for-claude-code-never-lose-context-setup-guide-2cb6c7f92c58](https://agentnativedev.medium.com/persistent-memory-for-claude-code-never-lose-context-setup-guide-2cb6c7f92c58) [SOURCE DATE: 2026]

> **Note:** Original content was based on Anthropic's published documentation and direct system behavior observation (pre-WebSearch). Updated 2026-03-11 with web research data covering auto memory (MEMORY.md), the 200-line limit, memory directory structure, `.claude/rules/` auto-loading, and 2026 roadmap features. Readers should verify specific implementation details against current official docs at [docs.anthropic.com](https://docs.anthropic.com).

---

*Generated 2026-03-11. Review and update quarterly or after major project changes.*
