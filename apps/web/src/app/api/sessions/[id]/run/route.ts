import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@agent-os/database';
import { HeuristicPlanner } from '@agent-os/agent-core';

type Params = { params: { id: string } };

/**
 * POST /api/sessions/:id/run
 * Phase 2: create a plan, write tasks to DB, advance status.
 * V1 execution is sequential stub (tasks marked completed after plan).
 * Real tool execution comes in Phase 3.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const sessionId = params.id;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { tasks: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return NextResponse.json(
        { error: `Session already ${session.status}` },
        { status: 400 },
      );
    }

    // Already has a plan — re-run not supported yet
    if (session.tasks.length > 0 && session.status !== 'idle' && session.status !== 'failed') {
      return NextResponse.json(
        { error: 'Session already has a plan. Re-run will be added later.' },
        { status: 400 },
      );
    }

    // ── planning ──────────────────────────────────────────────
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'planning' },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: { status: 'planning', message: 'Creating plan…' },
      },
    });

    const planner = new HeuristicPlanner();
    const plan = await planner.createPlan(session.goal);

    // Clear any previous failed tasks
    if (session.tasks.length > 0) {
      await prisma.task.deleteMany({ where: { sessionId } });
    }

    // Persist tasks
    await prisma.task.createMany({
      data: plan.tasks.map((t, index) => ({
        sessionId,
        title: t.title,
        description: t.description ?? null,
        status: 'pending',
        tools: t.tools ?? [],
        sortOrder: index,
      })),
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'executing',
        plan: plan as object,
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: {
          status: 'executing',
          message: `Plan ready with ${plan.tasks.length} tasks`,
          taskCount: plan.tasks.length,
        },
      },
    });

    // ── execute (Phase 2 stub: mark each task completed) ──────
    const dbTasks = await prisma.task.findMany({
      where: { sessionId },
      orderBy: { sortOrder: 'asc' },
    });

    for (const task of dbTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'running' },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'task_started',
          data: { taskId: task.id, title: task.title },
        },
      });

      // Stub result until real tools (Phase 3)
      const result = {
        note: 'Phase 2 stub execution',
        summary: `Completed step: ${task.title}`,
        goal: session.goal,
      };

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          result,
        },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'task_completed',
          data: { taskId: task.id, title: task.title },
        },
      });
    }

    // ── done ──────────────────────────────────────────────────
    const finalResult = {
      message: 'Plan executed (stub). Real tools land in Phase 3.',
      goal: session.goal,
      taskCount: dbTasks.length,
      tasks: dbTasks.map((t) => t.title),
    };

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        result: finalResult,
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'final_result',
        data: finalResult,
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: { status: 'completed', message: 'Agent finished' },
      },
    });

    const updated = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tasks: { orderBy: { sortOrder: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error('[POST /api/sessions/:id/run]', error);

    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Run failed',
        },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'error',
          data: {
            message: error instanceof Error ? error.message : 'Run failed',
          },
        },
      });
    } catch {
      // ignore secondary errors
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message.slice(0, 300) : 'Failed to run agent',
      },
      { status: 500 },
    );
  }
}
