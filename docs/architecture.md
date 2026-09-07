# AgentOS Architecture (V1)

## Goals

- Ship a usable agent system quickly
- Keep the design clean so we can grow into full production features later
- Never treat the LLM as the entire agent

## Core Loop

```
USER GOAL
   ↓
ANALYZING
   ↓
PLANNING  →  (optional) AWAITING_APPROVAL
   ↓
EXECUTING → OBSERVING → VERIFYING
   ↓
COMPLETED / FAILED / RETRY
```

## Packages

| Package            | Responsibility                              |
|--------------------|---------------------------------------------|
| `@agent-os/shared` | Zod schemas, domain types, permissions      |
| `@agent-os/agent-core` | State machine, Planner, Orchestrator   |
| `@agent-os/ai`     | LLM provider interface + adapters + router  |
| `@agent-os/tools`  | Tool implementations                        |
| `@agent-os/database` | Prisma schema + repositories             |
| `apps/web`         | Next.js UI + API routes                     |

## Key Rules

1. All tool calls go through permission checks.
2. High-risk actions require human approval.
3. State transitions are validated.
4. Retries are limited.
5. No raw chain-of-thought is shown to the user.
6. Business logic lives in packages, not in React components.

## Next Steps

- Phase 1: Database + Auth + Dashboard
- Phase 2: Real LLM-backed planner + full orchestrator loop
- Phase 3: First tools (calculator, web search, etc.)
