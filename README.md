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
- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui-ready
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

## Monorepo Structure

```
AgentOS/
├── apps/
│   └── web/                  # Next.js app (dashboard + sessions UI)
├── packages/
│   ├── agent-core/           # Orchestrator, Planner, State Machine
│   ├── database/             # Prisma schema + client
│   └── shared/               # Zod schemas, domain types
├── docs/
├── package.json
├── turbo.json
└── README.md
```

---

## Development Phases

### Phase 0 – Bootstrap ✅
- Monorepo (pnpm + Turborepo)
- TypeScript strict
- Shared types + Agent core skeleton
- State machine with validated transitions

### Phase 1 – Foundation (in progress)
- ✅ Prisma schema (User, Session, Task, ToolCall, Approval, AgentEvent, Memory…)
- ✅ Next.js app scaffold + Tailwind
- ✅ Dashboard home + Sessions list + New Task UI
- [ ] Auth
- [ ] API routes for sessions
- [ ] Wire create session → DB

### Phase 2 – Agent Core
- Real LLM-backed planner
- Full orchestrator loop
- Prompt composition

### Phase 3 – Tools + Execution
- calculator, datetime, web_search, web_fetch
- Tool manager + permissions
- Basic retry + live status

### Phase 4 – Memory + Polish
- Working + Episodic memory
- Approval UI
- Audit logs

### Phase 5+
- Redis + BullMQ, Semantic memory, Coding agent, Multi-agent

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

## Getting Started

```bash
git clone https://github.com/sahadatsonar-cmyk/AgentOS.git
cd AgentOS
pnpm install

# Copy env and set DATABASE_URL
cp .env.example .env

# Generate Prisma client & push schema (needs running Postgres)
pnpm db:generate
pnpm db:push

# Run the web app
pnpm dev
```

Open http://localhost:3000

---

## Status

- [x] Repository created
- [x] Phase 0 – Project bootstrap
- [x] Phase 1 – Prisma schema + Next.js UI scaffold
- [ ] Phase 1 – Auth + Session API
- [ ] Phase 2 – Agent Core
- [ ] Phase 3 – Tools
- [ ] Phase 4 – Memory & Polish

---

Built with a focus on **shipping a real, usable agent system** instead of an over-engineered prototype.
