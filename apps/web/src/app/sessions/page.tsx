'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

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
    <div className="min-h-screen">
      <SiteHeader />

      <main className="container mx-auto px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
            <p className="mt-2 text-muted-foreground">
              Active and past agent runs.
            </p>
          </div>
          <Link href="/sessions/new" className="btn-primary">
            New Task
          </Link>
        </div>

        {loading && (
          <div className="mt-12 text-center text-muted-foreground">Loading…</div>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="card-soft mt-10 border-dashed p-12 text-center">
            <p className="text-muted-foreground">No sessions yet.</p>
            <Link href="/sessions/new" className="btn-primary mt-6">
              Create your first task
            </Link>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="mt-8 space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="card-soft block p-4 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/10"
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
    executing: 'bg-amber-100 text-amber-800',
    verifying: 'bg-violet-100 text-violet-800',
    completed: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
    awaiting_approval: 'bg-orange-100 text-orange-800',
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-slate-100 text-slate-700'}`}
    >
      {status}
    </span>
  );
}
