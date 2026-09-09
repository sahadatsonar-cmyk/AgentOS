'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  retryCount: number;
  result?: unknown;
  error?: string | null;
  tools?: string[];
};

type AgentEvent = {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
};

type SessionResult = {
  message?: string;
  answers?: string[];
  answerSource?: string;
  goal?: string;
  taskCount?: number;
  tasks?: string[];
  toolOutputs?: Array<{ taskId: string; tool: string; preview: string }>;
  availableTools?: string[];
};

type SessionDetail = {
  id: string;
  goal: string;
  status: string;
  plan: unknown;
  result: SessionResult | null;
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
  const [live, setLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawResult, setShowRawResult] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const esRef = useRef<EventSource | null>(null);

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

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  function startLiveStream() {
    esRef.current?.close();
    const es = new EventSource(`/api/sessions/${id}/stream`);
    esRef.current = es;
    setLive(true);

    es.addEventListener('hello', () => {
      setLiveStatus('connected');
    });

    es.addEventListener('session', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          status?: string;
        };
        if (data.status) setLiveStatus(data.status);
      } catch {
        // ignore
      }
    });

    es.addEventListener('agent_event', () => {
      void load();
    });

    es.addEventListener('done', () => {
      setLive(false);
      setLiveStatus(null);
      es.close();
      esRef.current = null;
      void load();
    });

    es.onerror = () => {
      setLive(false);
      setLiveStatus(null);
      es.close();
      esRef.current = null;
    };
  }

  async function handleRun() {
    if (!session || running) return;
    setRunning(true);
    setError(null);
    startLiveStream();
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
      setTimeout(() => {
        void load();
      }, 800);
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
    ['idle', 'failed', 'completed'].includes(session.status);

  const runLabel = running
    ? 'Running…'
    : session.status === 'idle'
      ? 'Run Agent'
      : 'Re-run Agent';

  const result = session.result;
  const answers = result?.answers?.filter(Boolean) ?? [];
  const primaryMessage = result?.message;
  const events = showAllEvents ? session.events : session.events.slice(0, 12);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4">
          <Link href="/sessions" className="text-sm text-muted-foreground hover:text-foreground">
            ← All sessions
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">{session.goal}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {new Date(session.createdAt).toLocaleString()}
              {session.updatedAt !== session.createdAt && (
                <> · Updated {new Date(session.updatedAt).toLocaleString()}</>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={session.status} />
            {live && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                live{liveStatus ? ` · ${liveStatus}` : ''}
              </span>
            )}
          </div>
        </div>

        {(error || session.error) && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error || session.error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="btn-primary disabled:opacity-50"
          >
            {runLabel}
          </button>
          <button type="button" onClick={() => load()} className="btn-secondary">
            Refresh
          </button>
          <Link href="/sessions/new" className="btn-secondary">
            New Task
          </Link>
          {running && (
            <span className="animate-pulse text-sm text-muted-foreground">
              Planning & executing…
            </span>
          )}
        </div>

        {(primaryMessage || answers.length > 0) && session.status === 'completed' && (
          <section className="card-soft mt-8">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600/80">
                Answer
              </h2>
              {result?.answerSource && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  via {result.answerSource}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-3 text-base leading-relaxed">
              {primaryMessage ? (
                <p className="whitespace-pre-wrap">{primaryMessage}</p>
              ) : (
                answers.map((a, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {a}
                  </p>
                ))
              )}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
            <span className="text-xs text-muted-foreground">
              {session.tasks.filter((t) => t.status === 'completed').length}/
              {session.tasks.length} done
            </span>
          </div>
          {session.tasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No tasks yet. Click <strong>Run Agent</strong> to create a plan.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {session.tasks.map((t, i) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-border/80 bg-white/70 px-4 py-3 backdrop-blur"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{t.title}</p>
                        {t.tools && t.tools.length > 0 && (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-100">
                            {t.tools.join(', ')}
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                      )}
                      {t.error && (
                        <p className="mt-1 text-xs text-destructive">{t.error}</p>
                      )}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {result?.toolOutputs && result.toolOutputs.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">Tool outputs</h2>
            <ul className="mt-3 space-y-2">
              {result.toolOutputs.map((o, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border/80 bg-white/70 px-4 py-3 text-sm backdrop-blur"
                >
                  <span className="font-medium text-indigo-700">{o.tool}</span>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                    {o.preview}
                  </pre>
                </li>
              ))}
            </ul>
          </section>
        )}

        {session.result != null && (
          <section className="mt-8">
            <button
              type="button"
              onClick={() => setShowRawResult((v) => !v)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showRawResult ? '▾ Hide raw result' : '▸ Show raw result JSON'}
            </button>
            {showRawResult && (
              <pre className="mt-2 overflow-x-auto rounded-xl border bg-white/70 p-4 text-xs backdrop-blur">
                {JSON.stringify(session.result, null, 2)}
              </pre>
            )}
          </section>
        )}

        <section className="mt-10 pb-12">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
            {session.events.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllEvents((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showAllEvents ? 'Show less' : `Show all (${session.events.length})`}
              </button>
            )}
          </div>
          {session.events.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-white/60 px-3 py-2 text-sm backdrop-blur"
                >
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </span>
                  <EventTypeBadge type={ev.type} />
                  <span className="min-w-0 flex-1 break-all text-xs text-muted-foreground">
                    {formatEventData(ev.type, ev.data)}
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
    executing: 'bg-amber-100 text-amber-800',
    running: 'bg-amber-100 text-amber-800',
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

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    status: 'text-slate-700',
    tool_call: 'text-indigo-700',
    tool_result: 'text-violet-700',
    task_started: 'text-amber-700',
    task_completed: 'text-green-700',
    final_result: 'text-emerald-800',
    error: 'text-red-700',
    retry: 'text-orange-700',
  };
  return (
    <span className={`shrink-0 text-xs font-semibold ${colors[type] ?? 'text-foreground'}`}>
      {type}
    </span>
  );
}

function formatEventData(type: string, data: unknown): string {
  if (data == null) return '';
  if (typeof data !== 'object') return String(data);
  const d = data as Record<string, unknown>;
  if (type === 'status' && d.message) return String(d.message);
  if (type === 'task_started' && d.title) return String(d.title);
  if (type === 'task_completed' && d.title) {
    return `${d.title}${d.ok === false ? ' (failed)' : ''}`;
  }
  if (type === 'tool_call' && d.tool) return String(d.tool);
  if (type === 'tool_result') {
    const parts = [d.tool, d.ok === false ? 'failed' : 'ok', d.preview].filter(Boolean);
    return parts.map(String).join(' · ').slice(0, 200);
  }
  if (type === 'final_result' && d.message) return String(d.message).slice(0, 200);
  if (type === 'error' && d.message) return String(d.message);
  return JSON.stringify(data).slice(0, 180);
}
