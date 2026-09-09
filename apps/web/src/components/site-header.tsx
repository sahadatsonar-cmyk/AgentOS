import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/30 bg-white/60 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/30">
            A
          </div>
          <div className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">AgentOS</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
              Autonomous agents
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/sessions"
            className="rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-indigo-50 hover:text-foreground"
          >
            Sessions
          </Link>
          <Link
            href="/sessions/new"
            className="ml-1 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-md shadow-indigo-500/20 transition hover:bg-primary/90 sm:text-sm"
          >
            New Task
          </Link>
        </nav>
      </div>
    </header>
  );
}
