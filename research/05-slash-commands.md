# Claude Code Slash Commands Reference

> **Research note:** This document incorporates web research data from multiple sources (March 2026) including the official CLI reference, community guides, and runtime observations. Commands and behavior may have evolved — verify against `docs.anthropic.com` and run `/help` in Claude Code for the latest. All sources are dated at the bottom.

## Summary

Slash commands in Claude Code fall into three categories:

1. **Built-in CLI commands** — handled by the CLI itself (no model involvement). These control session state, authentication, and configuration.
2. **Skill-based commands** — invoke the `Skill` tool, which injects specialized prompt modules into the conversation. These include `/commit`, `/review-pr`, `/simplify`, `/loop`, and others.
3. **Custom commands** — user-defined markdown prompt templates stored in `.claude/commands/` (project-level) or `~/.claude/commands/` (user-level).

The distinction matters: built-in commands are free (zero token cost), skill-based commands consume context tokens when loaded, and custom commands inject their full markdown content as a prompt.

**Complete command reference:**

| Command | Category | Purpose |
|---------|----------|---------|
| `/help` | Built-in | Show available commands and keyboard shortcuts |
| `/clear` | Built-in | Wipe conversation history |
| `/compact [hint]` | Built-in | Compress conversation to save context tokens |
| `/context <path\|url>` | Built-in | Add files, directories, or URLs to context |
| `/config` | Built-in | Open or manage configuration |
| `/cost` | Built-in | Show token usage and estimated cost for the session |
| `/model` | Built-in | Switch between models (Opus 4.6, Sonnet 4.6, Haiku 4.5) without leaving session |
| `/review` | Built-in | Trigger a code review of current changes |
| `/vim` | Built-in | Toggle vim keybindings |
| `/login` | Built-in | Authenticate with Anthropic |
| `/logout` | Built-in | Log out |
| `/doctor` | Built-in | Diagnose installation and environment issues |
| `/init` | Built-in | Generate a `CLAUDE.md` for the current project |
| `/commit` | Skill | Stage and commit changes with an auto-generated message |
| `/review-pr` | Skill | Review a GitHub pull request |
| `/simplify` | Skill | Review recent changes, spawn 3 review agents in parallel, auto-fix |
| `/loop` | Skill | Run a command on a recurring interval (default 10m; units: s/m/h/d) |
| `/batch` | Skill | Parallelize independent changes with automatic worktree isolation |
| `/plugin` | Skill | Browse and install skills/plugins |
| `/frontend-design` | Skill | Build production-grade UI/UX interfaces |
| `/claude-api` | Skill | Expert assistant for Anthropic SDK/API usage |
| `/claude-md-management:revise-claude-md` | Skill | Update CLAUDE.md with session learnings |
| `/claude-md-management:claude-md-improver` | Skill | Audit and optimize CLAUDE.md files |
| `/gsd:new-project` | Skill | GSD framework — initialize a new project |
| `/gsd:discuss-phase` | Skill | GSD framework — discussion phase |
| `/gsd:plan-phase` | Skill | GSD framework — planning phase |
| `/gsd:execute-phase` | Skill | GSD framework — execution phase |
| `/keybindings-help` | Skill | Customize keyboard shortcuts |
| `/project:<name>` | Custom | Run a project command from `.claude/commands/<name>.md` |
| `/user:<name>` | Custom | Run a user command from `~/.claude/commands/<name>.md` |

---

## Built-in Commands (Detailed)

### `/context`

**What it does:** Explicitly adds files, directories, or URLs to Claude's working context. This is the direct way to say "look at this" — Claude reads the target and makes it available for reference in subsequent responses.

**Syntax:**
```
/context <path-or-url>
/context src/components/Header.tsx
/context ./docs/
/context https://docs.anthropic.com/en/docs/claude-code
```

**How it works:**
- For **files**: reads the full content into context.
- For **directories**: reads the tree structure, then selectively reads individual files as needed during the conversation.
- For **URLs**: fetches the page content (subject to accessibility — no auth walls, reasonable page size).

**Best practices:**
- Use `/context` when you want Claude to reference something it hasn't been pointed to yet. Mentioning a file path in a message often triggers a read too, but `/context` is explicit and immediate.
- Be selective. Adding large files or many files at once burns context window fast. Prefer targeted reads over blanket directory loads.
- Combine with `/compact` afterward if the loaded content is large and you only needed Claude to analyze it once.
- Run the command multiple times to add multiple paths — there is no multi-path syntax.

**Gotchas:**
- URL fetching fails silently on auth-gated pages, large pages, or pages that require JavaScript rendering.
- Directory loads are shallow — Claude gets the tree and reads files on demand, not all at once.
- Every byte loaded counts against your ~200k token budget. A single large file can consume 5-10% of the window.

---

### `/compact`

**What it does:** Compresses the current conversation into a shorter summary, freeing context window space while preserving essential thread context — decisions made, files referenced, current task state.

**Syntax:**
```
/compact
/compact [focus-hint]
/compact focus on the auth refactor and the API contract changes
```

**How it works:**
1. Claude summarizes the full conversation history into a condensed block.
2. The original messages are replaced by this summary.
3. Recent messages are preserved with more detail than older ones.
4. CLAUDE.md content and MCP tool schemas are unaffected (they reload every turn).

**Accepts an argument** to guide what gets retained:
```
/compact retain the error handling patterns
/compact focus on the auth refactor and the API contract changes
```

**Best practices:**
- Use proactively when context reaches **~80%** — don't wait for auto-compression. Manual compression with a focus hint preserves more relevant detail than the automatic fallback.
- Always provide a focus hint when working on multiple topics. Without one, Claude decides what to prioritize.
- After compacting, verify Claude remembers key decisions with a quick follow-up question.
- Do not rely on compression to preserve exact code. After compaction, Claude may need to re-read files.

**When to use:**
- Response speed is degrading (a sign of a bloated context).
- You are transitioning between subtasks in the same session.
- Claude starts "forgetting" earlier decisions.

**`/compact` vs `/clear` — decision rule:** Use `/compact` when you are still working on the same task and need to free space. Use `/clear` when switching tasks entirely — carrying stale context from one task into another degrades quality.

**Comparison with `/clear`:**

| | `/compact` | `/clear` |
|---|---|---|
| Preserves history | Yes (summarized, lossy) | No |
| Frees tokens | Partially | Completely |
| CLAUDE.md files | Remain loaded | Remain loaded |
| Best for | Mid-task cleanup | Full topic switch or fresh start |

---

### `/clear`

**What it does:** Wipes the entire conversation history. Claude loses all memory of the current session. CLAUDE.md files and MCP tool schemas are re-injected fresh.

**Syntax:**
```
/clear
```

**Best practices:**
- Use when switching to an unrelated task. Carrying stale context from task A into task B degrades quality.
- If you need Claude to remember something across a `/clear`, put it in CLAUDE.md.
- Prefer `/clear` over `/compact` when you are truly done with the previous topic.

---

### `/init`

**What it does:** Generates a `CLAUDE.md` file for the current project by analyzing the repository structure, tech stack, and conventions. Produces a starting template that you should review and edit.

**Syntax:**
```
/init
```

**Best practices:**
- Run this when first setting up Claude Code in a new repo.
- Always review the generated file — it is a starting point, not authoritative.
- Can be run even if a CLAUDE.md already exists; Claude will offer to update it.

---

### `/cost`

**What it does:** Displays token usage (input and output) and estimated dollar cost for the current session.

**Syntax:**
```
/cost
```

**Best practices:**
- Check periodically during long sessions to monitor spend.
- Useful for calibrating whether your session needs a `/compact` or `/clear`.

---

### `/doctor`

**What it does:** Runs diagnostic checks on the Claude Code installation and environment. Reports issues with authentication, CLI version, permissions, MCP server health, and configuration.

**Syntax:**
```
/doctor
```

**When to use:** After an upgrade, when authentication fails, or when behavior seems wrong.

---

### `/config`

**What it does:** Opens or manages Claude Code configuration — model preferences, permission settings, MCP server configuration.

**Syntax:**
```
/config
```

---

### `/vim`

**What it does:** Toggles vim-style keybindings for the Claude Code interactive input.

**Syntax:**
```
/vim
```

---

### `/login` and `/logout`

**What they do:** Authenticate or de-authenticate with Anthropic's API.

**Syntax:**
```
/login
/logout
```

---

### `/help`

**What it does:** Displays all available slash commands (built-in, skill-based, and custom) with brief descriptions. Also shows keyboard shortcuts.

**Syntax:**
```
/help
```

**Tips:**
- Output is dynamic — custom commands you've created appear here too.
- This is the authoritative source for what is available in your installation.

---

### `/model`

**What it does:** Switch the active model without leaving the current session. Available models include Opus 4.6, Sonnet 4.6, and Haiku 4.5.

**Syntax:**
```
/model
/model sonnet
/model opus
/model haiku
```

**Best practices:**
- Switch to Haiku for quick, low-cost tasks (formatting, simple lookups) mid-session.
- Switch to Opus for complex reasoning, multi-file refactors, or architectural decisions.
- The conversation context carries over — no need to re-explain what you are working on.

---

### `/review`

**What it does:** Triggers a code review of the current changes in the working directory.

**Syntax:**
```
/review
```

**Best practices:**
- Use for reviewing local uncommitted changes. For reviewing a GitHub PR, use `/review-pr <num|url>` instead.
- Run after making changes and before committing for a quality check.

---

## Skill-Based Commands (Detailed)

Skill-based commands invoke the `Skill` tool, which loads specialized prompt instructions into the conversation. They look and feel like built-in slash commands but are modular — they can be added, removed, or updated independently of the CLI.

### `/simplify`

**What it does:** Reviews recently changed files by spawning **3 review agents in parallel**, checking for reuse opportunities, quality issues, and efficiency improvements, then **automatically applies fixes**. It does not just report — it acts.

**What it checks:**
- Opportunities to reuse existing code instead of duplicating logic
- General code quality (naming, structure, complexity)
- Efficiency improvements (unnecessary allocations, redundant operations)
- Type safety issues

**Syntax:**
```
/simplify
```

**When to use it:**
- After completing a feature, as a quality pass before committing.
- During refactoring sessions to catch things you missed.
- As a final review pass on PR-ready code.

**Best practices:**
- Run `/simplify` before `/commit` — fix quality issues first, then commit clean code.
- Works best when Claude has the full context of your recent changes. If you `/compact`ed recently, Claude may need to re-read the changed files.
- Respects your CLAUDE.md conventions — if you have style rules documented, `/simplify` will enforce them.

**Example workflow:**
```
> Implement the retry logic for MC-1234
[Claude makes changes across 3 files]
> /simplify
[Claude reviews all diffs, identifies a duplicated retry helper, extracts it, fixes naming, commits the improvements]
> /commit
```

---

### `/loop`

**What it does:** Runs a prompt or slash command on a recurring interval. Designed for polling, monitoring, and recurring tasks within a live session.

**Syntax:**
```
/loop [interval] [command-or-prompt]
/loop 5m /commit                     # Run /commit every 5 minutes
/loop 10m check deploy status        # Check deployment every 10 minutes
/loop /some-command                  # Defaults to 10-minute interval
/loop 30s check build output         # Supported units: s, m, h, d
```

**Default interval:** 10 minutes. Supported time units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days).

**How it works:**
- The interval is approximate — it triggers after the previous execution completes plus the wait time.
- Runs in the foreground of the current conversation.
- Stop it by interrupting (Ctrl+C / Escape) or ending the session.

**When to use it:**
- Monitoring CI/CD pipeline status.
- Polling deployment health.
- Babysitting PRs or long-running processes.
- Running periodic code quality checks.

**When NOT to use it:**
- One-off tasks — just run the command directly.
- Tasks that need to run when Claude Code isn't open — use system cron + `claude -p` instead.
- Tasks requiring high precision timing — the interval is best-effort.

**Best practices:**
- Pair with `--max-budget-usd` awareness. Each loop iteration consumes tokens, and unbounded loops can accumulate significant cost.
- Keep the inner command lightweight. A `/loop 5m` that triggers a full codebase scan every iteration will bloat context fast.
- For production monitoring, prefer shell-based loops with `claude -p` and `--max-budget-usd` over interactive `/loop`, since they survive terminal disconnection.

**Alternative for non-interactive loops:**
```bash
while true; do
  claude -p "Check if deployment $DEPLOY_ID is healthy" --max-budget-usd 0.10
  sleep 300
done
```

---

### `/commit`

**What it does:** Analyzes staged and unstaged changes, generates a commit message, stages the relevant files, and creates a Git commit.

**Internal flow:**
1. Runs `git status` and `git diff` to understand changes.
2. Reads recent `git log` to match the repository's commit message style.
3. Drafts a concise commit message focused on the "why" not the "what."
4. Stages relevant files (avoids secrets, `.env`, large binaries).
5. Creates the commit.
6. Runs `git status` to confirm.

**Syntax:**
```
/commit
```

**Best practices:**
- If you want control over what gets committed, stage files manually with `git add` first, then run `/commit`.
- Pre-commit hooks are respected. If a hook fails, Claude fixes the issue and creates a **new** commit (never amends the previous one).
- Claude will not commit `.env` files or anything that looks like credentials — it warns you instead.
- If there are no changes, Claude tells you so rather than creating an empty commit.

---

### `/review-pr`

**What it does:** Reviews a GitHub pull request. Fetches the PR diff, analyzes all commits (not just the latest), and provides structured feedback on code quality, bugs, style, and architecture.

**Syntax:**
```
/review-pr <pr-number-or-url>
/review-pr 123
/review-pr https://github.com/org/repo/pull/123
```

**Best practices:**
- Requires the `gh` CLI to be installed and authenticated.
- Works best when you are in the repo's directory so Claude has full project context.
- You can ask follow-up questions about specific parts of the review.

---

### `/frontend-design`

**What it does:** Shifts Claude into a design-focused mode that creates visually distinctive, polished UI components with proper spacing, typography, color theory, and layout principles.

**Syntax:**
```
/frontend-design Build a settings page with a sidebar nav
```

**Best practices:**
- Works with whatever frontend stack your project uses (React, Vue, vanilla HTML/CSS) based on project context.
- Focuses on design quality, not just functional correctness.
- Best for new pages, dashboards, component libraries, and redesigns.

---

### `/claude-api`

**What it does:** Provides specialized knowledge for building applications with the Anthropic API or Claude SDK. Knows exact current signatures, parameters, and best practices.

**Syntax:**
```
/claude-api
```

**Trigger conditions:** Automatically suggested when your code imports `anthropic` (Python), `@anthropic-ai/sdk` (TypeScript), or `claude_agent_sdk`.

---

### `/claude-md-management:revise-claude-md`

**What it does:** Analyzes the conversation so far — commands that failed, patterns that worked, corrections you made — and proposes updates to CLAUDE.md so future sessions benefit.

**When to use it:**
- End of a productive session where you taught Claude about your project.
- After correcting Claude multiple times about the same thing.
- When you've established new conventions that should persist.

---

### `/claude-md-management:claude-md-improver`

**What it does:** Audits an existing CLAUDE.md for contradictions, redundancy, missing context, verbose sections, and structural issues. Proposes improvements.

**When to use it:**
- When CLAUDE.md has grown organically and needs cleanup.
- Periodically, as a maintenance task.
- When onboarding a new repo with an existing config.

---

### `/keybindings-help`

**What it does:** Provides guidance on viewing and modifying keyboard shortcuts for the Claude Code CLI.

---

### `/batch`

**What it does:** Parallelizes independent changes across multiple files or tasks. Handles **worktree isolation automatically** — each parallel change runs in its own Git worktree so changes don't conflict.

**Syntax:**
```
/batch
```

**When to use it:**
- You have multiple independent, parallelizable changes (e.g., "add logging to these 5 services").
- Refactoring the same pattern across unrelated files.
- Bulk updates that don't depend on each other.

**Best practices:**
- Only use for truly independent changes. If change B depends on change A, run them sequentially instead.
- Claude handles worktree creation and cleanup — you don't need to manage Git worktrees manually.
- Review the merged results after batch completion.

**Headless/CLI batch execution** (non-interactive alternative):
```bash
# Single prompt (headless mode)
claude -p "Summarize the changes in the last 5 commits"

# With budget caps
claude -p "Fix all lint errors" --max-budget-usd 1.00

# With permission bypass (dangerous)
claude -p "Run tests and fix failures" --permission-mode auto
```

---

### `/plugin`

**What it does:** Browse and install skills/plugins that extend Claude Code's capabilities. Plugins add new slash commands and specialized behaviors.

**Syntax:**
```
/plugin
```

**Best practices:**
- Use to discover available skills before manually searching for them.
- Installed plugins appear as new slash commands accessible via `/`.

---

### `/gsd:*` — GSD Framework Commands

The GSD (Get Stuff Done) framework provides a structured multi-phase workflow for complex projects.

| Command | Purpose |
|---------|---------|
| `/gsd:new-project` | Initialize a new project with GSD framework scaffolding |
| `/gsd:discuss-phase` | Open-ended discussion to explore requirements and constraints |
| `/gsd:plan-phase` | Create a structured plan with tasks and milestones |
| `/gsd:execute-phase` | Execute the plan step by step |

**When to use it:**
- Large or ambiguous projects that benefit from structured planning before execution.
- When you want Claude to follow a discuss-plan-execute workflow rather than jumping straight to code.

---

## Custom Slash Commands

Custom commands are markdown files whose content becomes a prompt injected when invoked. The filename (minus `.md`) becomes the command name.

### Directory Structure

| Type | Location | Invoked as | Scope |
|------|----------|-----------|-------|
| Project | `.claude/commands/<name>.md` | `/project:<name>` | Everyone on the repo (committed to git) |
| User | `~/.claude/commands/<name>.md` | `/user:<name>` | Only you, all repos |
| Nested | `.claude/commands/review/security.md` | `/project:review:security` | Subdirectory becomes part of the name |

### Discovering Commands

Type `/` followed by any letters to **filter the command list** in real time. This searches across built-in, skill-based, and custom commands.

### Creating a Custom Command

```bash
# Project-level: creates /project:refactor
mkdir -p .claude/commands
cat > .claude/commands/refactor.md << 'EOF'
Review the selected code and refactor it for:
1. Readability — clear variable names, short functions
2. Performance — eliminate unnecessary allocations
3. Type safety — remove any `any` types, add explicit types

Show me the refactored code with a brief explanation of each change.
EOF
```

```bash
# User-level: creates /user:standup
mkdir -p ~/.claude/commands
cat > ~/.claude/commands/standup.md << 'EOF'
Summarize my git activity from the last 24 hours:
1. List commits with messages
2. List files changed
3. Highlight any open PRs

Format as bullet points suitable for a standup update.
EOF
```

### Using `$ARGUMENTS`

Custom commands support a `$ARGUMENTS` placeholder that captures everything typed after the command name:

**File:** `.claude/commands/test.md`
```markdown
Write unit tests for: $ARGUMENTS

Requirements:
- Use the existing test framework in this project
- Cover happy path and edge cases
- Include error cases
- Follow existing test patterns in the codebase
```

**Usage:**
```
> /project:test the authentication middleware
```

Claude receives: "Write unit tests for: the authentication middleware" plus the rest of the template.

### Best Practices for Custom Commands

1. **One command = one task.** Keep templates focused. Don't build mega-commands.
2. **Use `$ARGUMENTS` for flexibility.** Makes commands reusable across different targets.
3. **Commit project commands to git.** The team benefits from shared workflows.
4. **Don't duplicate built-in behavior.** If `/commit` does what you need, don't recreate it.
5. **Include constraints and guardrails.** Be explicit about coding standards, output format, and stop conditions ("If X fails, stop and report").
6. **Test commands after creation.** Run them once to verify the prompt produces the expected result.
7. **Keep templates concise.** Every word in the template consumes context tokens when invoked. Cut filler.

### Example: Real-World Custom Commands

```bash
# .claude/commands/fix-lint.md — /project:fix-lint
Run the linter, fix all auto-fixable issues, and show me any remaining
errors that need manual attention. Use the project's configured linter
(check package.json scripts).
```

```bash
# .claude/commands/explain.md — /project:explain <target>
Explain $ARGUMENTS in plain English:
- What it does
- Why it exists (infer from context and usage)
- Key dependencies
- Potential gotchas

Keep it under 200 words.
```

```bash
# ~/.claude/commands/pr.md — /user:pr
Create a pull request for the current branch:
1. Push the branch to origin
2. Create a PR with a clear title and description
3. Include a summary of changes and a test plan
4. Return the PR URL
```

---

## Quick Reference

```
Built-in Commands:
  /help                    Show commands and shortcuts
  /clear                   Wipe conversation history
  /compact [hint]          Compress conversation (use at ~80% context)
  /context <path|url>      Add file/dir/URL to context
  /init                    Generate CLAUDE.md for project
  /model                   Switch model (Opus 4.6 / Sonnet 4.6 / Haiku 4.5)
  /review                  Code review of current changes
  /doctor                  Diagnose environment issues
  /config                  Manage settings
  /cost                    Show token/cost usage
  /vim                     Toggle vim keybindings
  /login                   Authenticate
  /logout                  De-authenticate

Skill-Based Commands:
  /commit                  Auto-commit with generated message
  /review-pr <num|url>     Review a GitHub PR
  /simplify                Review recent changes (3 parallel agents), auto-fix
  /loop [interval] [cmd]   Recurring tasks (default 10m; units: s/m/h/d)
  /batch                   Parallelize independent changes (worktree isolation)
  /plugin                  Browse and install skills/plugins
  /frontend-design         Build production-grade UI components
  /claude-api              Expert help with Anthropic SDK/API
  /gsd:new-project         GSD framework — new project
  /gsd:discuss-phase       GSD framework — discussion phase
  /gsd:plan-phase          GSD framework — planning phase
  /gsd:execute-phase       GSD framework — execution phase
  /claude-md-management:revise-claude-md    Persist session learnings to CLAUDE.md
  /claude-md-management:claude-md-improver  Audit and optimize CLAUDE.md
  /keybindings-help        Customize keyboard shortcuts

Custom Commands:
  /project:<name>          Run from .claude/commands/<name>.md
  /user:<name>             Run from ~/.claude/commands/<name>.md
  Type / + letters         Filter the command list in real time

Batch/Headless (CLI):
  claude -p "prompt"       Run headless, print response, exit
```

---

## Sources

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) [SOURCE DATE: 2026-03]
- [Claude Code Slash Commands (heyuan110)](https://www.heyuan110.com/posts/ai/2026-03-05-claude-code-slash-commands/) [SOURCE DATE: 2026-03]
- [Claude Code Reference Guide (SmartScope)](https://smartscope.blog/en/generative-ai/claude/claude-code-reference-guide/) [SOURCE DATE: 2026-03]
- [Claude Code Slash Commands Reference (Learn Prompting)](https://learn-prompting.fr/en/blog/claude-code-slash-commands-reference) [SOURCE DATE: 2026-03]
- [Claude Code Essential Slash Commands (SFEIR Institute)](https://institute.sfeir.com/en/claude-code/claude-code-essential-slash-commands/faq/) [SOURCE DATE: 2026-03]
- [Anthropic Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code) [SOURCE DATE: 2025-05]
- [Claude Code GitHub Repository](https://github.com/anthropics/claude-code) [SOURCE DATE: 2025-05]
- Claude Code runtime agent observations (system prompt, Skill tool definitions, deferred tool registry) [SOURCE DATE: 2026-03]
- Cross-referenced from research files 01, 02, 03, 06, 07 in this repository [SOURCE DATE: 2026-03]

*Last updated: 2026-03-11*
