import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@agent-os/database';

const CreateSessionSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(4000),
});

/**
 * GET /api/sessions
 * List recent sessions (newest first).
 * V1: no auth yet — returns all sessions. Auth will scope by userId later.
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
      { error: 'Failed to list sessions' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sessions
 * Create a new agent session from a natural-language goal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { goal } = parsed.data;

    // V1: ensure a demo user exists (auth comes later)
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

    // Log initial event
    await prisma.agentEvent.create({
      data: {
        sessionId: session.id,
        type: 'status',
        data: { status: 'idle', message: 'Session created' },
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/sessions]', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    );
  }
}
