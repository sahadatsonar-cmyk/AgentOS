import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@agent-os/database';
import {
  HeuristicPlanner,
  createDefaultToolRegistry,
  generateFinalAnswer,
  decideRetry,
  verifyOutcome,
  suggestReplan,
  sleep,
  toolNeedsApproval,
  getToolSecurity,
  formatAuditMessage,
} from '@agent-os/agent-core';
import { clientIp, rateLimit } from '@/lib/rate-limit';

type Params = { params: { id: string } };

const toolRegistry = createDefaultToolRegistry();
const MAX_TOOL_RETRIES = 2;

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

async function ensureToolApproved(opts: {
  sessionId: string;
  toolName: string;
  input: Record<string, unknown>;
}): Promise<{ allowed: boolean; reason?: string }> {
  if (!toolNeedsApproval(opts.toolName)) {
    return { allowed: true };
  }

  const profile = getToolSecurity(opts.toolName);

  // Look for an existing approved approval for this action
  const approved = await prisma.approval.findFirst({
    where: {
      sessionId: opts.sessionId,
      action: opts.toolName,
      status: 'approved',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (approved) {
    return { allowed: true };
  }

  // Create pending approval if none
  const existingPending = await prisma.approval.findFirst({
    where: {
      sessionId: opts.sessionId,
      action: opts.toolName,
      status: 'pending',
    },
  });

  if (!existingPending) {
    await prisma.approval.create({
      data: {
        sessionId: opts.sessionId,
        action: opts.toolName,
        riskLevel: profile.riskLevel,
        explanation: `${profile.description}. Input: ${JSON.stringify(opts.input).slice(0, 200)}`,
        status: 'pending',
      },
    });
  }

  await prisma.executionLog.create({
    data: {
      sessionId: opts.sessionId,
      level: 'warn',
      message: formatAuditMessage('approval_required', opts.toolName),
      metadata: toJson({ tool: opts.toolName, risk: profile.riskLevel }),
    },
  });

  await prisma.agentEvent.create({
    data: {
      sessionId: opts.sessionId,
      type: 'status',
      data: toJson({
        status: 'awaiting_approval',
        message: `Approval required for high-risk tool: ${opts.toolName}`,
        tool: opts.toolName,
      }),
    },
  });

  return {
    allowed: false,
    reason: `Approval required for ${opts.toolName}. POST /api/sessions/${opts.sessionId}/approvals with decision=approved.`,
  };
}

async function executeToolWithRetry(opts: {
  sessionId: string;
  taskId: string;
  toolName: string;
  input: Record<string, unknown>;
}): Promise<{ ok: boolean; data?: unknown; error?: string; durationMs: number; attempts: number }> {
  const gate = await ensureToolApproved({
    sessionId: opts.sessionId,
    toolName: opts.toolName,
    input: opts.input,
  });

  if (!gate.allowed) {
    return {
      ok: false,
      error: gate.reason,
      durationMs: 0,
      attempts: 0,
    };
  }

  let attempt = 0;
  let lastError: string | undefined;
  let lastDuration = 0;

  while (attempt <= MAX_TOOL_RETRIES) {
    const toolResult = await toolRegistry.execute(opts.toolName, opts.input, {
      sessionId: opts.sessionId,
      taskId: opts.taskId,
    });

    lastDuration = toolResult.durationMs;

    await prisma.toolCall.create({
      data: {
        sessionId: opts.sessionId,
        taskId: opts.taskId,
        toolName: opts.toolName,
        input: toJson(opts.input),
        status: toolResult.ok ? 'completed' : 'failed',
        output: toolResult.ok ? toJson(toolResult.data) : undefined,
        error: toolResult.error ?? null,
        durationMs: toolResult.durationMs,
      },
    });

    await prisma.executionLog.create({
      data: {
        sessionId: opts.sessionId,
        level: toolResult.ok ? 'info' : 'warn',
        message: formatAuditMessage(
          toolResult.ok ? 'tool_ok' : 'tool_fail',
          `${opts.toolName} attempt ${attempt + 1}`,
        ),
        metadata: toJson({
          tool: opts.toolName,
          ok: toolResult.ok,
          durationMs: toolResult.durationMs,
        }),
      },
    });

    await prisma.agentEvent.create({
      data: {
        sessionId: opts.sessionId,
        type: 'tool_call',
        data: toJson({
          tool: opts.toolName,
          input: opts.input,
          attempt: attempt + 1,
        }),
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId: opts.sessionId,
        type: 'tool_result',
        data: toJson({
          tool: opts.toolName,
          ok: toolResult.ok,
          attempt: attempt + 1,
          durationMs: toolResult.durationMs,
          preview: toolResult.ok
            ? JSON.stringify(toolResult.data).slice(0, 400)
            : toolResult.error,
        }),
      },
    });

    if (toolResult.ok) {
      return {
        ok: true,
        data: toolResult.data,
        durationMs: toolResult.durationMs,
        attempts: attempt + 1,
      };
    }

    lastError = toolResult.error;
    const decision = decideRetry({
      retryCount: attempt,
      maxRetries: MAX_TOOL_RETRIES,
      error: toolResult.error,
      toolName: opts.toolName,
    });

    await prisma.agentEvent.create({
      data: {
        sessionId: opts.sessionId,
        type: 'retry',
        data: toJson({
          tool: opts.toolName,
          decision,
          attempt: attempt + 1,
        }),
      },
    });

    if (decision.action !== 'retry') {
      return {
        ok: false,
        error: decision.reason,
        durationMs: lastDuration,
        attempts: attempt + 1,
      };
    }

    await sleep(decision.delayMs);
    attempt += 1;
  }

  return {
    ok: false,
    error: lastError || 'Exhausted retries',
    durationMs: lastDuration,
    attempts: attempt,
  };
}

/**
 * POST /api/sessions/:id/run
 * Phase 7: + permissions / approval gate / audit logs
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sessionId = params.id;

  try {
    const ip = clientIp(req);
    const rl = rateLimit({
      key: `run:${ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for agent runs' },
        { status: 429 },
      );
    }

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

    if (['planning', 'executing', 'analyzing', 'awaiting_approval'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Session is already running or awaiting approval' },
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

    await prisma.executionLog.create({
      data: {
        sessionId,
        level: 'info',
        message: formatAuditMessage('run_started', session.goal.slice(0, 80)),
        metadata: toJson({ ip }),
      },
    });

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
        maxRetries: MAX_TOOL_RETRIES,
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
    const failedTools: string[] = [];
    let failedTaskCount = 0;
    let blockedOnApproval = false;

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
        attempts?: number;
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
          failedTools.push(toolName);
          continue;
        }

        const toolResult = await executeToolWithRetry({
          sessionId,
          taskId: task.id,
          toolName: resolvedToolName,
          input,
        });

        toolResults.push({
          tool: resolvedToolName,
          ok: toolResult.ok,
          data: toolResult.data,
          error: toolResult.error,
          durationMs: toolResult.durationMs,
          attempts: toolResult.attempts,
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
        } else {
          failedTools.push(resolvedToolName);
          if (toolResult.error?.includes('Approval required')) {
            blockedOnApproval = true;
          }
          await prisma.task.update({
            where: { id: task.id },
            data: { retryCount: { increment: toolResult.attempts || 1 } },
          });
        }
      }

      const taskFailed = toolResults.some((r) => !r.ok);
      if (taskFailed) failedTaskCount += 1;

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

    if (blockedOnApproval) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'awaiting_approval' },
      });

      const updated = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          tasks: { orderBy: { sortOrder: 'asc' } },
          events: { orderBy: { createdAt: 'desc' }, take: 100 },
          approvals: { where: { status: 'pending' } },
        },
      });

      return NextResponse.json({
        session: updated,
        message: 'Paused for approval of high-risk tool(s). Approve then re-run.',
      });
    }

    // verification
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'verifying' },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({ status: 'verifying', message: 'Verifying outcome…' }),
      },
    });

    const verification = verifyOutcome({
      goal: session.goal,
      answers: answerParts,
      toolSummaries,
      failedTaskCount,
      totalTasks: dbTasks.length,
    });

    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({
          status: 'verifying',
          message: verification.ok ? 'Verification passed' : 'Verification weak',
          verification,
        }),
      },
    });

    const replan = suggestReplan({
      goal: session.goal,
      failedTools: [...new Set(failedTools)],
      verify: verification,
    });

    if (replan.shouldReplan) {
      await prisma.agentEvent.create({
        data: {
          sessionId,
          type: 'status',
          data: toJson({
            status: 'retrying',
            message: `Recovery hint: ${replan.hint}`,
            replan,
          }),
        },
      });

      if (
        failedTools.includes('calculator') ||
        (/(calculat|[0-9]+\s*[+\-*/])/i.test(session.goal) &&
          !answerParts.some((a) => /\d/.test(a)))
      ) {
        const input = pickToolInput('calculator', session.goal, 'recovery', null);
        if (input) {
          const recovered = await executeToolWithRetry({
            sessionId,
            taskId: dbTasks[0]?.id || sessionId,
            toolName: 'calculator',
            input,
          });
          if (recovered.ok) {
            toolOutputs.push({
              taskId: 'recovery',
              tool: 'calculator',
              result: recovered.data,
            });
            toolSummaries.push(toolSummaryLine('calculator', recovered.data));
            const preview = extractAnswerPreview('calculator', recovered.data);
            if (preview) answerParts.push(preview);
          }
        }
      }
    }

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
      verification,
      recovery: replan,
      goal: session.goal,
      answers: answerParts,
      taskCount: dbTasks.length,
      failedTaskCount,
      tasks: dbTasks.map((t) => t.title),
      toolOutputs: toolOutputs.map((o) => ({
        taskId: o.taskId,
        tool: o.tool,
        preview: JSON.stringify(o.result).slice(0, 400),
      })),
      availableTools: toolRegistry.names(),
    };

    await prisma.memory.create({
      data: {
        userId: session.userId,
        sessionId,
        type: 'episodic',
        content: finalAnswer.text.slice(0, 4000),
        importance: verification.ok ? 0.7 : 0.4,
        metadata: toJson({
          goal: session.goal,
          answerSource: finalAnswer.source,
          verification,
          taskCount: dbTasks.length,
          toolsUsed: toolOutputs.map((o) => o.tool),
        }),
      },
    });

    await prisma.memory.create({
      data: {
        userId: session.userId,
        sessionId,
        type: 'working',
        content: `Goal: ${session.goal}\nAnswer: ${finalAnswer.text.slice(0, 500)}`,
        importance: 0.5,
        metadata: toJson({ kind: 'session_summary', verification }),
      },
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        result: toJson(finalResult),
      },
    });

    await prisma.executionLog.create({
      data: {
        sessionId,
        level: 'info',
        message: formatAuditMessage('run_completed', finalAnswer.source),
        metadata: toJson({ verification, failedTaskCount }),
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
          verification,
        }),
      },
    });
    await prisma.agentEvent.create({
      data: {
        sessionId,
        type: 'status',
        data: toJson({
          status: 'completed',
          message: `Agent finished (${finalAnswer.source}, verify=${verification.score.toFixed(2)})`,
        }),
      },
    });

    const updated = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tasks: { orderBy: { sortOrder: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
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
