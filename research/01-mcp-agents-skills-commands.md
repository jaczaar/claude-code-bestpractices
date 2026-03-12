# MCP vs Agents vs Skills vs Slash Commands in Claude Code

## Summary

Claude Code exposes four distinct extensibility mechanisms: **MCP servers** (external tool providers via the Model Context Protocol), **Agents/subagents** (delegated autonomous task runners), **Skills** (reusable prompt-and-tool bundles invoked by name), and **Slash Commands** (user-facing shortcuts that trigger skills or built-in actions). Each serves a different purpose, operates at a different layer, and carries different trade-offs around context consumption, control, and composability. This document defines each, explains when to use them, how they interact, their limitations, and practical examples.

---

## 1. MCP Servers (Model Context Protocol)

### Definition

MCP is an open protocol (originally published by Anthropic in late 2024) that standardizes how LLM-based tools connect to external data sources and capabilities. An MCP server is a standalone process that exposes **tools**, **resources**, and **prompts** over a JSON-RPC transport (stdio or HTTP/SSE). Claude Code acts as an MCP *client* -- it discovers available servers, lists their tools, and calls them when the model decides they are relevant.

Configuration lives in `.claude/settings.json` (project-scoped) or `~/.claude/settings.json` (global):

```jsonc
// .claude/settings.json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-notion"],
      "env": { "NOTION_API_KEY": "${NOTION_API_KEY}" }
    }
  }
}
```

### How It Works

1. On startup, Claude Code spawns each configured MCP server as a child process.
2. It sends `initialize` and `tools/list` requests to discover available tools.
3. Tool schemas (name, description, JSON Schema parameters) are injected into the system prompt as available tools.
4. During conversation, the model can call MCP tools exactly like built-in tools (Read, Edit, Bash, etc.).
5. Results flow back through the same JSON-RPC channel and appear in the conversation.

### Context / Token Overhead

Every active MCP server contributes to the system prompt size because its tool definitions must be present for the model to know they exist. MCP tools can consume **66,000+ tokens** before a single user message is sent. Empirical observations:

| Factor | Approximate Token Cost |
|---|---|
| Each tool definition (name + description + schema) | ~100-400 tokens per tool |
| A server with 10 tools | ~1,500-3,500 tokens |
| A server with 20 tools (e.g., mcp-omnisearch) | ~14,214 tokens |
| A server with 40+ tools (e.g., full GitHub MCP) | ~8,000-15,000+ tokens |
| Jira MCP server alone | ~17,000 tokens |
| Five-server setup (58 tools total) | ~55,000 tokens before conversation starts |
| Overhead per MCP call result | Varies by payload; typically 200-2,000 tokens |

With a context window of ~200k tokens, having 3-4 MCP servers with 10-15 tools each can consume 10,000-15,000 tokens just for tool definitions -- roughly 5-8% of the context window before any conversation begins. Heavier setups easily reach 25-30%. This is why selective activation (loading servers on-demand rather than always-on) is a practical strategy.

### Tool Search: Deferred/Lazy Loading (Context Reduction)

Claude Code's **Tool Search** mechanism (the `ToolSearch` built-in tool) addresses MCP context bloat by deferring tool schema loading. Instead of injecting every tool's full JSON Schema into the system prompt at startup, deferred tools are registered by name only. The model calls `ToolSearch` to fetch schemas on demand.

Measured impact:
- **46.9% reduction** in one benchmark: from ~51K tokens down to ~8.5K tokens.
- **Up to 85% reduction** in larger setups: 191,300 tokens preserved vs 122,800 tokens with traditional loading.
- Effectively a **95% reduction** in upfront schema cost for deferred tools (only names are loaded, ~5-10 tokens per tool vs hundreds).

This is the recommended approach for any setup with more than 2-3 MCP servers. See Section 9 for implementation strategies.

### When to Use

- You need Claude Code to interact with an **external system** (GitHub, Notion, Slack, databases, Figma, browser automation).
- The capability is **reusable across conversations** and projects.
- You want a **standardized interface** that works across multiple LLM clients (not just Claude Code).

### Limitations

- **Token overhead**: Tool schemas consume context even when not used in a given turn.
- **Cold start**: MCP servers must be spawned and initialized; adds 1-3 seconds on startup per server.
- **No streaming**: Tool results arrive as complete payloads, not streamed.
- **Error opacity**: When an MCP server crashes or returns malformed JSON-RPC, debugging can be difficult. Logs go to stderr of the child process.
- **Security surface**: MCP servers run with the permissions of the Claude Code process. A malicious or buggy server has full filesystem/network access.
- **No built-in auth flow**: Credentials must be passed via environment variables; there is no OAuth handshake in the protocol (as of early 2025 spec).

---

## 2. Agents / Subagents

### Definition

Agents in Claude Code refer to **autonomous task execution loops** where the model plans, executes tool calls, observes results, and iterates until a goal is met. Claude Code itself is an agent. **Subagents** are child instances spawned via the `Task` tool (also called "task delegation") to handle isolated subtasks without polluting the main conversation context.

When you invoke the `Task` tool, Claude Code:

1. Creates a new, isolated conversation context (a child agent).
2. Passes it a task description and an optional set of allowed tools.
3. The subagent runs autonomously -- reading files, searching, editing -- until it completes the task or hits a limit.
4. The subagent's final output is returned to the parent as a single message.

```
# Conceptual flow (not actual code -- this happens internally)
Parent agent -> Task(description: "Find all usages of deprecated API X and list them") -> Subagent runs -> Returns summary
```

### When to Use

- **Heavy research** that would consume too many tokens in the main context (e.g., "audit all files for security vulnerabilities").
- **Parallel workstreams**: Multiple independent subtasks can run as separate subagents.
- **Context isolation**: When a subtask generates a lot of intermediate output (reading many files), offloading it to a subagent keeps the main conversation clean.
- **Multi-step refactors** where you want to break work into phases.

### Limitations

- **No shared state**: Subagents cannot see the parent's conversation history. They start with only the task description.
- **No interactive follow-up**: You cannot ask a subagent clarifying questions mid-execution. It runs to completion.
- **Tool restrictions**: Subagents may have a reduced tool set (e.g., read-only by default unless explicitly granted write tools).
- **Cost**: Each subagent consumes its own token budget. A complex subtask can use 50k-100k+ tokens internally, even if it returns a 500-token summary.
- **No cross-agent communication**: Two sibling subagents cannot coordinate or share findings directly (see Agent Teams below for the exception).
- **Timeout risk**: Long-running subagents can hit timeout limits without completing.

### Agent Teams / Swarm Mode (Experimental)

Released February 5, 2026 alongside Opus 4.6, **Agent Teams** (also called "Swarm Mode") introduces fully-implemented multi-agent orchestration via the `TeammateTool`. Enable with:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Key capabilities:
- **Orchestration patterns**: Leader (single coordinator), Swarm (peer-to-peer), Pipeline (sequential handoffs), Watchdog (monitoring/supervision).
- **Independent worktrees**: Each agent gets its own git worktree, preventing file conflicts between parallel agents.
- **1M token context per agent**: Each teammate operates with a full context window.
- **Task list with dependency tracking**: Agents can declare task dependencies, and the orchestrator respects execution order.
- **Mailbox system**: Inter-agent communication via a message-passing mailbox, solving the "no cross-agent communication" limitation of basic subagents.

Agent Teams is experimental and gated behind the environment variable. It is designed for large-scale tasks (full feature implementation, multi-service refactors, comprehensive test suites) where parallelism across independent worktrees provides significant speedup.

### Practical Example

```
User: "Audit the entire src/ directory for hardcoded credentials and environment variables that should be externalized."

Claude Code (main agent):
  -> Spawns Task: "Search all files in src/ for patterns matching API keys, passwords, tokens, connection strings. List each finding with file path, line number, and the offending pattern."
  -> Subagent reads files, greps patterns, returns structured list
  -> Main agent summarizes findings and suggests fixes
```

---

## 3. Skills

### Definition

Skills are **named, reusable capability bundles** that package a prompt template with tool access into an invocable unit. They extend Claude Code's behavior without requiring an MCP server. Skills are registered and can be invoked by name using the `Skill` tool.

A skill typically:
- Has a name (e.g., `"commit"`, `"review-pr"`, `"pdf"`)
- May accept arguments
- Injects specialized instructions into the conversation
- May grant access to specific tools or tool configurations
- Can be provided by installed extensions or defined in the Claude Code configuration

Skills sit between slash commands (user-facing) and raw tool calls (model-facing). They are the **implementation layer** that slash commands often invoke.

### How Skills Are Loaded

Skills follow a two-phase loading pattern:

1. **Available skills are advertised** in `<available-deferred-tools>` messages in the system context. This costs minimal tokens -- just the tool names.
2. **When invoked**, the `Skill` tool is called with `skill: "name"` and optional `args`. This triggers the skill's full instructions to be injected into the conversation, including any specialized prompts and tool configurations.

The `Skill` tool enforces a strict protocol:
- If a user message references a slash command (e.g., `/commit`), the model **must** invoke the Skill tool before generating any other response about the task.
- Skills that are already running should not be re-invoked.
- Built-in CLI commands (`/help`, `/clear`, etc.) are **not** handled by the Skill tool.

### Skill vs. Deferred Tool

A related but distinct mechanism is the **deferred tool**. Deferred tools are tool definitions (often from MCP servers) that are registered by name only -- no parameter schema is loaded upfront. The `ToolSearch` tool fetches their full schemas on demand. Example deferred tools in a typical session: `WebSearch`, `NotebookEdit`, `EnterWorktree`, `ExitWorktree`.

The key difference:
- **Skills** inject prompt instructions and orchestrate multi-step workflows.
- **Deferred tools** are regular tools with lazy-loaded schemas to save context tokens.

### When to Use

- You want a **repeatable workflow** (e.g., "review this PR", "generate a commit message", "convert this to PDF").
- The task requires **specialized prompting** that goes beyond what a generic tool call provides.
- You want to **encapsulate domain knowledge** into a callable unit.

### Skills Ecosystem

As of early 2026, Skills have a growing ecosystem:
- **Official repository**: [github.com/anthropics/skills](https://github.com/anthropics/skills) -- Anthropic-maintained collection.
- **`/plugin` command**: Browse and install skills directly from the CLI.
- **Multiple marketplaces**: SkillsMP, SkillHub, Claude Skills Market -- community-driven directories.
- **Adoption**: The `frontend-design` skill alone has 277K+ installs.
- **v2.1 features**: Forked context (skills can branch the conversation state), hot reload (edit a skill and see changes without restart), and custom agent support (skills can define their own agent loops).

### Limitations

- **Discovery**: Available skills depend on what is installed/configured. Not all skills are loaded by default (some are "deferred" to save context).
- **Not composable by default**: Skills do not natively chain into each other without the model orchestrating the flow.
- **Limited parameterization**: Skills accept string arguments, not structured data.
- **Context cost**: Like MCP tools, loaded skills add to the system prompt size.
- **Blocking requirement**: The model must invoke a skill before doing anything else when a slash command is detected, which can cause false triggers if user input coincidentally starts with `/`.

### Practical Example

```
User: /commit -m "fix timeout in worker pool"

# This invokes the "commit" skill, which:
# 1. Runs git status and git diff
# 2. Analyzes staged changes
# 3. Creates a well-formatted commit message
# 4. Executes git commit
```

---

## 4. Slash Commands

### Definition

Slash commands are **user-facing shortcuts** typed in the Claude Code CLI that trigger specific behaviors. They start with `/` and map to either:

1. **Built-in CLI commands** (e.g., `/help`, `/clear`, `/compact`, `/config`) -- these are handled by the CLI itself, not the model.
2. **Skill invocations** (e.g., `/commit`, `/review-pr`) -- these are syntactic sugar that trigger the `Skill` tool.

Slash commands are the **user interface layer** -- the ergonomic way to invoke skills and built-in actions.

### Built-in Slash Commands

| Command | Type | Description |
|---|---|---|
| `/help` | Built-in | Show available commands and usage |
| `/clear` | Built-in | Clear conversation history |
| `/compact` | Built-in | Compress conversation to save context tokens |
| `/config` | Built-in | Open configuration |
| `/cost` | Built-in | Show token usage for current session |
| `/commit` | Skill | Stage and commit changes with a generated message |
| `/review-pr` | Skill | Review a pull request (accepts PR number as arg) |
| `/pr` | Skill | Create a pull request with generated title/body |
| `/pdf` | Skill | Generate a PDF from current context |

### Custom Slash Commands

As of 2025, users can create project-scoped custom commands by placing markdown files in a `.claude/commands/` directory. Each `.md` file becomes a slash command named after the file. The file content serves as the prompt template, with `$ARGUMENTS` as a placeholder for user input.

```
.claude/commands/
  fix-lint.md       ->  /project:fix-lint
  gen-migration.md  ->  /project:gen-migration
```

This makes slash commands **user-extensible** at the project level, without needing to write a full skill or extension.

### When to Use

- You want a **quick, memorable shortcut** for a common action.
- You are interacting with Claude Code **interactively** (not via API/headless mode).
- You want to trigger a **built-in CLI function** that doesn't involve the model at all (like `/clear`).

### Limitations

- **Interactive only**: Slash commands are a CLI feature; they don't work in API/SDK usage.
- **Custom commands are prompt-only**: `.claude/commands/` files inject prompt text but cannot define tool restrictions, structured parameters, or multi-step orchestration logic like full skills can.
- **No chaining**: You cannot pipe the output of one slash command into another.
- **Namespace collisions**: If a skill name matches a built-in command, the built-in takes precedence.
- **No return values**: Slash commands trigger actions but have no mechanism to capture or reuse their output programmatically.

---

## 5. How They Interact

```
+-------------------+
|   User Input      |  "/commit", "fix the bug", etc.
+--------+----------+
         |
         v
+--------+----------+
| Slash Commands    |  CLI layer: routes /commands
+--------+----------+
         |
         | (skill-based commands invoke Skill tool)
         v
+--------+----------+
| Skills            |  Named capability bundles
+--------+----------+
         |
         | (skills use tools, including MCP tools)
         v
+--------+----------+     +-------------------+
| Built-in Tools    |<--->| MCP Server Tools  |
| (Read, Edit, Bash)|     | (GitHub, Notion)  |
+--------+----------+     +-------------------+
         |
         | (Task tool spawns subagents)
         v
+--------+----------+
| Subagents         |  Isolated child agent loops
| (via Task tool)   |  with their own tool access
+-------------------+
```

### Key Interaction Patterns

1. **Slash commands invoke skills**: `/commit` triggers the `commit` skill via the `Skill` tool. The skill then uses built-in tools (Bash for git commands, Read for file inspection).

2. **Skills can use MCP tools**: A skill like `review-pr` may call GitHub MCP tools to fetch PR details, comments, and diff data.

3. **Agents use all tools**: The main agent (and subagents) can call built-in tools, MCP tools, and invoke skills. The model decides which to use based on the task.

4. **Subagents are context-isolated**: A subagent does not inherit the parent's MCP tool results or conversation history. It gets a fresh context with the task description and access to the same tool set.

5. **MCP tools appear as regular tools**: From the model's perspective, there is no difference between calling `Read` (built-in) and calling `github_create_issue` (MCP). Both are tools with schemas.

---

## 6. Decision Framework

```
Do you need to connect to an external system/API?
  YES -> MCP Server
  NO  -> Continue

Is this a user-facing shortcut for a common action?
  YES -> Slash Command (backed by a Skill)
  NO  -> Continue

Is this a reusable workflow with specialized prompting?
  YES -> Skill
  NO  -> Continue

Is this a heavy/parallel subtask that would pollute the main context?
  YES -> Subagent (Task tool)
  NO  -> Just use the main agent with built-in tools
```

---

## 7. Comparison Table

| Dimension | MCP Servers | Agents/Subagents | Skills | Slash Commands |
|---|---|---|---|---|
| **What it is** | External tool provider (protocol) | Autonomous task runner (loop) | Named prompt+tool bundle | User-facing CLI shortcut |
| **Layer** | Tool infrastructure | Execution model | Capability packaging | User interface |
| **Invoked by** | Model (tool call) | Model (Task tool) or user | Model (Skill tool) or user (`/name`) | User (typing `/name`) |
| **Context cost** | High (tool schemas always loaded; use Tool Search to mitigate) | Isolated (own context window; 1M per agent in Teams) | Moderate (loaded on demand) | None (just triggers something) |
| **Runs externally** | Yes (separate process) | No (child of Claude Code) | No (in-process) | No (CLI dispatch) |
| **Reusable across projects** | Yes (global config) | Per-conversation | Yes (installed extensions) | Yes (if backed by skill) |
| **User-extensible** | Yes (write your own server) | No (built-in mechanism) | Limited (extension API) | Yes (`.claude/commands/*.md`) |
| **Supports structured I/O** | Yes (JSON Schema) | Text in, text out | String args only | String args only |
| **Can call other tools** | No (tools are called, not callers) | Yes (full tool access) | Yes (via model) | Indirectly (via skill) |
| **Typical token overhead** | 1,500-15,000+ tokens per server | 50k-100k+ per subtask (isolated) | ~200-500 tokens when loaded | 0 tokens |
| **Best for** | External integrations | Heavy/parallel research | Repeatable workflows | Quick interactive actions |

---

## 8. Practical Examples

### MCP Server: GitHub Integration

```jsonc
// ~/.claude/settings.json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

Once configured, Claude Code can:
```
User: "List open PRs on machine-cloud that are older than 7 days"
Claude: [calls github_list_pull_requests tool via MCP] -> returns results
```

### Subagent: Codebase Audit

```
User: "Find all TODO comments across the repo and categorize them by priority"

Claude Code internally:
  -> Task("Search all source files for TODO/FIXME/HACK comments.
           For each, extract the file path, line number, comment text,
           and infer priority (critical/medium/low) based on context.
           Return as a structured list.")
  -> Subagent searches, reads files, returns categorized list
  -> Main agent formats and presents results
```

### Skill: PDF Generation

```
User: /pdf

# Invokes the "pdf" skill which:
# 1. Identifies the relevant content in the current context
# 2. Formats it appropriately
# 3. Generates a PDF output
```

### Slash Command: Context Management

```
User: /compact

# Built-in command (not a skill):
# Compresses the conversation history to free up context tokens
# No model involvement -- handled by the CLI directly
```

---

## 9. Advanced: Managing MCP Context Overhead

Since MCP tool schemas are a significant source of context consumption, here are strategies to manage it:

### On-Demand Activation

Rather than loading all MCP servers at startup, activate them only when needed:

```markdown
<!-- In CLAUDE.md -->
## MCP Servers
Always active: github (core workflow dependency)
On-demand:
- playwright -- activate with `mcp-on playwright` for UI testing
- figma -- activate with `mcp-on figma` for design work
- notion -- activate with `mcp-on notion` for documentation
Deactivate with `mcp-off <name>` when done.
```

### Deferred Tool Loading (Tool Search)

Claude Code supports **deferred tools** -- tools that are registered by name only (no schema) until explicitly fetched via `ToolSearch`. This avoids paying the schema token cost upfront for tools that may not be needed. In a typical session, tools like `WebSearch`, `NotebookEdit`, `EnterWorktree`, and `ExitWorktree` are deferred. The `ToolSearch` tool accepts a query (exact names via `"select:ToolA,ToolB"` or keyword search) and returns full JSON Schema definitions, after which the tools become callable.

Measured impact of Tool Search on real setups:
- A five-server, 58-tool setup consuming ~55K tokens upfront can be reduced to ~8.5K tokens (names only), a **46.9% reduction** in total context usage.
- In larger configurations, Tool Search preserves **191,300 tokens** compared to 122,800 with traditional loading -- an **85% reduction** in schema overhead.
- Individual server example: mcp-omnisearch with 20 tools costs ~14,214 tokens fully loaded vs ~200 tokens deferred (names only).

This is the single most impactful optimization for MCP-heavy setups.

### Prefer Fewer, Focused Servers

A single MCP server exposing 5 targeted tools is far more context-efficient than one exposing 40 tools where only 5 are relevant. When writing custom MCP servers, keep the tool surface minimal.

---

## Sources

> **Note on sourcing**: Initial draft synthesized from model training data and direct observation. Updated March 2026 with web research data on MCP context costs, Skills ecosystem, and Agent Teams.

### Original Sources
- [Anthropic: Model Context Protocol Specification](https://modelcontextprotocol.io/) [SOURCE DATE: 2024-11]
- [Anthropic: Introducing the Model Context Protocol (blog)](https://www.anthropic.com/news/model-context-protocol) [SOURCE DATE: 2024-11]
- [Anthropic: Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code) [SOURCE DATE: 2025-03]
- [Anthropic: Claude Code CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage) [SOURCE DATE: 2025-03]
- [GitHub: anthropics/claude-code](https://github.com/anthropics/claude-code) [SOURCE DATE: 2025-04]
- [GitHub: modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) [SOURCE DATE: 2025-02]
- [Anthropic: Tool Use Documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) [SOURCE DATE: 2025-01]
- [Anthropic: Claude Code Custom Slash Commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands) [SOURCE DATE: 2025-05]
- Token overhead estimates are based on empirical observations from Claude Code usage and community reports, not official benchmarks. [SOURCE DATE: 2025-Q1]
- Direct observation of Claude Code tool definitions (Skill tool, ToolSearch tool, deferred tools list) in a live session. [SOURCE DATE: 2026-03]

### Web Research Sources (Added 2026-03-11)
- [Scott Spence: Optimising MCP Server Context Usage in Claude Code](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code) -- MCP token overhead measurements (14K per server, 55K for five servers, 66K+ total possible)
- [Joe Njenga: Claude Code Just Cut MCP Context Bloat by 46.9%](https://medium.com/@joe.njenga/claude-code-just-cut-mcp-context-bloat-by-46-9-51k-tokens-down-to-8-5k-with-new-tool-search-ddf9e905f734) -- Tool Search benchmarks (51K to 8.5K, 85% reduction in larger setups)
- [Anthropic: Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) -- Official skills docs, v2.1 features (forked context, hot reload, custom agents)
- [GitHub: anthropics/skills](https://github.com/anthropics/skills) -- Official skills repository
- [Anthropic: Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) -- Official Agent Teams docs (TeammateTool, orchestration patterns, worktrees)
- [Addy Osmani: Claude Code Agent Teams](https://addyosmani.com/blog/claude-code-agent-teams/) -- Agent Teams overview (Leader/Swarm/Pipeline/Watchdog patterns, 1M token context per agent)
- [Paddo.dev: Claude Code Hidden Swarm](https://paddo.dev/blog/claude-code-hidden-swarm/) -- Swarm mode internals (mailbox system, dependency tracking, Feb 5 2026 release with Opus 4.6)
