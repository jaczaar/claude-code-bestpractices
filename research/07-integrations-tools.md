# Integrations & Tools in Claude Code

## Summary

Claude Code ships with a rich set of integrations that extend it well beyond a simple CLI chatbot. This document covers the major integration surfaces: **scheduled execution** (native `/loop` and `CronCreate` plus external cron/CI patterns), **Agent Teams** (multi-agent coordinated execution with planning, dependency tracking, and inter-agent communication), **git worktrees** for isolated parallel work, **hooks** for pre/post tool execution, **IDE integrations** (VS Code, JetBrains), **GitHub integration**, and additional notable integrations including MCP servers, plugins, and Chrome integration. Each section details what the feature does, how to set it up, best use cases, and limitations.

---

## Table of Contents

1. [Scheduled / Cron-like Execution](#1-scheduled--cron-like-execution)
2. [Agent Teams (Multi-Agent Parallel Execution)](#2-agent-teams-multi-agent-parallel-execution)
3. [Worktrees](#3-worktrees)
4. [Hooks](#4-hooks)
5. [IDE Integrations](#5-ide-integrations)
6. [GitHub Integration](#6-github-integration)
7. [MCP Servers](#7-mcp-servers)
8. [Plugins](#8-plugins)
9. [Chrome Integration](#9-chrome-integration)
10. [Custom Agents](#10-custom-agents)
11. [Sources](#sources)

---

## 1. Scheduled / Cron-like Execution

### What It Does

Claude Code supports both **native in-session scheduling** and **external cron/CI-based scheduling**.

As of v2.1.71 (2026), Claude Code has two built-in scheduling mechanisms:

1. **`/loop` command** -- runs a prompt on a recurring interval within an active session
2. **`CronCreate` tool** -- schedules tasks using standard 5-field cron expressions

For unattended automation, the **non-interactive mode** (`--print` / `-p`) combined with external schedulers (cron, launchd, GitHub Actions) remains the recommended approach.

### Native Scheduling (In-Session)

**`/loop` command (v2.1.71+):**

```bash
# Default interval: 10 minutes
/loop "Check for new PRs and summarize any changes"

# Custom intervals with unit suffixes: s (seconds), m (minutes), h (hours), d (days)
/loop 30m "Run the test suite and report failures"
/loop 1h "Scan for TODO comments added in the last hour"
/loop 5m "Monitor build output for errors"
```

**`CronCreate` tool (standard cron expressions):**

Claude can create scheduled tasks using standard 5-field cron expressions when asked:

```
"Run a security scan every weekday at 9am" → CronCreate with expression "0 9 * * 1-5"
"Check for dependency updates every Monday" → CronCreate with expression "0 8 * * 1"
```

**Native scheduling constraints:**

| Constraint | Value |
|------------|-------|
| Max concurrent scheduled tasks | 50 per session |
| Auto-expiry | 3 days |
| Jitter | Up to 10% of period, capped at 15 minutes |
| Timezone | Local timezone interpretation |
| Requires active session | Yes -- tasks only run while the Claude Code session is active |

### External Scheduling (Headless)

**Using system cron (Linux/macOS):**

```bash
# Run a scheduled code review every day at 9am
0 9 * * * cd /path/to/repo && claude -p "Review the last 5 commits for code quality issues, security concerns, and style violations. Output a summary." > /tmp/daily-review.md 2>&1

# Run a dependency audit weekly
0 8 * * 1 cd /path/to/repo && claude -p "Check package.json for outdated or vulnerable dependencies and suggest updates." > /tmp/dep-audit.md 2>&1
```

**Using GitHub Actions (recommended for team workflows):**

```yaml
name: Scheduled Code Review
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9am UTC
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Claude review
        run: |
          claude -p "Review changes merged in the last 24 hours. Flag any security issues, missing tests, or architectural concerns." \
            --output-format json \
            --max-budget-usd 0.50
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Key flags for scheduled execution:**

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Non-interactive mode; prints output and exits |
| `--output-format json` | Structured output for downstream parsing |
| `--output-format stream-json` | Streaming structured output |
| `--max-budget-usd <amount>` | Cost cap to prevent runaway spend |
| `--dangerously-skip-permissions` | Skip permission prompts (sandboxed environments only) |
| `--model <model>` | Pin a specific model for reproducibility |
| `--json-schema <schema>` | Enforce structured output shape |
| `--no-session-persistence` | Don't save session to disk (cleaner for cron) |
| `--permission-mode bypassPermissions` | Skip all permission prompts (alternative to `--dangerously-skip-permissions`) |
| `--effort <level>` | Control reasoning effort (`low`, `medium`, `high`, `max`) -- use `low` for cheap scheduled tasks |
| `--fallback-model <model>` | Auto-fallback when primary model is overloaded (useful for unattended runs) |

### Best Use Cases

- **Daily code review summaries** of recent commits
- **Periodic dependency and security audits**
- **Automated documentation generation** on a schedule
- **Nightly test analysis** -- pipe test output into Claude for failure triage
- **Changelog generation** before releases
- **In-session monitoring** -- use `/loop` for continuous tasks like watching test output or build logs during development

### Limitations

- **Native scheduling (`/loop`, `CronCreate`):** tasks only run while the Claude Code session is active; closing the session stops all scheduled tasks
- Native tasks auto-expire after 3 days
- Max 50 concurrent scheduled tasks per session
- For persistent unattended scheduling, external cron/CI tooling is still required
- The `-p` flag skips workspace trust dialogs -- only use in trusted directories
- Cost can accumulate if schedules are too frequent; always set `--max-budget-usd`
- Session state is not preserved between external cron runs by default (use `--session-id` or `--continue` if needed)
- Rate limits apply; concurrent scheduled runs may hit API throttling

---

## 2. Agent Teams (Multi-Agent Parallel Execution)

### What It Does

**Agent Teams** (internally `TeammateTool`, commonly called "swarm mode" in the community) is Claude Code's built-in multi-agent coordination system. Released on **February 5, 2026** alongside Opus 4.6, Agent Teams provides first-class support for breaking down large tasks across multiple coordinated agents, each working in an isolated worktree with its own 1M token context window.

Agent Teams supersedes the earlier community pattern of manually orchestrating parallel `claude` instances. While manual worktree-based parallelism still works, Agent Teams adds **planning, dependency tracking, and inter-agent communication**.

**Enable Agent Teams:**

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Architecture

A team session follows this flow:

1. **Team Lead** analyzes the request and creates a plan
2. The plan is broken down into discrete tasks with dependency tracking
3. **Worker agents** are spawned, each in an independent git worktree with a 1M token context window
4. Workers execute tasks, with dependent tasks auto-unblocking as predecessors complete
5. A **mailbox system** enables direct inter-agent communication for sharing findings and coordinating
6. The Team Lead synthesizes results

### Coordination Patterns

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| **Leader** | One lead agent delegates to workers and synthesizes results | Default; best for most multi-file tasks |
| **Swarm** | Multiple agents work on related tasks with peer communication | Large refactors where agents need to share discoveries |
| **Pipeline** | Tasks flow sequentially from one agent to the next | Ordered workflows (e.g., generate code → write tests → review) |
| **Watchdog** | A monitoring agent oversees others and intervenes if needed | Long-running tasks requiring quality gates |

### How to Use

**Natural language (recommended):**

```
"Refactor the auth module, update all tests, and fix the CI pipeline. Use agent teams to parallelize this."
```

Claude creates the plan and spawns workers automatically.

**Manual worktree-based parallel execution (still works):**

```bash
# Terminal 1: Refactor auth module
claude --worktree auth-refactor -p "Refactor the authentication module to use JWT tokens"

# Terminal 2: Migrate database schemas
claude --worktree db-migration -p "Migrate all TypeORM entities to use the new naming convention"

# Terminal 3: Update test suite
claude --worktree test-updates -p "Update all unit tests to use vitest instead of jest"
```

**Script-orchestrated parallel execution:**

```bash
#!/bin/bash
# swarm.sh - Run multiple Claude tasks in parallel

tasks=(
  "Review src/api/ for security vulnerabilities"
  "Add missing TypeScript types in src/models/"
  "Generate unit tests for src/utils/"
)

for i in "${!tasks[@]}"; do
  claude --worktree "task-$i" \
    -p "${tasks[$i]}" \
    --max-budget-usd 1.00 \
    --no-session-persistence \
    > "results/task-$i.md" 2>&1 &
done

wait
echo "All tasks complete"
```

**tmux integration:**

```bash
# Create a worktree with automatic tmux session
claude --worktree my-feature --tmux
```

### Agent Teams vs. Subagents vs. /batch

| Feature | Subagents (Task tool) | Agent Teams | `/batch` |
|---------|----------------------|-------------|----------|
| Scope | Quick focused subtasks within a session | Multi-agent coordinated work across worktrees | Independent parallelizable changes |
| Coordination | None (fire-and-forget) | Dependency tracking + mailbox communication | None (independent tasks) |
| Isolation | Shared worktree | Each agent gets own worktree | Handles worktree automatically |
| Context | Shares parent context | Each agent gets 1M token context window | Independent contexts |
| Best for | Research, analysis, single-file edits | Large refactors, multi-module changes | Batch of similar independent edits |

**Use subagents** for quick focused work. **Use Agent Teams** when teammates need to share findings and coordinate. **Use `/batch`** as a simpler alternative for independent parallelizable changes (it handles worktree creation automatically).

### When to Use Agent Teams

- Large-scale refactoring across interdependent modules
- Multi-service migrations where changes need coordination
- Parallel code reviews that should produce a unified summary
- Complex feature implementation spanning frontend, backend, and tests
- Any task where agents benefit from communicating discoveries to each other

### Limitations

- Experimental: requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable
- Each agent consumes its own API tokens -- cost scales linearly
- Git conflicts can arise when merging worktree results back to the main branch
- Worktrees require git; non-git projects can't use this pattern
- Rate limits can become a bottleneck with many parallel agents
- Agent Teams adds orchestration overhead; for simple independent tasks, `/batch` or manual worktrees may be faster

---

## 3. Worktrees

### What It Does

The `--worktree` (`-w`) flag creates a **new git worktree** for the Claude Code session. A git worktree is a separate working directory linked to the same repository, allowing you to have multiple branches checked out simultaneously without cloning the repo again.

In Claude Code's context, this means each agent session gets its own isolated copy of the codebase where it can make changes, create commits, and switch branches without affecting your primary working directory.

As of 2026, worktree support is built into the CLI directly (previously it was desktop-only). You can also ask Claude to "work in a worktree" conversationally and it will create one automatically. Agent Teams (Section 2) rely on worktrees internally -- each spawned agent gets its own worktree so builds and tests across agents don't interfere with each other.

### How to Set It Up

```bash
# Create a worktree with auto-generated name
claude --worktree

# Create a named worktree
claude --worktree feature-auth-refactor

# Worktree + tmux session
claude --worktree feature-auth-refactor --tmux

# Worktree + tmux with classic tmux (not iTerm2 panes)
claude --worktree feature-auth-refactor --tmux=classic
```

**Conversational worktree creation:**

```
> "Work in a worktree and refactor the payment module"
```

Claude creates the worktree automatically and operates within it.

When you start a session with `--worktree`, Claude Code:
1. Creates a new git worktree in a temporary location
2. Checks out the current branch (or a new branch)
3. Runs the session inside that worktree
4. The worktree persists after the session ends so you can review changes

Each worktree is fully independent: running builds, tests, or linters in one worktree does not interfere with another. This is what makes Agent Teams possible -- multiple agents can run `npm test` or `npm run build` simultaneously without conflicts.

### Best Use Cases

- **Parallel feature development** -- work on multiple features without stashing
- **Safe experimentation** -- let Claude make aggressive changes in an isolated worktree
- **Code review in isolation** -- review and test changes without disrupting your main work
- **Agent Teams** (see above) -- each parallel agent gets its own worktree automatically
- **PR-based workflows** -- the `--from-pr` flag can resume sessions linked to a specific PR
- **Independent builds/tests** -- each worktree can run its own build and test suite without interfering with others

### Limitations

- Requires a git repository
- Disk space: each worktree is a full checkout (though git shares object storage)
- Worktrees need manual cleanup (`git worktree remove`) when you're done
- Submodules may require additional setup in worktrees
- The `--tmux` flag requires tmux to be installed (or iTerm2 for native panes)

---

## 4. Hooks

### What It Does

Hooks in Claude Code are **pre and post execution callbacks** that run before or after specific tool invocations. They allow you to enforce policies, transform inputs/outputs, log tool usage, or block certain operations.

Hooks are configured in your Claude Code settings files (`.claude/settings.json`, `.claude/settings.local.json`, or `~/.claude/settings.json`).

### How to Configure

Hooks are defined in the settings JSON under the `"hooks"` key:

```jsonc
// .claude/settings.json (project-level)
{
  "hooks": {
    "preTool": [
      {
        "tool": "Bash",
        "command": "echo 'About to run Bash tool' >> /tmp/claude-audit.log"
      }
    ],
    "postTool": [
      {
        "tool": "Edit",
        "command": "npx eslint --fix $CLAUDE_FILE_PATH"
      }
    ],
    "preCommit": [
      {
        "command": "npx lint-staged"
      }
    ]
  }
}
```

**Hook types:**

| Hook | When It Runs |
|------|-------------|
| `preTool` | Before a tool is executed |
| `postTool` | After a tool completes |

**Environment variables available in hooks:**

Hooks receive context about the tool invocation through environment variables, including the tool name, parameters, and file paths being operated on.

### Best Use Cases

- **Auto-formatting** -- run prettier/eslint after every file edit
- **Audit logging** -- log all tool invocations for compliance
- **Security gates** -- block operations on sensitive files
- **Validation** -- ensure edits meet project standards before they're applied
- **Notifications** -- send alerts when certain tools are used

### Limitations

- Hook failures can block tool execution (which may be intentional for gates)
- Hooks run synchronously and add latency to each tool call
- Complex hook logic is better handled by external scripts
- Debug hooks with `--debug hooks` flag to see execution details

---

## 5. IDE Integrations

### What It Does

Claude Code integrates with major IDEs to provide an in-editor experience alongside the terminal CLI.

### VS Code Extension

The official **Claude Code VS Code extension** provides:
- Inline Claude Code panel within VS Code
- File context automatically shared from your editor
- Ability to select code and send it to Claude
- Terminal integration for the Claude CLI
- Diff view for proposed changes

**Setup:**
1. Install the "Claude Code" extension from the VS Code Marketplace
2. Authenticate via `claude auth` in the terminal
3. The extension connects to the Claude CLI automatically

The `--ide` flag on the CLI auto-connects to a running IDE if exactly one valid IDE is available:

```bash
claude --ide
```

### JetBrains Integration

JetBrains support (IntelliJ, WebStorm, PyCharm, etc.) is available through:
- The Claude Code CLI running in the JetBrains terminal
- The `--ide` flag for auto-detection
- Third-party plugins that wrap the Claude CLI

### Other Editors

- **Vim/Neovim** -- use Claude Code via the terminal; pipe selections with `-p`
- **Emacs** -- similar terminal-based workflow
- **Cursor/Windsurf** -- Claude Code can run alongside these as a complementary tool

### Best Use Cases

- Real-time code assistance while editing
- Quick code explanations by selecting code in the editor
- Inline refactoring suggestions
- Running Claude Code without leaving your editor

### Limitations

- The VS Code extension requires the CLI to be installed separately
- JetBrains integration is less mature than VS Code
- Editor integrations may lag behind CLI features
- Context window limits apply regardless of how much code is open in the editor

---

## 6. GitHub Integration

### What It Does

Claude Code integrates deeply with GitHub through the `gh` CLI and built-in awareness of GitHub workflows. It can manage PRs, review code, handle issues, and integrate into CI/CD pipelines.

### PR Reviews

```bash
# Review a PR
claude -p "Review PR #123 in detail. Check for bugs, security issues, and suggest improvements."

# Resume a session linked to a PR
claude --from-pr 123
claude --from-pr https://github.com/org/repo/pull/123
```

The `--from-pr` flag is particularly powerful -- it resumes or starts a session with full context of the PR's changes, comments, and discussion.

### CI/CD Integration

Claude Code runs well in GitHub Actions for automated tasks:

```yaml
name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Review PR
        run: |
          claude -p "Review the changes in this PR. Focus on: 1) correctness, 2) security, 3) performance. Post a summary as a PR comment using gh." \
            --dangerously-skip-permissions \
            --max-budget-usd 1.00
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Issue Management

Claude Code can interact with GitHub issues via the `gh` CLI:

```bash
claude -p "Look at issue #456 and create a PR that implements the requested feature."
```

### Best Use Cases

- **Automated PR reviews** on every pull request
- **Issue triage** -- classify and label incoming issues
- **PR creation** -- generate PRs from issue descriptions
- **Release notes** -- auto-generate changelogs from merged PRs
- **CI failure analysis** -- pipe CI logs into Claude for diagnosis

### Limitations

- Requires `gh` CLI to be installed and authenticated
- PR review quality depends on context window fitting the diff
- Large PRs may exceed token limits; consider reviewing file-by-file
- API costs apply for each CI run
- The `--dangerously-skip-permissions` flag should only be used in trusted CI environments

---

## 7. MCP Servers

### What It Does

**Model Context Protocol (MCP)** servers extend Claude Code with additional tools and data sources. MCP is an open protocol that allows Claude Code to connect to external services, databases, APIs, and custom tooling.

### How to Set It Up

**Configure via CLI:**

```bash
# Add an MCP server
claude mcp add my-server -- npx @my-org/mcp-server

# List configured servers
claude mcp list

# Remove a server
claude mcp remove my-server
```

**Configure via flags:**

```bash
# Load MCP config from a file
claude --mcp-config mcp-config.json

# Strict mode: only use servers from --mcp-config
claude --strict-mcp-config --mcp-config my-servers.json
```

**MCP config file format:**

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["@notionhq/mcp-server"],
      "env": {
        "NOTION_API_KEY": "secret_..."
      }
    },
    "github": {
      "command": "npx",
      "args": ["@github/mcp-server"]
    }
  }
}
```

### Popular MCP Servers

| Server | Purpose |
|--------|---------|
| `@notionhq/mcp-server` | Read/write Notion pages and databases |
| `@github/mcp-server` | Enhanced GitHub integration |
| `@anthropic/mcp-server-filesystem` | Extended filesystem operations |
| `@anthropic/mcp-server-postgres` | Query PostgreSQL databases |
| Playwright MCP | Browser automation and testing |
| Figma MCP | Design-to-code from Figma files |
| Context7 | Library documentation lookup |

### Best Use Cases

- Connecting Claude to internal tools and databases
- Adding domain-specific capabilities (Figma, Notion, Slack)
- Custom tooling for proprietary workflows
- Browser automation via Playwright

### Limitations

- MCP servers run as separate processes and add startup latency
- Security: MCP servers can execute arbitrary code -- vet them carefully
- Not all MCP servers are production-quality
- Debug with `--debug` flag (the older `--mcp-debug` flag is deprecated)

---

## 8. Plugins

### What It Does

Claude Code supports a **plugin system** for extending functionality. Plugins can add new tools, modify behavior, or integrate with external services.

### How to Set It Up

```bash
# List installed plugins
claude plugin list

# Load plugins from a directory for a single session
claude --plugin-dir /path/to/my-plugins
```

Plugins are loaded from directories and can provide additional tools, system prompts, or behavioral modifications.

### Best Use Cases

- Organization-specific tooling
- Custom approval workflows
- Domain-specific code generation patterns
- Internal API integrations

### Limitations

- Plugin ecosystem is still maturing
- Plugins must be trusted -- they can modify Claude's behavior
- Limited documentation compared to MCP servers
- Session-scoped plugin loading (`--plugin-dir`) doesn't persist

---

## 9. Chrome Integration

### What It Does

The `--chrome` flag enables Claude Code to interact with a Chrome browser, useful for web development workflows where you need Claude to see and interact with your application.

### How to Set It Up

```bash
# Enable Chrome integration
claude --chrome

# Disable Chrome integration
claude --no-chrome
```

### Best Use Cases

- Debugging frontend issues by having Claude inspect the rendered page
- End-to-end testing workflows
- Visual verification of UI changes

### Limitations

- Requires Chrome/Chromium to be installed
- Adds complexity to the session
- For heavier browser automation, Playwright MCP is generally more capable

---

## 10. Custom Agents

### What It Does

Claude Code supports defining **custom agents** -- specialized personas with specific prompts and descriptions. These can be used for recurring workflows like code review, documentation, or security auditing.

### How to Set It Up

**Via CLI flag:**

```bash
claude --agent reviewer

# Define agents inline
claude --agents '{"reviewer": {"description": "Reviews code for quality", "prompt": "You are a senior code reviewer. Focus on correctness, security, and maintainability."}}'
```

**Via settings file:**

```json
{
  "agents": {
    "reviewer": {
      "description": "Code review specialist",
      "prompt": "You are a senior code reviewer..."
    },
    "security": {
      "description": "Security auditor",
      "prompt": "You are a security expert. Identify vulnerabilities..."
    }
  }
}
```

**List available agents:**

```bash
claude agents
```

### Best Use Cases

- **Standardized code reviews** with consistent criteria
- **Security auditing** with a security-focused persona
- **Documentation generation** with a technical writing agent
- **Team workflows** where different roles need different Claude behaviors

### Limitations

- Agents share the same underlying model; the "specialization" is purely prompt-based
- Agent definitions are static; they don't learn or adapt between sessions
- Complex multi-agent coordination requires external orchestration

---

## Pros/Cons Summary

| Integration | Pros | Cons |
|-------------|------|------|
| **Cron / Scheduled** | Native `/loop` and `CronCreate` for in-session scheduling; `-p` mode for external cron/CI; cost-controllable with budget caps | Native scheduling requires active session; max 50 tasks; auto-expires after 3 days |
| **Agent Teams** | Built-in planning, dependency tracking, mailbox communication; each agent gets own worktree + 1M context; Leader/Swarm/Pipeline/Watchdog patterns | Experimental flag required; cost scales linearly; orchestration overhead for simple tasks |
| **Worktrees** | Safe isolation; multiple branches simultaneously; tmux support; CLI-native (no longer desktop-only); independent builds/tests | Git-only; manual cleanup needed; disk overhead |
| **Hooks** | Enforce policies automatically; audit logging | Adds latency; sync-only execution |
| **VS Code** | Seamless editor integration; context-aware | Requires CLI install; may lag behind CLI features |
| **GitHub** | PR reviews, CI/CD, issue management out of the box | Requires `gh` CLI; large diffs may exceed context |
| **MCP Servers** | Infinitely extensible; open protocol | Security risk if unvetted; startup latency |
| **Plugins** | Custom tooling; org-specific extensions | Immature ecosystem; limited docs |
| **Chrome** | Visual web debugging | Limited vs. Playwright MCP |
| **Custom Agents** | Consistent personas; team standardization | Prompt-only specialization; no learning |

---

## Sources

- Claude Code CLI `--help` output (verified locally, 2026-03) [SOURCE DATE: 2026-03]
- [Anthropic Documentation: Claude Code overview and CLI reference](https://docs.anthropic.com/en/docs/claude-code) [SOURCE DATE: 2025-04]
- [Anthropic Documentation: Model Context Protocol](https://modelcontextprotocol.io) [SOURCE DATE: 2025-03]
- [Anthropic Blog: Introducing Claude Code](https://www.anthropic.com/blog/claude-code) [SOURCE DATE: 2025-02]
- [GitHub: Anthropic Claude Code repository](https://github.com/anthropics/claude-code) [SOURCE DATE: 2025-12]
- [Claude Code SDK and headless mode documentation](https://docs.anthropic.com/en/docs/claude-code/sdk) [SOURCE DATE: 2025-06]
- [Claude Code Agent Teams documentation](https://code.claude.com/docs/en/agent-teams) [SOURCE DATE: 2026-02]
- [Addy Osmani: Claude Code Agent Teams](https://addyosmani.com/blog/claude-code-agent-teams/) [SOURCE DATE: 2026-02]
- [Paddo.dev: Claude Code Hidden Swarm](https://paddo.dev/blog/claude-code-hidden-swarm/) [SOURCE DATE: 2026-02]
- [Claude Code Scheduled Tasks documentation](https://code.claude.com/docs/en/scheduled-tasks) [SOURCE DATE: 2026-01]
- [ClaudeFast: Scheduled Tasks Guide](https://claudefa.st/blog/guide/development/scheduled-tasks) [SOURCE DATE: 2026-01]
- [ClaudeLab: Worktree Guide](https://claudelab.net/en/articles/claude-code/worktree-guide) [SOURCE DATE: 2026-01]
- [GitHub: Claude Code v2.1.71 Release Notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.71) [SOURCE DATE: 2026-01]
- Community patterns for Claude Code swarm/parallel execution (various GitHub discussions) [SOURCE DATE: 2025-08]

> **Note:** Updated 2026-03 with Agent Teams (released Feb 2026), native scheduling (`/loop`, `CronCreate`), and CLI-native worktree support. Some features (particularly plugins and custom agents) may have evolved since the linked source dates. Verify against the latest official docs at https://docs.anthropic.com.
