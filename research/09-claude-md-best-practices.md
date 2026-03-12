# CLAUDE.md Best Practices

## Summary

CLAUDE.md is Claude Code's project memory file — a markdown file that provides persistent instructions, conventions, and context to Claude across sessions. It operates at three levels (global, project, directory), is automatically loaded into context at the start of every conversation, and directly influences how Claude understands and works within your codebase. Getting CLAUDE.md right means Claude follows your conventions from the first prompt; getting it wrong means wasted context tokens, ignored instructions, or contradictory behavior.

This document covers what belongs in a CLAUDE.md, what does not, how to structure it, common mistakes, real-world examples, maintenance strategies, and the performance implications of file size.

---

## Table of Contents

1. [What is CLAUDE.md?](#1-what-is-claudemd)
2. [What Belongs in a CLAUDE.md](#2-what-belongs-in-a-claudemd)
3. [What Does NOT Belong](#3-what-does-not-belong)
4. [The Three-Level Hierarchy in Depth](#4-the-three-level-hierarchy-in-depth)
5. [Structure and Formatting Recommendations](#5-structure-and-formatting-recommendations)
6. [Common Mistakes to Avoid](#6-common-mistakes-to-avoid)
7. [Examples of High-Quality CLAUDE.md Files](#7-examples-of-high-quality-claudemd-files)
8. [How CLAUDE.md Interacts with Memory, Skills, and Other Config](#8-how-claudemd-interacts-with-memory-skills-and-other-config)
9. [The `/claude-md-improver` Skill](#9-the-claude-md-improver-skill)
10. [CLAUDE.md Maintenance](#10-claudemd-maintenance)
11. [Impact on Performance](#11-impact-on-performance)
12. [Template / Skeleton](#12-template--skeleton)
13. [Sources](#13-sources)

---

## 1. What is CLAUDE.md?

### Purpose

CLAUDE.md is a special markdown file recognized by Claude Code (Anthropic's CLI agent). It serves as a **persistent instruction set** that Claude reads automatically at the start of every conversation. Think of it as `.editorconfig` or `.eslintrc` but for an AI coding assistant — it tells Claude *how* to work in your project.

### How Claude Code Uses It

When Claude Code starts a session, it scans for CLAUDE.md files and injects their contents into the system prompt as context. These instructions override Claude's default behaviors. The contents appear as a `system-reminder` that Claude is told to follow exactly.

Key behaviors:
- CLAUDE.md is loaded **automatically** — no user action required.
- Instructions in CLAUDE.md are treated as **high-priority directives** that override defaults.
- Claude is instructed that "project-level rules override global rules where they conflict."
- The file is read at session start; changes mid-session require restarting the conversation.

### The Three-Level Hierarchy

CLAUDE.md operates at three levels, loaded in order from broadest to most specific:

| Level | Location | Scope | Example Use |
|-------|----------|-------|-------------|
| **Global** | `~/.claude/CLAUDE.md` | All projects, all repos | Personal preferences: communication style, git workflow, security rules |
| **Project** | `<project-root>/CLAUDE.md` | Entire repository | Tech stack, architecture, testing patterns, deployment info |
| **Directory** | `<subdir>/CLAUDE.md` | Specific directory tree | Module-specific conventions, package-level overrides |

**Conflict resolution:** More specific files override more general ones. A directory-level CLAUDE.md overriding a project-level instruction takes precedence. A project-level CLAUDE.md overriding a global instruction takes precedence.

**Cross-reference:** This hierarchy is documented in Anthropic's official Claude Code documentation (docs.anthropic.com) and reinforced in the Claude Code GitHub repository README.

---

## 2. What Belongs in a CLAUDE.md

### The Golden Rule

Include information that Claude **cannot infer from the codebase itself** and that **changes how Claude should behave**. If the information is already encoded in config files, linters, or type definitions, Claude can usually pick it up on its own.

### The WHAT / WHY / HOW Framework

Structure your CLAUDE.md content around three pillars:

| Pillar | What to Write | Example |
|--------|--------------|---------|
| **WHAT** | Tech stack, project structure, key dependencies | "Monorepo: NX. Frontend: React + MUI. Backend: NestJS + TypeORM." |
| **WHY** | Purpose of the project — one-liner is enough | "Internal tool for managing factory machine configurations." |
| **HOW** | Everything Claude needs to do meaningful work — conventions, commands, workflows, gotchas | "Run `pnpm test:affected` before committing. Never import from `@internal/legacy`." |

The HOW pillar typically contains the most lines. It should cover: code style, bash commands for build/test/lint/deploy, workflow rules, and known gotchas that would otherwise trip Claude up.

### The Removal Test

For every line in your CLAUDE.md, ask: **"Would removing this cause Claude to make mistakes?"** If the answer is no, cut it. Bloated CLAUDE.md files cause Claude to **ignore your actual instructions** — shorter files get better compliance.

### Recommended Content by Category

#### Project Identity and Stack
- Language(s) and framework(s) with versions if relevant
- Monorepo structure (e.g., NX, Turborepo, Lerna workspace layout)
- Key architectural patterns (e.g., "backend uses CQRS with NestJS")

#### Code Conventions
- Naming conventions not enforced by linters (e.g., "branch naming: `MC-{ticket}-{short-description}`")
- Export preferences (e.g., "prefer named exports over default exports")
- TypeScript strictness expectations (e.g., "no `any` — use explicit types or proper generics")
- Patterns specific to the team that deviate from community norms

#### Workflow Instructions
- Git workflow (branching strategy, commit message format, PR process)
- How to run tests, build, and deploy
- CI/CD context that affects how Claude should write code
- Which commands to use (and avoid)

#### Testing Patterns
- Test framework and runner (e.g., "Jest with React Testing Library")
- Test file location conventions (e.g., "co-located `__tests__` directories")
- Coverage expectations or requirements

#### Architecture Notes
- Directory structure overview for non-obvious layouts
- Service boundaries and communication patterns
- Database and ORM conventions
- Key environment variables and configuration mechanisms

#### Behavioral Directives
- Communication style preferences (e.g., "be concise and direct")
- What Claude should and should not do autonomously
- Security rules (e.g., "never commit secrets")

---

## 3. What Does NOT Belong

### Information Better Served Elsewhere

| Do Not Include | Why | Better Mechanism |
|----------------|-----|------------------|
| Exhaustive API documentation | Consumes too many tokens; Claude can read source files | Code comments, OpenAPI specs, dedicated docs |
| Full file tree listings | Stale quickly; Claude can explore with tools | `tree` command, `ls` |
| Git history or changelog | Already available via `git log` | Git itself |
| Inline code explanations | Duplicates what's in the source | Code comments |
| Linter/formatter rules already in config | Claude reads `.eslintrc`, `prettier.config`, `tsconfig.json` | Config files |
| Large example datasets | Wastes context tokens | Separate fixture files |
| Credentials, API keys, secrets | Security risk — CLAUDE.md is often committed to the repo | `.env` files, secret managers |
| Emotional or motivational language | Adds noise, no behavioral effect | Nowhere — skip it |
| Instructions for other AI tools | Confuses scope | `.cursorrules`, `.github/copilot-instructions.md`, etc. |

### The Duplication Test

Before adding something to CLAUDE.md, ask: **"If I deleted this line, would Claude still do the right thing by reading the codebase?"** If yes, it does not belong.

---

## 4. The Three-Level Hierarchy in Depth

The hierarchy table in Section 1 gives an overview. This section covers practical strategies for using each level effectively.

### Global (`~/.claude/CLAUDE.md`)

This file applies to **every project** you open with Claude Code. It should contain only truly universal preferences:

- Communication style (concise, verbose, etc.)
- Code style defaults that apply across all your work (e.g., "no `any` in TypeScript")
- Git workflow conventions that are personal, not project-specific
- Security rules you always want enforced (e.g., "never commit secrets")
- MCP server configuration notes (which servers are always-on vs on-demand)

**Do not put project-specific stack details here.** If you work in both Python and TypeScript repos, a global rule saying "use TypeScript strict mode" will confuse Claude in Python projects.

**Size target:** Under 30 lines.

### Project Root (`<repo>/CLAUDE.md`)

This is the primary CLAUDE.md for most teams. It describes the specific repository:

- Tech stack and architecture
- Project-specific code conventions
- Build, test, and deploy commands
- Branching and PR conventions for this repo
- Directory structure overview (only if non-obvious)

This file is typically committed to version control so the entire team benefits.

**Size target:** Under 100 lines.

### Subdirectory (`<repo>/<subdir>/CLAUDE.md`)

Use directory-level files when a subdirectory has conventions that differ from or extend the project root. Common in monorepos:

```
apps/
  web/CLAUDE.md          # Next.js-specific conventions
  api/CLAUDE.md          # NestJS-specific conventions
packages/
  db/CLAUDE.md           # Migration and schema conventions
  ui/CLAUDE.md           # Component library patterns
```

**Key rule:** Directory CLAUDE.md files are only loaded when Claude is working within that directory tree. This makes them both more targeted and more efficient than stuffing everything into the project root.

**Size target:** Under 10 lines per directory file.

### The `.claude/rules/` Directory

In addition to CLAUDE.md files, Claude Code supports a `.claude/rules/` directory at the project root. All `.md` files placed in this directory are **automatically loaded with the same priority as CLAUDE.md** — no imports or references needed. Just drop files in and they are included.

This is useful for:
- Splitting a large CLAUDE.md into topic-specific rule files (e.g., `testing.md`, `security.md`, `git.md`)
- Letting different team members own different rule files without merge conflicts
- Keeping the root CLAUDE.md lean while still providing comprehensive instructions

### Bootstrapping with `/init`

Running `/init` in Claude Code generates a **starter CLAUDE.md** based on the current project structure. It inspects `package.json`, config files, directory layout, and other signals to produce a reasonable first draft. Start here, then refine reactively.

### Conflict Resolution Order

When the same topic is addressed at multiple levels, the most specific level wins:

```
Directory CLAUDE.md  >  Project CLAUDE.md  >  Global CLAUDE.md
```

Example: Global says "use semicolons." Project says "no semicolons." Claude follows the project rule. A subdirectory file saying "use semicolons in generated migration files" would override the project rule — but only within that subdirectory.

### What Goes Where — Decision Matrix

| Instruction Type | Global | Project | Directory |
|---|---|---|---|
| "Be concise" | Yes | No | No |
| "TypeScript strict, no `any`" | Maybe | Yes | No |
| "Branch naming: `MC-{ticket}-{desc}`" | If personal | If team convention | No |
| "Use Drizzle ORM, no raw SQL" | No | Yes | No |
| "Migration files: never edit after commit" | No | No | Yes (`packages/db/`) |
| "Never commit secrets" | Yes | Reinforce if critical | No |

---

## 5. Structure and Formatting Recommendations

### Principles

1. **Brevity wins.** Every token in CLAUDE.md is loaded into every conversation. Treat it like expensive real estate.
2. **Scannable over prose.** Use bullet points, tables, and short headings. Avoid paragraphs.
3. **Imperative mood.** Write instructions as directives: "Use named exports" not "We prefer named exports because..."
4. **Group logically.** Use `##` headings to create clear sections.
5. **Flat over nested.** Avoid deeply nested bullet lists — two levels maximum.

### Recommended Section Order

```
# Project Name (optional — one line)

## Stack / Architecture (brief)
## Code Conventions
## Git Workflow
## Testing
## Build & Deploy
## Security
## Behavioral Preferences (communication style, autonomy level)
```

### 10 Sections to Consider (UX Planet Reference)

A comprehensive CLAUDE.md can draw from up to 10 sections (see [UX Planet — Claude.md Best Practices](https://uxplanet.org/claude-md-best-practices-1ef4f861ce7c)):

1. **Project overview** — one-liner on what this project is and why it exists
2. **Tech stack** — languages, frameworks, key dependencies
3. **Project structure** — directory layout (only if non-obvious)
4. **Code style** — conventions not enforced by linters/formatters
5. **Naming conventions** — files, branches, variables, components
6. **Commands** — build, test, lint, deploy, database scripts
7. **Testing patterns** — framework, location, coverage expectations
8. **Git workflow** — branching, commit format, PR process
9. **Architecture decisions** — patterns, boundaries, constraints
10. **Gotchas / known issues** — things that would trip up anyone new

Not every project needs all 10. Delete sections where you have nothing project-specific to say.

### Formatting Do's and Don'ts

**Good: Concise, imperative, scannable**
```markdown
## Code Conventions
- TypeScript strict mode, no `any`.
- Named exports only — no default exports.
- Prefer `const` arrow functions for React components.
```

**Bad: Verbose, explanatory, paragraph-heavy**
```markdown
## Code Conventions
When writing TypeScript code in this project, we always use strict mode. The reason
for this is that strict mode catches more errors at compile time and makes the code
more maintainable. We also don't use the `any` type because it defeats the purpose
of TypeScript. Instead, you should use explicit types or proper generics. We also
prefer named exports over default exports because they make refactoring easier and
provide better IDE support.
```

The good example is 3 lines and 27 tokens. The bad example is 7 lines and 80+ tokens. Both convey the same instructions. The bad example wastes 53+ tokens *per conversation*.

---

## 6. Common Mistakes to Avoid

### 1. Being Too Verbose
CLAUDE.md is injected into every conversation's context window. A 2,000-line CLAUDE.md leaves less room for actual code analysis. **Target under 200 lines per file.** CLAUDE.md is loaded every session — only include things that apply broadly. For domain knowledge or workflows that are only sometimes relevant, use **skills** instead (they load on-demand and don't consume tokens every turn). If you still need more, split into directory-level files.

### 2. Duplicating What's Already in Code
If your `tsconfig.json` has `"strict": true`, you do not need to say "use TypeScript strict mode" in CLAUDE.md. However, if you want to emphasize a convention that goes *beyond* what config enforces (e.g., "no `any` even in test files"), that is worth including.

### 3. Stale Instructions
CLAUDE.md files rot like any documentation. A CLAUDE.md that says "we use Webpack" when the project migrated to Vite six months ago will cause Claude to generate wrong build commands. **Review CLAUDE.md when you change tooling, frameworks, or major conventions.**

### 4. Contradictions Between Levels
If your global CLAUDE.md says "always use semicolons" and your project CLAUDE.md says "no semicolons," Claude will follow the project-level instruction (more specific wins). But contradictions create confusion and waste context. Avoid them — keep global rules truly global and project rules project-specific.

### 5. Including Secrets
CLAUDE.md is typically committed to version control. Never put API keys, database passwords, or tokens in it. Use environment variables and reference them by name only.

### 6. Writing for Humans Instead of Claude
CLAUDE.md is read by Claude, not by your teammates (though humans benefit from it too). Write actionable instructions, not documentation. "Use React Query for server state" is useful. "React Query is a library for managing server state in React applications" is not — Claude already knows what React Query is.

### 7. Overriding Claude's Strengths
Do not include instructions like "always add JSDoc to every function" — this micromanages Claude into verbosity. Instead, specify exceptions: "Add JSDoc only to exported public API functions."

---

## 7. Examples of High-Quality CLAUDE.md Files

### Example A: Global CLAUDE.md (Personal Preferences)

```markdown
# Global Configuration

## Communication
- Be concise and direct.
- Execute commands — don't show theoretical examples.
- Don't ask for confirmation on routine actions.

## Code Style (All Projects)
- TypeScript strict mode, no `any`.
- Prefer named exports over default exports.
- Don't add comments to code you didn't change.

## Git Workflow
- Branch from `master` unless told otherwise.
- Branch naming: `PROJ-{ticket}-{short-description}`.
- Never force-push without asking.

## Security
- Never commit secrets, API keys, or .env files.
- Flag any credentials found during reviews.
```

**Why it works:** 18 lines. Applies universally. No project-specific detail. Every line changes behavior.

### Example B: Project-Level CLAUDE.md (Full-Stack Web App)

```markdown
# my-saas-app

## Stack
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Backend: tRPC, Drizzle ORM, PostgreSQL
- Auth: NextAuth.js v5
- Monorepo: Turborepo (`apps/web`, `packages/db`, `packages/ui`)

## Code Conventions
- React components: named arrow function exports, co-located styles.
- Server actions in `app/_actions/` — never in component files.
- Database queries only through Drizzle — no raw SQL.
- Zod schemas co-located with tRPC routers in `packages/api/src/routers/`.

## Testing
- Vitest for unit tests. Playwright for E2E.
- Unit tests co-located: `foo.test.ts` next to `foo.ts`.
- E2E tests in `apps/web/e2e/`.
- Run: `pnpm test` (unit), `pnpm test:e2e` (E2E).

## Git
- PR titles: `feat|fix|chore|refactor: short description`.
- Squash merge to `main`.

## Deployment
- Vercel (frontend), Railway (database).
- Env vars in `.env.local` (never committed). Schema in `env.mjs`.
```

**Why it works:** 24 lines. Covers the full development lifecycle. Every line either prevents a mistake or saves a question. No fluff.

### Example C: Directory-Level CLAUDE.md (Specific Package)

```markdown
# packages/db

## Conventions
- All schema changes go through Drizzle migrations: `pnpm db:generate`.
- Never modify migration files after they've been committed.
- Seed data in `src/seed.ts` — run with `pnpm db:seed`.
- Export all table schemas from `src/schema/index.ts`.
```

**Why it works:** 5 lines. Only includes what's specific to this directory. Does not repeat project-level instructions.

### Anti-Example: What NOT to Do

```markdown
# My Project

## About
This is a web application built with React and Node.js. It was started in 2023
by the engineering team to replace our legacy PHP application. The project uses
a modern tech stack and follows best practices for web development.

## Team
- John: Frontend lead
- Sarah: Backend lead
- Mike: DevOps

## History
- v1.0: Initial release (Jan 2023)
- v1.1: Added user dashboard (Mar 2023)
- v1.2: Migrated to TypeScript (Jun 2023)
...

## All NPM Scripts
- `npm run dev` — starts development server
- `npm run build` — builds for production
- `npm run test` — runs tests
- `npm run lint` — runs ESLint
- `npm run format` — runs Prettier
- `npm run typecheck` — runs TypeScript compiler
- `npm run storybook` — starts Storybook
- `npm run analyze` — bundle analyzer
...
```

**Why it fails:**
- "About" section is narrative — Claude doesn't need a project history lesson.
- Team roster is irrelevant to code generation.
- Version history belongs in a CHANGELOG or git tags.
- NPM scripts are already in `package.json` — Claude reads that directly.
- This file is 30+ lines and teaches Claude nothing actionable.

---

## 8. How CLAUDE.md Interacts with Memory, Skills, and Other Config

CLAUDE.md does not operate in isolation. It is one layer in a stack of configuration and context mechanisms. Understanding how these interact prevents duplication and conflicts.

### CLAUDE.md vs MEMORY.md

| | CLAUDE.md | MEMORY.md |
|---|---|---|
| **Location** | Repo root, subdirectories, `~/.claude/` | `~/.claude/projects/<hash>/MEMORY.md` |
| **Who writes it** | You (manually) | Claude (via `/memory` skill or "remember this") |
| **Committed to git** | Typically yes (project-level) | No — user-local only |
| **Content type** | Prescriptive instructions ("do X, don't do Y") | Descriptive facts ("user prefers X", "project uses Y") |
| **When loaded** | Every session, automatically | Every session, automatically |
| **Shared with team** | Yes (if committed) | No — per-user, per-machine |

**Best practice:** Use CLAUDE.md for **team conventions** and MEMORY.md for **personal context** that Claude should remember but that doesn't belong in version control. Example: "I'm currently working on the payments refactor" goes in memory. "All API endpoints must use Zod validation" goes in CLAUDE.md.

**Avoid duplication:** If CLAUDE.md says "use Vitest" and MEMORY.md also says "this project uses Vitest," you're wasting tokens. Memory should capture things CLAUDE.md doesn't cover — recent decisions, current work context, user preferences that are too personal for the team file.

### CLAUDE.md vs `.claude/settings.json`

`settings.json` is for **tool-level configuration** — MCP servers, allowed tools, permission grants. CLAUDE.md is for **behavioral instructions**. They complement each other:

```
.claude/settings.json     →  "Which tools are available?"
CLAUDE.md                 →  "How should Claude behave?"
```

Do not try to configure MCP servers in CLAUDE.md (it won't work). Do not try to set behavioral instructions in `settings.json` (also won't work). Each file has its lane.

### CLAUDE.md and Skills

Skills (invoked via `/skill-name`) are reusable prompt-and-tool bundles. CLAUDE.md can reference skills but cannot define them. The interaction:

- CLAUDE.md can instruct Claude to **use specific skills** in certain situations (e.g., "Use the `/commit` skill for all commits").
- CLAUDE.md can set conventions that **skills must follow** — since CLAUDE.md instructions are loaded as high-priority directives, they influence skill behavior.
- Skills can **modify CLAUDE.md** — notably `/claude-md-improver` and `/memory` (which writes to MEMORY.md, not CLAUDE.md, but the principle applies).

### CLAUDE.md and MCP Servers

MCP servers provide tools; CLAUDE.md provides instructions. They interact in one key way: CLAUDE.md can contain directives about **when to use MCP tools**. Example:

```markdown
## MCP Servers
Always active: context7, notion, github.
On-demand: playwright (activate with `mcp-on playwright`), figma (activate with `mcp-on figma`).
When a task involves UI testing, ask before activating playwright.
```

This is useful because it prevents Claude from attempting to call MCP tools that aren't loaded, and guides Claude on activation etiquette.

### CLAUDE.md and `.cursorrules` / Other AI Config

If your team uses multiple AI tools, keep instructions separate:

| File | AI Tool |
|---|---|
| `CLAUDE.md` | Claude Code |
| `.cursorrules` | Cursor |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.windsurfrules` | Windsurf |

Do not put Cursor-specific instructions in CLAUDE.md or vice versa. If there's significant overlap, maintain each file independently — the cost of a few duplicated lines is lower than the confusion of cross-tool instructions.

### The Full Context Stack (Load Order)

When Claude Code starts a session, context is assembled in this order:

```
1. System prompt (Claude Code's built-in instructions)
2. ~/.claude/CLAUDE.md (global user preferences)
3. <project>/CLAUDE.md (project instructions)
4. <subdir>/CLAUDE.md (directory-specific, if applicable)
5. ~/.claude/projects/<hash>/MEMORY.md (project memories)
6. MCP tool definitions (from settings.json)
7. Available skills (tool definitions)
8. Session-specific context (/add, @ references)
9. Conversation history
```

Items higher in the list are overridden by more specific items lower in the list (for CLAUDE.md hierarchy). But all of them compete for the same context window.

---

## 9. The `/claude-md-improver` Skill

### What It Does

`/claude-md-improver` is a built-in Claude Code skill that audits your CLAUDE.md file against your actual codebase. It bridges the gap between what your CLAUDE.md says and what your project actually does.

### How to Invoke

Type `/claude-md-improver` in the Claude Code CLI. It runs as a skill within the current session.

### What It Analyzes

1. **Your existing CLAUDE.md** — reads the current file content.
2. **Codebase signals** — scans `package.json`, `tsconfig.json`, `.eslintrc`, directory structure, test files, CI config, and other indicators of conventions.
3. **Gaps** — identifies conventions in the codebase that aren't documented in CLAUDE.md.
4. **Staleness** — flags instructions that contradict what the codebase actually does (e.g., CLAUDE.md says "Webpack" but `vite.config.ts` exists).
5. **Verbosity** — identifies instructions that are redundant with config files Claude already reads.

### What It Suggests

- **Additions:** Conventions it detected that aren't in CLAUDE.md.
- **Removals:** Instructions that duplicate config files or are stale.
- **Rewrites:** Verbose instructions that can be made more concise.
- **Reordering:** Moving critical instructions (security, breaking conventions) to the top.

### When to Use It

| Scenario | Recommended? |
|---|---|
| After project setup (initial CLAUDE.md) | Yes — generates a strong starting point |
| After a major refactor or migration | Yes — catches stale instructions |
| Quarterly maintenance | Yes — general hygiene |
| After every small code change | No — overkill |
| When Claude keeps making the same mistake | Maybe — the mistake might indicate a missing instruction |

### Limitations

- It reads the codebase at a point in time; it doesn't track changes over time.
- It cannot detect team conventions that aren't encoded anywhere (e.g., "we never use class components" — unless there's a lint rule for it).
- It suggests changes but does not force them — you approve each change.

---

## 10. CLAUDE.md Maintenance

### When to Update

| Trigger | Action |
|---------|--------|
| Framework or major dependency change | Update stack section |
| New coding convention adopted | Add to conventions section |
| CI/CD pipeline change | Update build/deploy section |
| New team member onboarding (and they notice gaps) | Add missing context |
| Claude repeatedly makes the same mistake | Add a directive to prevent it |
| A directive is no longer relevant | Remove it |

### The Reactive Approach

The most effective CLAUDE.md files are built **reactively**, not proactively. Start minimal. When Claude does something wrong — uses the wrong test runner, creates default exports, commits to the wrong branch — add a one-line directive to prevent it next time. This ensures every line in CLAUDE.md earns its place.

### Review Cadence

- **After every major tooling change:** same day.
- **Quarterly audit:** read through the file, delete anything stale. Use `/claude-md-improver`.
- **When onboarding:** have new developers read CLAUDE.md; if they find it confusing, Claude will too.

### Version Control Strategy

- **Project-level CLAUDE.md:** Check it into git so the whole team can contribute. The file **compounds in value over time** as the team collectively encodes conventions and gotchas.
- **Global CLAUDE.md:** Back up manually (e.g., dotfiles repo) but do not commit to project repos.
- **Directory-level CLAUDE.md:** Commit alongside the code in that directory.
- **`.claude/rules/*.md`:** Commit to git — same as project-level CLAUDE.md.
- **MEMORY.md:** **Local-only, never in git.** It lives at `~/.claude/projects/<hash>/MEMORY.md` and contains per-user, per-machine context that is ephemeral by nature.

---

## 11. Impact on Performance

### Context Window Economics

Claude Code operates within a context window (200K tokens for Claude Opus/Sonnet). CLAUDE.md contents are loaded as part of the system prompt on every conversation turn. Here's why size matters:

| CLAUDE.md Size | Approx. Tokens | % of 200K Window | Impact |
|----------------|----------------|-------------------|--------|
| 20 lines | ~150 tokens | 0.08% | Negligible. Ideal. |
| 100 lines | ~700 tokens | 0.35% | Fine. Typical for a well-maintained project. |
| 500 lines | ~3,500 tokens | 1.75% | Noticeable on long conversations. Review for bloat. |
| 2,000+ lines | ~14,000+ tokens | 7%+ | Problematic. Claude may deprioritize instructions at the end. |

### How Size Affects Instruction Following

Research on large language models consistently shows that **instruction adherence degrades as the instruction set grows**. Specifically:

1. **Primacy and recency bias:** Instructions at the beginning and end of CLAUDE.md are followed more reliably than those in the middle.
2. **Contradictory instructions:** The more instructions exist, the higher the probability of implicit contradictions, which cause unpredictable behavior.
3. **Attention dilution:** With more tokens dedicated to instructions, proportionally fewer tokens are available for the actual code context, reducing Claude's ability to reason about your codebase.

### Practical Guidelines

- **Target: under 100 lines (project level), under 30 lines (global), under 10 lines (directory level).**
- Combined total across all three levels should stay under 150 lines.
- If your CLAUDE.md exceeds 200 lines, split content into directory-level files so only relevant context is loaded for each task.
- Put the most critical instructions (security, breaking conventions) **at the top**.

---

## 12. Template / Skeleton

Copy this template and fill in only the sections relevant to your project. Delete sections you don't need — empty sections are noise.

```markdown
# <Project Name>

## Stack
- Frontend: <framework, language, UI library>
- Backend: <framework, language, ORM, database>
- Infra: <hosting, CI/CD, containerization>

## Code Conventions
- <convention 1>
- <convention 2>
- <convention 3>

## Git Workflow
- Branch from `<default-branch>`.
- Branch naming: `<pattern>`.
- Commit format: `<pattern>`.

## Testing
- <test framework> for <unit/integration>.
- <test framework> for <E2E>.
- Run: `<command>`.

## Build & Deploy
- Dev: `<command>`.
- Build: `<command>`.
- Deploy: `<process or command>`.

## Security
- Never commit secrets or .env files.
- <project-specific security rules>
```

**Template notes:**
- This is 25 lines. A filled-in version should be 20–40 lines.
- Delete any section where you have nothing project-specific to say.
- Don't add sections like "About" or "Team" — they waste tokens.

### Global CLAUDE.md Template (`~/.claude/CLAUDE.md`)

```markdown
# Global Configuration

## Communication
- <communication style preference>
- <autonomy level: when to ask vs act>

## Code Style (All Projects)
- <universal code conventions>

## Git Workflow
- <personal branching/commit preferences>

## Security
- Never commit secrets, API keys, or .env files.
- Flag any credentials found during reviews.

## MCP Servers
- Always active: <server1>, <server2>
- On-demand: <server3> — activate with `mcp-on <server3>`
```

### Directory-Level CLAUDE.md Template

```markdown
# <directory-name>

## Conventions
- <convention specific to this directory>
- <override or extension of project-level rule>
- <command specific to this package: `pnpm <script>`>
```

---

## 13. Sources

### Official Documentation
1. [Anthropic — Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) — Official best practices for Claude Code, including CLAUDE.md authoring guidance.
2. [Anthropic — Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code) — Official docs describing CLAUDE.md file hierarchy, loading behavior, and configuration.
3. [Anthropic — Claude Code GitHub Repository](https://github.com/anthropics/claude-code) — README and source code showing how CLAUDE.md files are discovered, parsed, and injected into context.
4. [Anthropic — Claude Code Best Practices Blog Post](https://www.anthropic.com/engineering/claude-code-best-practices) — Engineering blog post covering tips for effective CLAUDE.md authoring, including the reactive approach.

### Community Guides and Articles
5. [HumanLayer — Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) — Practical guide on the WHAT/WHY/HOW framework and the removal test for CLAUDE.md content.
6. [Builder.io — Claude.md Guide](https://www.builder.io/blog/claude-md-guide) — Comprehensive guide covering structure, size targets, and `.claude/rules/` directory usage.
7. [UX Planet — Claude.md Best Practices](https://uxplanet.org/claude-md-best-practices-1ef4f861ce7c) — 10-section framework for CLAUDE.md content organization.
8. [SFEIR Institute — Claude Code Memory System](https://institute.sfeir.com/en/claude-code/claude-code-memory-system-claude-md/tips/) — Coverage of the memory system, CLAUDE.md vs MEMORY.md, and `/init` bootstrapping.
9. [shanraisshan/claude-code-best-practice (GitHub)](https://github.com/shanraisshan/claude-code-best-practice) — Community-curated best practices repository for Claude Code configuration.
10. [rosmur — Claude Code Best Practices](https://rosmur.github.io/claudecode-best-practices/) — Aggregated best practices with emphasis on team workflows and git strategies.

### Research and Observation
11. **LLM Instruction Following Research** — Academic and industry research on instruction adherence degradation with prompt length, primacy/recency effects, and attention dilution in long-context models. [2024-06 to 2025-03]
12. **Direct Claude Code CLI Observation** — Behavioral observations from running Claude Code (Opus 4.x) and inspecting system prompt injection, CLAUDE.md loading order, and interaction with MEMORY.md and skills. [2025-12 to 2026-03]

---

*Generated 2026-03-11. Review and update quarterly or after major project changes.*
