# Claude Code Skills — Official Store & Best Picks

## Summary

Claude Code Skills are reusable packages of instructions (SKILL.md files) that extend Claude's capabilities for specific tasks. As of March 2026, the skills ecosystem has exploded — Anthropic maintains an official skills repository, multiple third-party marketplaces host thousands of community skills, and the `/plugin` browser provides in-CLI discovery and installation. Skills use a standardized SKILL.md format with YAML frontmatter, making them portable across AI coding agents.

---

## Key Concepts

### What Is a Skill?

A skill is a `SKILL.md` file containing:
1. **YAML frontmatter** — metadata that tells Claude when and how to use the skill
2. **Markdown body** — instructions Claude follows when the skill is invoked

Skills are invoked either:
- **Manually** via slash command (e.g., `/frontend-design`)
- **Automatically** when Claude determines the task matches the skill's description

### Skills vs Plugins

As of v2.1, skills are packaged as **plugins**. A plugin is a directory containing one or more skills, and optionally hooks and configuration. The `/plugin` command is the primary interface for discovering and managing them.

---

## How to Install Skills

### Method 1: Built-in Plugin Browser (Recommended)

```
/plugin
```

Opens an interactive browser with:
- **Discover tab** — browse and search available skills
- **Installed tab** — manage installed skills
- Press Enter to install a skill

### Method 2: Direct Plugin Install

```
/plugin install <source>
```

Sources can be:
- GitHub repos: `/plugin install anthropics/skills`
- Specific skills: `/plugin install anthropics/skills/skills/frontend-design`
- Community registries: `/plugin install document-skills@anthropic-agent-skills`

### Method 3: Manual Installation

Create a `SKILL.md` file in your project's `.claude/skills/` directory or in `~/.claude/skills/` for global availability.

### Method 4: Community Registries

Several registries provide searchable catalogs:
- [claude-skill-registry](https://github.com/majiayu000/claude-skill-registry) — search with `sk search testing`, install with `sk install`
- [SkillsMP](https://skillsmp.com) — 400K+ agent skills with category filtering
- [SkillHub](https://www.skillhub.club) — 7,000+ AI-evaluated skills
- [Claude Skills Market](https://skills.pawgrammer.com/) — 119+ free community skills
- [MCP Market Skills](https://mcpmarket.com/tools/skills) — agent skills directory

---

## Creating Custom Skills

### SKILL.md Frontmatter Format

```yaml
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
model: opus           # Optional: request a specific model
version: "1.0.0"      # Optional: version tracking
disable-model-invocation: false  # Optional: if true, only manual /invoke works
---

# Skill Instructions

Your markdown instructions here. Claude follows these when the skill is invoked.
```

### Frontmatter Fields

| Field | Required | Max Length | Notes |
|-------|----------|-----------|-------|
| `name` | Yes | 64 chars | Lowercase, letters/numbers/hyphens only |
| `description` | Yes | 1024 chars | Primary trigger mechanism — Claude reads this to decide when to invoke |
| `model` | No | — | Override model (e.g., `opus` for complex tasks) |
| `version` | No | — | Semantic versioning for tracking |
| `disable-model-invocation` | No | — | Boolean; prevents auto-invocation when `true` |

### Key Authoring Tips

- The `description` field is **the primary mechanism** that determines whether Claude auto-invokes a skill. Write it carefully.
- Use consistent 2-space indentation (not tabs) in frontmatter.
- After creating a skill, optimize the description for better triggering accuracy.
- Skills support **forked context** — the skill runs in its own context, not polluting the main conversation.
- **Hot reload** — editing a SKILL.md takes effect immediately, no restart needed.

---

## Top Skills — Best Picks

### 1. Frontend Design (Official Anthropic)

**Installs:** 277,000+ | **Source:** [anthropics/claude-code/plugins/frontend-design](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)

The flagship Anthropic skill. Solves "distributional convergence" — the tendency of LLMs to produce identical-looking UIs (Inter font, purple gradient, grid cards).

**What it does:**
- Gives Claude a design system and philosophy before writing any code
- Outputs bold aesthetic choices, distinctive typography, purposeful color palettes
- Emphasizes animations that feel intentional, not decorative

**Design principles enforced:**
- **Typography**: Beautiful, unique fonts — avoids generic choices like Arial, Inter
- **Color**: Cohesive aesthetic with dominant colors and sharp accents over evenly-distributed palettes
- **Motion**: High-impact moments (one well-orchestrated page load with staggered reveals) over scattered micro-interactions

**Invoke:** `/frontend-design` or auto-triggers on UI generation tasks.

### 2. Simplify / Code Review

**Built-in skill** | Invoke: `/simplify`

Reviews recently changed files for:
- Code reuse opportunities
- Quality issues
- Efficiency problems

Spawns three review agents in parallel, then fixes any issues found.

### 3. Prompt Improver

Refines and optimizes prompts for better Claude Code interactions. Useful for:
- Improving skill descriptions for better auto-triggering
- Optimizing CLAUDE.md instructions
- Crafting better one-shot prompts

### 4. Memory Skill

Implements long-term memory using file-based persistence:
- Stores memories in `~/.claude/projects/<project>/memory/`
- Index file (`MEMORY.md`) for quick lookup
- Types: user, feedback, project, reference
- Auto-saves learnings between sessions

### 5. Skill Creator

**Source:** [anthropics/skills/skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)

Meta-skill that helps you create new skills. Generates proper SKILL.md structure with optimized frontmatter.

### 6. Planning with Files

**Stars:** 13,000+ | High demand for structured AI assistance

Generates implementation plans as markdown files, enabling:
- Multi-step project planning
- Progress tracking via checklists
- Architecture decision records

### 7. Valyu (Data & Research)

Connects Claude Code to web search and 36+ specialized data sources:
- SEC filings, PubMed, academic publishers
- Scores 79% on FreshQA benchmark
- Useful for research-heavy development tasks

### 8. CLAUDE.md Improver

Audits and improves CLAUDE.md files:
- Scans for all CLAUDE.md files in the project
- Evaluates quality against templates
- Outputs a quality report
- Makes targeted updates

Invoke: `/claude-md-improver`

---

## Notable Community Resources

| Resource | Description | Link |
|----------|-------------|------|
| awesome-claude-skills | Curated list of skills, resources, and tools | [GitHub](https://github.com/travisvn/awesome-claude-skills) |
| anthropics/skills | Official Anthropic skills repository | [GitHub](https://github.com/anthropics/skills) |
| Snyk Top 8 Skills | Developer-focused skill recommendations | [Snyk](https://snyk.io/articles/top-claude-skills-developers/) |
| Composio Top 10 | Builder-focused skill guide | [Composio](https://composio.dev/content/top-claude-skills) |
| 10 Must-Have Skills 2026 | Comprehensive skill roundup | [Medium](https://medium.com/@unicodeveloper/10-must-have-skills-for-claude-and-any-coding-agent-in-2026-b5451b013051) |

---

## Pros and Cons

### Pros

- **Zero permanent context overhead** — skills load only when relevant
- **Hot reload** — edit and test instantly
- **Portable** — standard SKILL.md format works across agents
- **Composable** — skills can invoke other skills
- **Forked context** — skills can run in isolation, keeping main conversation clean

### Cons / Limitations

- **Description-dependent triggering** — poorly written descriptions = missed invocations
- **No dependency management** — skills don't declare dependencies on other skills
- **Quality variance** — community skills range from excellent to broken
- **Registry fragmentation** — multiple competing marketplaces, no single source of truth
- **Model cost** — skills requesting `opus` model increase API costs

---

## Sources

- [Extend Claude with Skills — Official Docs](https://code.claude.com/docs/en/skills)
- [How to Create Custom Skills — Claude Help Center](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
- [Skill Authoring Best Practices — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Overview — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [anthropics/skills — GitHub](https://github.com/anthropics/skills)
- [Improving Frontend Design Through Skills — Claude Blog](https://claude.com/blog/improving-frontend-design-through-skills)
- [Frontend Design SKILL.md — GitHub](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
- [How to Add Skills to Claude Code: 3 Methods — PolySkill](https://polyskill.ai/blog/how-to-add-skills-to-claude-code)
- [Claude Code Has a Skills Marketplace Now — Medium](https://medium.com/@markchen69/claude-code-has-a-skills-marketplace-now-a-beginner-friendly-walkthrough-8adeb67cdc89)
- [10 Must-Have Skills for Claude in 2026 — Medium](https://medium.com/@unicodeveloper/10-must-have-skills-for-claude-and-any-coding-agent-in-2026-b5451b013051)
- [awesome-claude-skills — GitHub](https://github.com/travisvn/awesome-claude-skills)
- [Top 8 Claude Skills for Developers — Snyk](https://snyk.io/articles/top-claude-skills-developers/)
- [Claude Skills Deep Dive — Lee Hanchung](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) [SOURCE DATE: 2025-10]
- [Inside Claude Code Skills — Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-skills/) [SOURCE DATE: 2025-10]
- [The Complete Guide to Building Skills for Claude — Anthropic](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)
