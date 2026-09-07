import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="text-xl font-semibold">AgentOS</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/sessions" className="text-muted-foreground hover:text-foreground">
              Sessions
            </Link>
            <Link href="/approvals" className="text-muted-foreground hover:text-foreground">
              Approvals
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Autonomous AI Agent Platform
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Give a natural-language goal. AgentOS plans, executes tools, verifies,
            recovers from errors, and asks for approval when needed.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sessions/new"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              New Agent Task
            </Link>
            <Link
              href="/sessions"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              View Sessions
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Plan & Execute"
            description="Breaks goals into dependent tasks, selects tools, and runs them safely."
          />
          <FeatureCard
            title="Verify & Recover"
            description="Checks results, retries with limits, and asks you when stuck."
          />
          <FeatureCard
            title="Human Approval"
            description="High-risk actions require your explicit approval before continuing."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
