import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@agent-os/database';
import { HeuristicPlanner, createDefaultToolRegistry } from '@agent-os/agent-core';

type Params = { params: { id: string } };

const toolRegistry = createDefaultToolRegistry();

function pickToolInput(
  toolName: string,
  goal: string,
  taskTitle: string,
  taskDescription: string | null,
): unknown {
  const text = `${goal}\n${taskTitle}\n${taskDescription || ''}`;

  switch (toolName) {
    case 'web_search':
      return { query: goal.slice(0, 300), maxResults: 5 };

    case 'web_fetch': {
      const urlMatch = text.match(/https?:\/\/[^\s"']+/i);
      if (urlMatch) {
        return { url: urlMatch[0], maxBytes: 80_000 };
      }
      // Fallback: search instead if no URL in goal
      return null;
    }

    case 'calculator': {
      const exprMatch = text.match(
        /(?:calculate|compute|math)?\s*([0-9()+\-*/.\s%]{3,})/i,
      );
      if (exprMatch) {
        return { expression: exprMatch[1].trim() };
      }
      return null;
    }

    case 'datetime':
      return { timezone: 'UTC' };

    default:
      return {};
  }
}

/**
 * POST /api/sessions/:id/run
 * Phase 3: plan + execute with real tools when assigned.
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

    if (session.tasks.length > 0) {
      await prisma.task.deleteMany({ where: { sessionId } });
    }

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
          availableTools: toolRegistry.names(),
        },
      },
    });

    // ── execute with tools ────────────────────────────────────
    const dbTasks = await prisma.task.findMany({
      where: { sessionId },
      orderBy: { sortOrder: 'asc' },
    });

    const toolOutputs: Array<{ taskId: string; tool: string; result: unknown }> = [];

    for (const task of dbTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'running' },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'task_started',
          data: { taskId: task.id, title: task.title, tools: task.tools },
        },
      });

      const toolResults: Array<{ tool: string; ok: boolean; data?: unknown; error?: string; durationMs: number }> =
        [];

      for (const toolName of task.tools) {
        let input = pickToolInput(toolName, session.goal, task.title, task.description);

        // If web_fetch had no URL, fall back to web_search
        if (toolName === 'web_fetch' && input === null) {
          input = pickToolInput('web_search', session.goal, task.title, task.description);
          const searchResult = await toolRegistry.execute('web_search', input, {
            sessionId,
            taskId: task.id,
          });

          const toolCall = await prisma.toolCall.create({
            data: {
              sessionId,
              taskId: task.id,
              toolName: 'web_search',
              input: (input ?? {}) as object,
              status: searchResult.ok ? 'completed' : 'failed',
              output: searchResult.ok ? (searchResult.data as object) : undefined,
              error: searchResult.error,
              durationMs: searchResult.durationMs,
            },
          });

          await prisma.agentEvent.create({
            data: {
              sessionId,
              type: 'tool_call',
              data: { toolCallId: toolCall.id, tool: 'web_search', input },
            },
          });
          await prisma.agentEvent.create({
            data: {
              sessionId,
              type: 'tool_result',
              data: {
                toolCallId: toolCall.id,
                tool: 'web_search',
                ok: searchResult.ok,
                durationMs: searchResult.durationMs,
              },
            },
          });

          toolResults.push({
            tool: 'web_search',
            ok: searchResult.ok,
            data: searchResult.data,
            error: searchResult.error,
            durationMs: searchResult.durationMs,
          });
          if (searchResult.ok) {
            toolOutputs.push({ taskId: task.id, tool: 'web_search', result: searchResult.data });
          }
          continue;
        }

        if (input === null) {
          toolResults.push({
            tool: toolName,
            ok: false,
            error: `Could not derive input for tool ${toolName} from goal/task`,
            durationMs: 0,
          });
          continue;
        }

        const toolResult = await toolRegistry.execute(toolName, input, {
          sessionId,
          taskId: task.id,
        });

        const toolCall = await prisma.toolCall.create({
          data: {
            sessionId,
            taskId: task.id,
            toolName,
            input: (input ?? {}) as object,
            status: toolResult.ok ? 'completed' : 'failed',
            output: toolResult.ok ? (toolResult.data as object) : undefined,
            error: toolResult.error,
            durationMs: toolResult.durationMs,
          },
        });

        await prisma.agentEvent.create({
          data: {
            sessionId,
            type: 'tool_call',
            data: { toolCallId: toolCall.id, tool: toolName, input },
          },
        });
        await prisma.agentEvent.create({
          data: {
            sessionId,
            type: 'tool_result',
            data: {
              toolCallId: toolCall.id,
              tool: toolName,
              ok: toolResult.ok,
              durationMs: toolResult.durationMs,
              preview: toolResult.ok
                ? JSON.stringify(toolResult.data).slice(0, 500)
                : toolResult.error,
            },
          },
        });

        toolResults.push({
          tool: toolName,
          ok: toolResult.ok,
          data: toolResult.data,
          error: toolResult.error,
          durationMs: toolResult.durationMs,
        });

        if (toolResult.ok) {
          toolOutputs.push({ taskId: task.id, tool: toolName, result: toolResult.data });
        }
      }

      // If no tools on task, still produce a structured note
      const result =
        toolResults.length > 0
          ? { tools: toolResults }
          : {
              note: 'No tools assigned; reasoning-only step',
              summary: `Completed step: ${task.title}`,
            };

      const taskFailed = toolResults.some((r) => !r.ok);

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: taskFailed ? 'failed' : 'completed',
          result,
          error: taskFailed
            ? toolResults
                .filter((r) => !r.ok)
                .map((r) => `${r.tool}: ${r.error}`)
                .join('; ')
            : null,
        },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'task_completed',
          data: {
            taskId: task.id,
            title: task.title,
            ok: !taskFailed,
            toolsUsed: toolResults.map((r) => r.tool),
          },
        },
      });
    }

    const finalResult = {
      message: 'Plan executed with Phase 3 tools where assigned.',
      goal: session.goal,
      taskCount: dbTasks.length,
      tasks: dbTasks.map((t) => t.title),
      toolOutputs: toolOutputs.map((o) => ({
        taskId: o.taskId,
        tool: o.tool,
        preview: JSON.stringify(o.result).slice(0, 400),
      })),
      availableTools: toolRegistry.names(),
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
      // ignore
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
