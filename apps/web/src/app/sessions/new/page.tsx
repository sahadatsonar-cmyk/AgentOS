'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';

const EXAMPLES = [
  'Calculate 25 * 4 + 10',
  'Summarize the benefits of TypeScript',
  'What time is it in UTC?',
  'Analyze this code:\\n```ts\\nfunction add(a, b) { return a + b }\\n```',
];

export default function NewSessionPage() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      router.push(`/sessions/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="container mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">New Agent Task</h1>
        <p className="mt-2 text-muted-foreground">
          Describe what you want the agent to accomplish in natural language.
        </p>

        <form onSubmit={handleSubmit} className="card-soft mt-8 space-y-6">
          <div>
            <label htmlFor="goal" className="block text-sm font-medium">
              Goal
            </label>
            <textarea
              id="goal"
              rows={6}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Research the top AI agent frameworks and summarize their strengths…"
              className="mt-2 w-full rounded-xl border border-input bg-white/80 px-3 py-3 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              required
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setGoal(ex.replace(/\\n/g, '\n'))}
                className="rounded-full border border-indigo-100 bg-indigo-50/80 px-3 py-1 text-xs text-indigo-800 transition hover:bg-indigo-100"
              >
                {ex.split('\n')[0].slice(0, 42)}
                {ex.length > 42 ? '…' : ''}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || !goal.trim()}
              className="btn-primary"
            >
              {loading ? 'Creating…' : 'Start Agent'}
            </button>
            <Link href="/sessions" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
