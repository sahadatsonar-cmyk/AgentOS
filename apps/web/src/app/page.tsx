import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <SiteHeader />

      <main className="relative container mx-auto px-4 pb-20 pt-14 sm:pt-20">
        {/* Hero */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Phases 1–8 live · tools · memory · SSE · recovery
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-gradient">Autonomous agents</span>
            <br />
            <span className="text-foreground">that plan & deliver</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Give a natural-language goal. AgentOS understands, plans, picks tools,
            executes, verifies, recovers from errors, and asks for approval on
            high-risk actions.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sessions/new" className="btn-primary min-w-[160px]">
              Start a goal
            </Link>
            <Link href="/sessions" className="btn-secondary min-w-[160px]">
              View sessions
            </Link>
          </div>

          {/* Core loop */}
          <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-indigo-100/80 bg-white/60 p-4 shadow-sm backdrop-blur sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-600/80">
              Core loop
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium sm:text-sm">
              {['Understand', 'Plan', 'Execute', 'Observe', 'Verify', 'Done'].map(
                (step, i) => (
                  <span key={step} className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-indigo-800 ring-1 ring-indigo-100">
                      {step}
                    </span>
                    {i < 5 && (
                      <span className="text-indigo-300" aria-hidden>
                        →
                      </span>
                    )}
                  </span>
                ),
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              On error → recover → replan
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="⚡"
            title="Plan & execute"
            description="Heuristic planner breaks goals into tasks and assigns calculator, search, code, and GitHub tools."
          />
          <FeatureCard
            icon="🛡️"
            title="Verify & recover"
            description="Outcome scoring, retries with backoff, and recovery passes when results are weak."
          />
          <FeatureCard
            icon="🔐"
            title="Human approval"
            description="High-risk tools (shell, web_fetch) can require explicit approval before continuing."
          />
          <FeatureCard
            icon="📡"
            title="Live activity"
            description="SSE stream updates status while the agent runs — no manual refresh required."
          />
          <FeatureCard
            icon="🧠"
            title="Memory"
            description="Episodic and working memory stored per session for later retrieval and summaries."
          />
          <FeatureCard
            icon="🧰"
            title="Coding agent"
            description="Static code analysis, patch proposals, and GitHub read tools — sandbox-safe by design."
          />
        </div>

        {/* CTA band */}
        <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-xl shadow-indigo-500/25 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Try it on a real goal</h2>
              <p className="mt-2 max-w-md text-sm text-indigo-100">
                Math, research, or coding — create a session and hit Run Agent.
              </p>
            </div>
            <Link
              href="/sessions/new"
              className="inline-flex h-11 shrink-0 items-center rounded-xl bg-white px-6 text-sm font-semibold text-indigo-700 shadow transition hover:bg-indigo-50"
            >
              Create task
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative border-t border-white/40 bg-white/40 py-8 text-center text-xs text-muted-foreground backdrop-blur">
        AgentOS · modular · testable · production-oriented
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="card-soft transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/10">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg ring-1 ring-indigo-100">
        {icon}
      </div>
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
