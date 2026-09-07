'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type SessionItem = {
  id: string;
  goal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setSessions(data.sessions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
          Active and past agent sessions.
        </p>

        {loading && (
          <div className="mt-8 text-center text-muted-foreground">Loading…</div>
        )}

        {error && (
          <div className="mt-8 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            <p className="mt-1 text-xs opacity-80">
              Make sure PostgreSQL is running and DATABASE_URL is set, then run{' '}
              <code className="rounded bg-muted px-1">pnpm db:push</code>
            </p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No sessions yet.</p>
            <Link
              href="/sessions/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Create your first agent task
            </Link>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="mt-8 space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="block rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()} ·{' '}
                      {s._count?.tasks ?? 0} tasks
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-slate-100 text-slate-700',
    analyzing: 'bg-blue-100 text-blue-700',
    planning: 'bg-indigo-100 text-indigo-700',
    executing: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-slate-100 text-slate-700'}`}
    >
      {status}
    </span>
  );
}
