import type { Plan } from '@agent-os/shared';
import type { AgentSession } from './types';

/**
 * Planner turns a user goal into an ordered list of tasks with dependencies.
 * In V1 we keep it simple. Later we can add LLM-powered planning.
 */
export interface Planner {
  createPlan(goal: string, context?: Partial<AgentSession>): Promise<Plan>;
}

/**
 * Stub planner for early development / tests.
 * Real implementation will call the LLM Router.
 */
export class StubPlanner implements Planner {
  async createPlan(goal: string): Promise<Plan> {
    return {
      goal,
      tasks: [
        {
          id: 'T1',
          title: 'Analyze requirements',
          description: `Understand the goal: ${goal}`,
          dependencies: [],
          tools: [],
        },
        {
          id: 'T2',
          title: 'Execute main work',
          description: 'Perform the core actions needed to achieve the goal',
          dependencies: ['T1'],
          tools: [],
        },
        {
          id: 'T3',
          title: 'Verify result',
          description: 'Check that the goal has been achieved',
          dependencies: ['T2'],
          tools: [],
        },
      ],
    };
  }
}
