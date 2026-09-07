'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewSessionPage() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;

    setLoading(true);
    try {
      // TODO: POST /api/sessions
      // For now just navigate to a placeholder session
      console.log('Creating session with goal:', goal);
      router.push('/sessions');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="text-xl font-semibold">AgentOS</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">New Agent Task</h1>
        <p className="mt-2 text-muted-foreground">
          Describe what you want the agent to accomplish in natural language.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="goal" className="block text-sm font-medium">
              Goal
            </label>
            <textarea
              id="goal"
              rows={5}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Research the top 5 AI agent frameworks in 2026 and summarize their strengths..."
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !goal.trim()}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? 'Starting…' : 'Start Agent'}
            </button>
            <Link
              href="/sessions"
              className="inline-flex h-10 items-center justify-center rounded-md border border-input px-6 text-sm font-medium"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
