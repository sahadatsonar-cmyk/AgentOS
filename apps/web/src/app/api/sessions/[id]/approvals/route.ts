import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@agent-os/database';

type Params = { params: { id: string } };

const DecideSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
});

/**
 * GET /api/sessions/:id/approvals — pending + recent approvals
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const approvals = await prisma.approval.findMany({
      where: { sessionId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ approvals });
  } catch (error) {
    console.error('[GET approvals]', error);
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }
}

/**
 * POST /api/sessions/:id/approvals — approve or reject
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { approvalId, decision } = parsed.data;

    const approval = await prisma.approval.findFirst({
      where: { id: approvalId, sessionId: params.id },
    });

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: `Approval already ${approval.status}` },
        { status: 400 },
      );
    }

    const updated = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedBy: 'demo-user',
      },
    });

    await prisma.executionLog.create({
      data: {
        sessionId: params.id,
        level: 'info',
        message: `[security] approval ${decision}: ${approval.action}`,
        metadata: {
          approvalId,
          riskLevel: approval.riskLevel,
          decision,
        },
      },
    });

    await prisma.agentEvent.create({
      data: {
        sessionId: params.id,
        type: 'status',
        data: {
          status: decision === 'approved' ? 'executing' : 'cancelled',
          message: `Approval ${decision} for ${approval.action}`,
          approvalId,
        },
      },
    });

    return NextResponse.json({ approval: updated });
  } catch (error) {
    console.error('[POST approvals]', error);
    return NextResponse.json({ error: 'Failed to decide approval' }, { status: 500 });
  }
}
