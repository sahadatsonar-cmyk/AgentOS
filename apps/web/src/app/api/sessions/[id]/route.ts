import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@agent-os/database';

type Params = { params: { id: string } };

/**
 * GET /api/sessions/:id
 * Fetch a single session with tasks and recent events.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        tasks: {
          orderBy: { sortOrder: 'asc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        toolCalls: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        approvals: {
          where: { status: 'pending' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('[GET /api/sessions/:id]', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 },
    );
  }
}
