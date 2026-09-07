# AgentOS

**Production-oriented Autonomous AI Agent Platform**

AgentOS is a general-purpose AI agent orchestration system. A user gives a natural-language goal, and the system understands, plans, executes tools, observes results, recovers from errors, verifies work, and asks for human approval when needed.

> **Core Principle**  
> LLM ≠ Agent  
> Agent = LLM + State + Memory + Planning + Tools + Execution + Verification + Recovery + Permissions

---

## Improved & Realistic Scope (v1)

Original blueprint was excellent but too ambitious for a first shippable version. This is the **pragmatic** version we will build.

### True MVP (Ship in 3–5 weeks)

| Feature                    | Included in V1 |
|---------------------------|----------------|
| Chat + Agent Sessions     | ✅             |
| Simple Planner            | ✅             |
| Task list + basic deps    | ✅             |
| Orchestrator loop         | ✅             |
| Calculator + Datetime     | ✅             |
| Web Search + Web Fetch    | ✅ (abstraction) |
| Working + Episodic Memory | ✅             |
| Basic Retry               | ✅             |
| Live status (SSE or poll) | ✅             |
| Human Approval (high-risk)| ✅             |
| PostgreSQL + Prisma       | ✅             |
| Auth                      | ✅             |
| Audit logs                | ✅             |
| Semantic Memory (pgvector)| ❌ (Phase 4)   |
| Full Recovery + Replan    | ❌ (Phase 5)   |
| BullMQ Worker separation  | ❌ (Phase 5)   |
| Coding Agent / Terminal   | ❌ (Phase 6+)  |
| Multi-Agent               | ❌ (V3)        |

---

## Architecture (Simplified for V1)

```
User → Next.js UI
         ↓
   API Routes / Server Actions
         ↓
   Agent Orchestrator
         ↓
   ┌─────────────┬──────────────┬─────────────┐
   │   Planner   │    Memory    │  LLM Router │
   └─────────────┴──────────────┴─────────────┘
         ↓
   Tool Manager (+ Permissions)
         ↓
   Executor → Observe → Verify → Done / Retry / Ask User
```

### State Machine (V1)

```
IDLE → ANALYZING → PLANNING → AWAITING_APPROVAL (optional)
     → EXECUTING → OBSERVING → VERIFYING → COMPLETED

Error path:
EXECUTING → FAILED → RETRYING → EXECUTING
                 ↓ (max retries)
              AWAITING_APPROVAL / FAILED
```

---

## Tech Stack

**Frontend**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Zustand + TanStack Query

**Backend (MVP)**
- Next.js API Routes / Server Actions
- Later: extract worker to separate process

**Database**
- PostgreSQL + Prisma
- Redis (later for queues)

**AI**
- Provider abstraction (OpenAI / Anthropic / Grok / others)
- Start with 1–2 providers + clean interface

---

## Monorepo Structure (Start Simple)

```
AgentOS/
├── apps/
│   └── web/                  # Next.js app
├── packages/
│   ├── agent-core/           # Orchestrator, Planner, State, Types
│   ├── ai/                   # LLM providers + router
│   ├── tools/                # Tool implementations
│   ├── database/             # Prisma schema + client
│   └── shared/               # Zod schemas, utils, constants
├── docs/
├── scripts/
├── package.json
├── turbo.json
└── README.md
```

We start with a **minimal** package set. More packages only when needed.

---

## Development Phases (Realistic)

### Phase 0 – Bootstrap (Day 1)
- Monorepo (pnpm + Turborepo)
- TypeScript strict
- ESLint + Prettier
- Basic Next.js app + Tailwind + shadcn

### Phase 1 – Foundation (Day 2–4)
- Prisma schema (User, Session, Message, Plan, Task, ToolCall, Approval, AgentEvent)
- Auth
- Dashboard skeleton
- Create / list sessions

### Phase 2 – Agent Core (Day 5–9)
- Agent state machine
- Planner (goal → tasks)
- Orchestrator loop
- LLM provider interface + one real provider
- Prompt composition

### Phase 3 – Tools + Execution (Day 10–14)
- Tool interface + permission check
- calculator, datetime, web_search, web_fetch
- Tool execution + observation
- Basic retry
- Live status updates

### Phase 4 – Memory + Polish (Day 15–18)
- Working + Episodic memory
- Approval UI
- Better error handling
- Audit logs

### Phase 5+ (Later)
- Redis + BullMQ
- Semantic memory (pgvector)
- Full recovery + replan
- Coding tools + sandbox
- Multi-agent

---

## Key Design Rules

1. **Never** tightly couple to one LLM provider.
2. **Never** give tools unrestricted host access.
3. **Never** inject full memory into every prompt.
4. **Never** show raw chain-of-thought to users.
5. Every important action must be auditable.
6. High-risk actions require human approval.
7. Limit retries. Prefer graceful failure + ask user over infinite loops.
8. Keep business logic out of React components.

---

## Getting Started (Coming Soon)

```bash
pnpm install
pnpm dev
```

---

## Status

- [x] Repository created
- [ ] Phase 0 – Project bootstrap
- [ ] Phase 1 – Foundation
- [ ] Phase 2 – Agent Core
- [ ] Phase 3 – Tools
- [ ] Phase 4 – Memory & Polish

---

Built with a focus on **shipping a real, usable agent system** instead of an over-engineered prototype.
