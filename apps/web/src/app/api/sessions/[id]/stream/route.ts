import { NextRequest } from 'next/server';
import { prisma } from '@agent-os/database';

type Params = { params: { id: string } };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/sessions/:id/stream
 * Server-Sent Events — polls AgentEvent rows and pushes to the client.
 * Works without Redis. Stops when session is terminal or client disconnects.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const sessionId = params.id;
  const encoder = new TextEncoder();

  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true },
      });

      if (!session) {
        send('error', { message: 'Session not found' });
        controller.close();
        return;
      }

      send('hello', { sessionId, status: session.status });

      let lastCreatedAt = new Date(0);
      let idleTicks = 0;
      const maxIdleTicks = 90; // ~90s of no new events after terminal → close

      const tick = async () => {
        if (closed) return;

        try {
          const events = await prisma.agentEvent.findMany({
            where: {
              sessionId,
              createdAt: { gt: lastCreatedAt },
            },
            orderBy: { createdAt: 'asc' },
            take: 50,
          });

          if (events.length > 0) {
            idleTicks = 0;
            for (const ev of events) {
              lastCreatedAt = ev.createdAt;
              send('agent_event', {
                id: ev.id,
                type: ev.type,
                data: ev.data,
                createdAt: ev.createdAt.toISOString(),
              });
            }
          } else {
            idleTicks += 1;
            send('ping', { t: Date.now() });
          }

          const current = await prisma.session.findUnique({
            where: { id: sessionId },
            select: {
              status: true,
              result: true,
              error: true,
              updatedAt: true,
            },
          });

          if (current) {
            send('session', {
              status: current.status,
              error: current.error,
              updatedAt: current.updatedAt.toISOString(),
              hasResult: current.result != null,
            });

            const terminal = ['completed', 'failed', 'cancelled'].includes(
              current.status,
            );
            if (terminal && idleTicks >= 3) {
              send('done', { status: current.status });
              closed = true;
              controller.close();
              return;
            }
          }

          if (idleTicks >= maxIdleTicks) {
            send('done', { status: 'timeout' });
            closed = true;
            controller.close();
            return;
          }
        } catch (err) {
          send('error', {
            message: err instanceof Error ? err.message : 'stream error',
          });
        }

        if (!closed) {
          setTimeout(tick, 1000);
        }
      };

      // Start polling
      setTimeout(tick, 200);

      req.signal.addEventListener('abort', () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
