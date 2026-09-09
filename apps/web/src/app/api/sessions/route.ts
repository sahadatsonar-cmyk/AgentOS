import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@agent-os/database';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const CreateSessionSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(4000),
});

function dbErrorMessage(error: unknown): string {
  if (!process.env.DATABASE_URL) {
    return 'DATABASE_URL is not set on the server. Add it in Vercel → Settings → Environment Variables.';
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Can't reach database") || msg.includes('P1001')) {
      return 'Cannot reach Supabase. Check DATABASE_URL (use pooler port 6543 with pgbouncer=true).';
    }
    if (msg.includes('P1000') || msg.includes('Authentication failed')) {
      return 'Database authentication failed. Check password in DATABASE_URL.';
    }
    if (msg.includes('P2021') || msg.includes('does not exist')) {
      return 'Tables missing. Run: npx prisma db push against Supabase.';
    }
    return msg.slice(0, 300);
  }
  return 'Failed to create session';
}

/**
 * GET /api/sessions
 */
export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        goal: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[GET /api/sessions]', error);
    return NextResponse.json(
      { error: dbErrorMessage(error) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sessions
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit({
      key: `create-session:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });

    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in a minute.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rl.resetAt),
          },
        },
      );
    }

    const body = await req.json();
    const parsed = CreateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { goal } = parsed.data;

    // Basic injection / abuse heuristics
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(goal)) {
      return NextResponse.json(
        { error: 'Goal contains invalid control characters' },
        { status: 400 },
      );
    }

    let user = await prisma.user.findFirst({
      where: { email: 'demo@agentos.local' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@agentos.local',
          name: 'Demo User',
        },
      });
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        goal,
        status: 'idle',
      },
      select: {
        id: true,
        goal: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.agentEvent.create({
      data: {
        sessionId: session.id,
        type: 'status',
        data: { status: 'idle', message: 'Session created' },
      },
    });

    await prisma.executionLog.create({
      data: {
        sessionId: session.id,
        level: 'info',
        message: '[audit] session created',
        metadata: { ip, goalLength: goal.length },
      },
    });

    return NextResponse.json(
      { session },
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      },
    );
  } catch (error) {
    console.error('[POST /api/sessions]', error);
    return NextResponse.json(
      { error: dbErrorMessage(error) },
      { status: 500 },
    );
  }
}
