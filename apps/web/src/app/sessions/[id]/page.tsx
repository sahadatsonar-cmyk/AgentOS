'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  retryCount: number;
  result?: unknown;
};

type AgentEvent = {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
};

type SessionDetail = {
  id: string;
  goal: string;
  status: string;
  plan: unknown;
  result: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  events: AgentEvent[];
};

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSession(data.session);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRun() {
    if (!session || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run agent');
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
      await load();
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? 'Session not found'}</p>
        <Link href="/sessions" className="text-sm underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  const canRun =
    !running &&
    (session.status === 'idle' || session.status === 'failed');

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
          <Link href="/sessions" className="text-sm text-muted-foreground hover:text-foreground">
            ← All sessions
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-snug">{session.goal}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {new Date(session.createdAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {(error || session.error) && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error || session.error}
          </div>
        )}

        {/* Run controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {running
              ? 'Running…'
              : session.status === 'completed'
                ? 'Completed'
                : 'Run Agent'}
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 text-sm font-medium"
          >
            Refresh
          </button>
          {running && (
            <span className="text-sm text-muted-foreground">Planning & executing tasks…</span>
          )}
        </div>

        {/* Tasks */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Tasks</h2>
          {session.tasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No tasks yet. Click <strong>Run Agent</strong> to create a plan.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {session.tasks.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-md border px-4 py-3"
                >
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.title}</p>
                    {t.description && (
                      <p className="text-sm text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Final result */}
        {session.result != null && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Result</h2>
            <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
              {JSON.stringify(session.result, null, 2)}
            </pre>
          </section>
        )}

        {/* Events */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Activity</h2>
          {session.events.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {session.events.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 rounded-md border px-4 py-2 text-sm"
                >
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="font-medium">{ev.type}</span>
                  <span className="break-all text-muted-foreground">
                    {typeof ev.data === 'object' && ev.data !== null
                      ? JSON.stringify(ev.data)
                      : String(ev.data)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-slate-100 text-slate-700',
    pending: 'bg-slate-100 text-slate-700',
    analyzing: 'bg-blue-100 text-blue-700',
    planning: 'bg-indigo-100 text-indigo-700',
    executing: 'bg-amber-100 text-amber-700',
    running: 'bg-amber-100 text-amber-700',
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
