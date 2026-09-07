# Deploy AgentOS to Vercel

## Why manual steps?

The Vercel API connector currently returns **403 Forbidden** (no team access).  
Until reconnect works, deploy from the Vercel Dashboard.

## Steps (5 minutes)

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. **Import** GitHub repo: `sahadatsonar-cmyk/AgentOS`
3. Configure project:

   | Setting            | Value                                      |
   |--------------------|--------------------------------------------|
   | Framework Preset   | Next.js                                    |
   | Root Directory     | `apps/web`                                 |
   | Install Command    | `cd ../.. && pnpm install`                 |
   | Build Command      | `cd ../.. && pnpm turbo run build --filter=@agent-os/web` |
   | Output Directory   | (leave default / `.next`)                  |

4. **Environment Variables** (Project → Settings → Environment Variables):

   | Name           | Value                                      | Notes |
   |----------------|--------------------------------------------|-------|
   | `DATABASE_URL` | `postgresql://...`                         | **Required** for sessions API. Use [Neon](https://neon.tech), Supabase, or Vercel Postgres. |
   | `NEXTAUTH_SECRET` | (optional for now)                      | Later for auth |

5. Click **Deploy**.

## Database (required for API)

Without `DATABASE_URL`, the UI will load but creating sessions will fail.

Recommended free options:
- [Neon](https://neon.tech) — serverless Postgres
- [Supabase](https://supabase.com) — Postgres + extras
- [Vercel Postgres](https://vercel.com/storage/postgres)

After setting `DATABASE_URL`:

```bash
# Local once to push schema
pnpm db:push
```

Or run Prisma migrate from CI / one-off script against the production DB.

## After deploy

- Production URL will look like: `https://agentos-xxx.vercel.app`
- Every push to `main` will auto-deploy (once Git is linked)

## Troubleshooting

| Error | Fix |
|-------|-----|
| Module not found `@agent-os/...` | Root Directory + install from monorepo root (see table above) |
| Prisma client not generated | Add build step: `pnpm --filter @agent-os/database db:generate && pnpm turbo run build --filter=@agent-os/web` |
| DB connection failed | Check `DATABASE_URL` and that the DB allows Vercel IPs (Neon/Supabase usually OK) |
