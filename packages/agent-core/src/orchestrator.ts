import type { AgentStatus } from '@agent-os/shared';
import { isTerminal, transition } from './state-machine';
import type { AgentSession, AgentDecision, AgentContext } from './types';
import type { Planner } from './planner';

export interface OrchestratorDeps {
  planner: Planner;
  // Later: toolManager, llm, memory, eventBus, etc.
}

/**
 * Core agent loop.
 * V1: sequential, single-session, in-process.
 * Later: can be moved to a worker process.
 */
export class AgentOrchestrator {
  constructor(private deps: OrchestratorDeps) {}

  async run(session: AgentSession): Promise<AgentSession> {
    let current = { ...session };

    while (!isTerminal(current.status)) {
      const context = this.buildContext(current);
      const decision = await this.decide(context);

      current = await this.applyDecision(current, decision);
    }

    return current;
  }

  private buildContext(session: AgentSession): AgentContext {
    return {
      session,
      recentEvents: [],
      availableTools: [],
    };
  }

  /**
   * Very simple decision logic for bootstrap.
   * Real version will use LLM + tools + memory.
   */
  private async decide(context: AgentContext): Promise<AgentDecision> {
    const { status } = context.session;

    switch (status) {
      case 'idle':
      case 'analyzing':
        return { type: 'PLAN', reason: 'Need a plan for the goal' };

      case 'planning':
        return { type: 'FINISH', reason: 'Plan created (stub)' };

      default:
        return { type: 'FAIL', reason: `Unhandled status: ${status}` };
    }
  }

  private async applyDecision(
    session: AgentSession,
    decision: AgentDecision,
  ): Promise<AgentSession> {
    const next = { ...session, updatedAt: new Date() };

    switch (decision.type) {
      case 'PLAN': {
        next.status = transition(session.status, 'planning');
        const plan = await this.deps.planner.createPlan(session.goal, session);
        next.plan = plan;
        // In real version we would also create Task records
        next.status = transition(next.status, 'executing');
        break;
      }

      case 'FINISH': {
        next.status = transition(session.status, 'completed');
        break;
      }

      case 'FAIL': {
        next.status = transition(session.status, 'failed');
        break;
      }

      default:
        next.status = transition(session.status, 'failed');
    }

    return next;
  }
}
