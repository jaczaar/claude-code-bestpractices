# The "Get Shit Done" (GSD) Framework

## Summary

GSD (Get Shit Done) is a lightweight meta-prompting, context engineering, and spec-driven development system for Claude Code (also supports OpenCode, Gemini CLI, Codex). Created by TÂCHES (glittercowboy), GSD solves "context rot" — the quality degradation that happens as Claude fills its context window. It ships as an installer via `npx` and has been adopted by engineers at Amazon, Google, Shopify, and Webflow.

GitHub: https://github.com/glittercowboy/get-shit-done (now gsd-build/get-shit-done)

---

## The Problem: Context Rot

Claude degrades predictably at 40-50% context utilization. As more tokens are consumed in a single session, AI accuracy drops — Claude starts rushing, cutting corners, and forgetting things. Traditional approaches try to fit everything into one session. GSD takes the opposite approach: keep sessions small and fresh.

---

## Core Principles

### 1. Context Engineering
- Meta-prompting with structured XML prompts and verification steps
- Thin orchestrators delegate to fresh subagent contexts
- Each subagent gets a clean 200K token context window

### 2. Spec-Driven Development
- Phase-based planning with goal-backward validation
- Every task has explicit success criteria defined upfront
- No vibe coding — everything traced back to specs

### 3. Aggressive Atomicity
- Each plan contains 2-3 tasks maximum
- Tasks designed to fit in ~50% of a fresh context window
- No single task is big enough to degrade quality

### 4. Wave-Based Parallelism
- Wave 1: Blocking tasks (sequential)
- Wave 2: Independent tasks (parallel)
- Wave 3: Tasks depending on Wave 2
- Dependencies tracked explicitly

### 5. Goal-Backward Verification
- After execution, verify output against explicit goals
- Each commit is surgical, traceable, and meaningful
- Git bisect can find exact failing tasks

---

## Workflow Phases

### Phase 1: Design (`/gsd:new-project` or `/gsd:discuss-phase`)
- Initialize project with designer thinking
- Capture design decisions
- Define project scope and requirements

### Phase 2: Plan (`/gsd:plan-phase`)
- Research and planning
- Break work into atomic plans (2-3 tasks each)
- Generate implementation plan with wave structure
- Define success criteria per task

### Phase 3: Execute (`/gsd:execute-phase`)
- Each task runs in a fresh subagent context
- Orchestrator delegates, doesn't execute
- Parallel execution where dependencies allow
- Each task independently committable and revertable

### Phase 4: Verify
- Goal-backward validation against specs
- Automated checks where possible
- Clear history maintained for Claude in future sessions

---

## Architecture: The Lean Orchestrator Pattern

GSD uses a "Lean Orchestrator" pattern:

1. **Orchestrator** — Thin coordinator that reads specs, assigns tasks, tracks progress. Uses minimal context.
2. **Subagents** — Fresh Claude instances per task. Each gets clean 200K context window. No context rot.
3. **File-based state** — All state externalized to files (specs, plans, progress). No reliance on conversation history.

Key insight: The orchestrator never does the work itself. It delegates everything to fresh contexts.

---

## Installation

```bash
npx get-shit-done
```

Supports: Claude Code, OpenCode, Gemini CLI, Codex.

---

## Practical Example

A 23-plan development project workflow:

1. `/gsd:new-project` — Initialize, define scope
2. `/gsd:discuss-phase` — Capture architecture decisions
3. `/gsd:plan-phase` — Generate 23 atomic plans, each with 2-3 tasks
4. `/gsd:execute-phase` — Execute plans in waves
5. Each plan spawns fresh subagent contexts
6. Progress tracked in files, not conversation history
7. Every commit maps to exactly one task — git bisect works perfectly

---

## Pros and Cons

### Pros
| Benefit | Detail |
|---------|--------|
| Eliminates context rot | Fresh 200K context per task |
| Traceable | Every commit maps to one task; git bisect works |
| Parallelizable | Wave-based execution enables concurrent work |
| Revertable | Each task independently revertable |
| Cross-platform | Works with Claude Code, OpenCode, Gemini CLI, Codex |
| Spec-driven | No vibe coding; everything traced to requirements |
| Community-proven | Used at Amazon, Google, Shopify, Webflow |

### Cons
| Limitation | Detail |
|------------|--------|
| Overhead | Setup cost for small projects; overkill for quick fixes |
| Orchestrator complexity | The orchestrator pattern adds a layer of abstraction |
| Token cost | Multiple fresh contexts = more total tokens consumed |
| Learning curve | Requires understanding the phase-based workflow |
| Community-driven | Not officially maintained by Anthropic |
| Solo-developer focus | Designed primarily for individual developers, not teams |

---

## GSD vs Traditional AI Coding

| Aspect | Traditional | GSD |
|--------|------------|-----|
| Context management | One long session | Fresh context per task |
| Quality over time | Degrades (context rot) | Consistent (fresh contexts) |
| Task granularity | Ad-hoc | 2-3 tasks per plan, atomic |
| Traceability | Unclear commit history | 1 commit = 1 task |
| Parallelism | Manual | Wave-based, automatic |
| State management | Conversation history | File-based |

---

## Sources

- [GSD GitHub Repository (glittercowboy/get-shit-done)](https://github.com/glittercowboy/get-shit-done)
- [GSD Framework: Spec-Driven Development for Claude Code — CC for Everyone](https://ccforeveryone.com/gsd)
- [GET SH*T DONE: Meta-prompting and Spec-driven Development — Agent Native](https://agentnativedev.medium.com/get-sh-t-done-meta-prompting-and-spec-driven-development-for-claude-code-and-codex-d1cde082e103)
- [GSD Framework: The System Revolutionizing Development — Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/169/gsd-framework-claude-code-ai-development)
- [I Tested GSD Claude Code — Joe Njenga](https://medium.com/@joe.njenga/i-tested-gsd-claude-code-meta-prompting-that-ships-faster-no-agile-bs-ca62aff18c04)
- [GSD Deep Dive — Codecentric](https://www.codecentric.de/en/knowledge-hub/blog/the-anatomy-of-claude-code-workflows-turning-slash-commands-into-an-ai-development-system)
- [Get Shit Done: How One Developer Built a System — Mayur Parve](https://medium.com/@parvemayur/get-shit-done-gsd-how-one-developer-built-a-system-to-make-ai-code-actually-work-c2023dc0bc38)
- [Goodbye Vibe Coding: Spec-Driven Development — Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/158/framework-ai-spec-driven-development-guide-bmad-gsd-ralph-loop)
- [Context Quality over Quantity — DeepWiki](https://deepwiki.com/glittercowboy/get-shit-done/14.1-claude-code)

---

*Research conducted: 2026-03-11. Last updated: 2026-03-11.*
