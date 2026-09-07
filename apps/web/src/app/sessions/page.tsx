import Link from 'next/link';

export default function SessionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="text-xl font-semibold">AgentOS</span>
          </Link>
          <Link
            href="/sessions/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            New Task
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="mt-2 text-muted-foreground">
          Active and past agent sessions will appear here.
        </p>

        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No sessions yet.</p>
          <Link
            href="/sessions/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Create your first agent task
          </Link>
        </div>
      </main>
    </div>
  );
}
