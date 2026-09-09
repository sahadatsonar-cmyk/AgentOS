import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@agent-os/database';
import {
  HeuristicPlanner,
  createDefaultToolRegistry,
  generateFinalAnswer,
} from '@agent-os/agent-core';

type Params = { params: { id: string } };

const toolRegistry = createDefaultToolRegistry();

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function pickToolInput(
  toolName: string,
  goal: string,
  taskTitle: string,
  taskDescription: string | null,
): Record<string, unknown> | null {
  const text = `${goal}\n${taskTitle}\n${taskDescription || ''}`;

  switch (toolName) {
    case 'web_search':
      return { query: goal.slice(0, 300), maxResults: 5 };

    case 'web_fetch': {
      const urlMatch = text.match(/https?:\/\/[^\s"']+/i);
      if (urlMatch) {
        return { url: urlMatch[0], maxBytes: 80_000 };
      }
      return null;
    }

    case 'calculator': {
      const patterns = [
        /(?:calculate|compute|math|evaluate)\s*([0-9()\s+\-*/.%×÷]+)/i,
        /([0-9]+(?:\s*[+\-*/%×÷]\s*[0-9.]+)+)/,
        /([0-9()\s+\-*/.%]{3,})/,
      ];
      for (const re of patterns) {
        const m = goal.match(re) || text.match(re);
        if (m?.[1]) {
          const expression = m[1]
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .trim();
          if (/[0-9]/.test(expression) && /[+\-*/%]/.test(expression)) {
            return { expression };
          }
        }
      }
      return null;
    }

    case 'datetime':
      return { timezone: 'UTC' };

    default:
      return {};
  }
}

function extractAnswerPreview(toolName: string, data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (toolName === 'calculator' && typeof d.result === 'number') {
    return `Answer: ${d.result}`;
  }
  if (toolName === 'web_search') {
    if (typeof d.abstract === 'string' && d.abstract) return d.abstract.slice(0, 400);
    const results = d.results as Array<{ title?: string; snippet?: string }> | undefined;
    if (results?.[0]?.snippet) {
      const title = results[0].title ? `${results[0].title}: ` : '';
      return `${title}${results[0].snippet}`.slice(0, 400);
    }
  }
  if (toolName === 'datetime' && typeof d.localeString === 'string') {
    return d.localeString;
  }
  return null;
}

function toolSummaryLine(tool: string, data: unknown): string {
  const preview = extractAnswerPreview(tool, data);
  if (preview) return `[${tool}] ${preview}`;
  return `[${tool}] ${JSON.stringify(data).slice(0, 280)}`;
}

/**
 * POST /api/sessions/:id/run
 * Phase 4: plan + tools + LLM final answer + episodic memory.
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

    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Session was cancelled' }, { status: 400 });
    }

    if (['planning', 'executing', 'analyzing'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Session is already running' },
        { status: 409 },
      );
    }

    const isRerun = session.status === 'completed' || session.status === 'failed';

    if (isRerun) {
      await prisma.toolCall.deleteMany({ where: { sessionId } });
      await prisma.task.deleteMany({ where: { sessionId } });
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'idle',
          plan: Prisma.DbNull,
          result: Prisma.DbNull,
          error: null,
        },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'status',
          data: toJson({
            status: 'idle',
            message: 'Re-run requested — previous plan cleared',
          }),
        },
      });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'planning', error: null },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({ status: 'planning', message: 'Creating plan…' }),
      },
    });

    const planner = new HeuristicPlanner();
    const plan = await planner.createPlan(session.goal);

    await prisma.task.deleteMany({ where: { sessionId } });

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
        plan: toJson(plan),
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({
          status: 'executing',
          message: `Plan ready with ${plan.tasks.length} tasks`,
          taskCount: plan.tasks.length,
          availableTools: toolRegistry.names(),
        }),
      },
    });

    const dbTasks = await prisma.task.findMany({
      where: { sessionId },
      orderBy: { sortOrder: 'asc' },
    });

    const toolOutputs: Array<{ taskId: string; tool: string; result: unknown }> = [];
    const answerParts: string[] = [];
    const toolSummaries: string[] = [];

    for (const task of dbTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'running' },
      });
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'task_started',
          data: toJson({ taskId: task.id, title: task.title, tools: task.tools }),
        },
      });

      const toolResults: Array<{
        tool: string;
        ok: boolean;
        data?: unknown;
        error?: string;
        durationMs: number;
      }> = [];

      for (const toolName of task.tools) {
        let input = pickToolInput(toolName, session.goal, task.title, task.description);

        const resolvedToolName =
          toolName === 'web_fetch' && input === null ? 'web_search' : toolName;

        if (resolvedToolName !== toolName) {
          input = pickToolInput('web_search', session.goal, task.title, task.description);
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

        const toolResult = await toolRegistry.execute(resolvedToolName, input, {
          sessionId,
          taskId: task.id,
        });

        const toolCall = await prisma.toolCall.create({
          data: {
            sessionId,
            taskId: task.id,
            toolName: resolvedToolName,
            input: toJson(input),
            status: toolResult.ok ? 'completed' : 'failed',
            output: toolResult.ok ? toJson(toolResult.data) : undefined,
            error: toolResult.error ?? null,
            durationMs: toolResult.durationMs,
          },
        });

        await prisma.agentEvent.create({
          data: {
            sessionId,
            type: 'tool_call',
            data: toJson({
              toolCallId: toolCall.id,
              tool: resolvedToolName,
              input,
            }),
          },
        });
        await prisma.agentEvent.create({
          data: {
            sessionId,
            type: 'tool_result',
            data: toJson({
              toolCallId: toolCall.id,
              tool: resolvedToolName,
              ok: toolResult.ok,
              durationMs: toolResult.durationMs,
              preview: toolResult.ok
                ? JSON.stringify(toolResult.data).slice(0, 500)
                : toolResult.error,
            }),
          },
        });

        toolResults.push({
          tool: resolvedToolName,
          ok: toolResult.ok,
          data: toolResult.data,
          error: toolResult.error,
          durationMs: toolResult.durationMs,
        });

        if (toolResult.ok) {
          toolOutputs.push({
            taskId: task.id,
            tool: resolvedToolName,
            result: toolResult.data,
          });
          toolSummaries.push(toolSummaryLine(resolvedToolName, toolResult.data));
          const preview = extractAnswerPreview(resolvedToolName, toolResult.data);
          if (preview) answerParts.push(preview);
        }
      }

      const taskFailed = toolResults.some((r) => !r.ok);
      const result =
        toolResults.length > 0
          ? { tools: toolResults }
          : {
              note: 'No tools assigned; reasoning-only step',
              summary: `Completed step: ${task.title}`,
            };

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: taskFailed ? 'failed' : 'completed',
          result: toJson(result),
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
          data: toJson({
            taskId: task.id,
            title: task.title,
            ok: !taskFailed,
            toolsUsed: toolResults.map((r) => r.tool),
          }),
        },
      });
    }

    // ── Phase 4: final answer (LLM if key present) ─────────────
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({ status: 'verifying', message: 'Writing final answer…' }),
      },
    });

    const finalAnswer = await generateFinalAnswer({
      goal: session.goal,
      taskTitles: dbTasks.map((t) => t.title),
      toolSummaries,
      rawAnswers: answerParts,
    });

    const finalResult = {
      message: finalAnswer.text,
      answerSource: finalAnswer.source,
      llmProvider: finalAnswer.provider ?? null,
      llmModel: finalAnswer.model ?? null,
      goal: session.goal,
      answers: answerParts,
      taskCount: dbTasks.length,
      tasks: dbTasks.map((t) => t.title),
      toolOutputs: toolOutputs.map((o) => ({
        taskId: o.taskId,
        tool: o.tool,
        preview: JSON.stringify(o.result).slice(0, 400),
      })),
      availableTools: toolRegistry.names(),
    };

    // Episodic memory — store summary for later retrieval
    await prisma.memory.create({
      data: {
        userId: session.userId,
        sessionId,
        type: 'episodic',
        content: finalAnswer.text.slice(0, 4000),
        importance: 0.7,
        metadata: toJson({
          goal: session.goal,
          answerSource: finalAnswer.source,
          taskCount: dbTasks.length,
          toolsUsed: toolOutputs.map((o) => o.tool),
        }),
      },
    });

    // Working memory — short goal ↔ answer pair
    await prisma.memory.create({
      data: {
        userId: session.userId,
        sessionId,
        type: 'working',
        content: `Goal: ${session.goal}\nAnswer: ${finalAnswer.text.slice(0, 500)}`,
        importance: 0.5,
        metadata: toJson({ kind: 'session_summary' }),
      },
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        result: toJson(finalResult),
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'final_result',
        data: toJson({
          message: finalAnswer.text.slice(0, 500),
          source: finalAnswer.source,
          provider: finalAnswer.provider,
        }),
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({
          status: 'completed',
          message: `Agent finished (${finalAnswer.source})`,
        }),
      },
    });

    const updated = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tasks: { orderBy: { sortOrder: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 80 },
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
          data: toJson({
            message: error instanceof Error ? error.message : 'Run failed',
          }),
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
