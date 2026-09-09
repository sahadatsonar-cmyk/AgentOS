import type { Plan } from '@agent-os/shared';
import type { AgentSession } from './types';

/**
 * Planner turns a user goal into an ordered list of tasks with dependencies.
 */
export interface Planner {
  createPlan(goal: string, context?: Partial<AgentSession>): Promise<Plan>;
}

/**
 * Rule-based planner (no LLM required).
 * Creates a practical task breakdown from the goal text.
 * Later: LLMPlanner will call Grok/OpenAI when keys are present.
 */
export class HeuristicPlanner implements Planner {
  async createPlan(goal: string): Promise<Plan> {
    const g = goal.toLowerCase();
    const tasks: Plan['tasks'] = [];

    // Always start with understanding
    tasks.push({
      id: 'T1',
      title: 'Clarify goal and success criteria',
      description: `Break down: "${truncate(goal, 120)}". Define what a good result looks like.`,
      dependencies: [],
      tools: [],
    });

    // Research-style goals
    if (/(research|summar|compare|list|find|search|what is|benefits|pros|cons)/i.test(g)) {
      tasks.push({
        id: 'T2',
        title: 'Gather key facts and points',
        description: 'Collect the main points, benefits, drawbacks, or data relevant to the goal.',
        dependencies: ['T1'],
        tools: ['web_search'],
      });
      tasks.push({
        id: 'T3',
        title: 'Organize and structure findings',
        description: 'Group information into clear sections (overview, details, examples).',
        dependencies: ['T2'],
        tools: [],
      });
      tasks.push({
        id: 'T4',
        title: 'Write final summary',
        description: 'Produce a concise, useful answer the user can read immediately.',
        dependencies: ['T3'],
        tools: [],
      });
    }
    // Coding-style goals
    else if (/(code|implement|build|fix|bug|api|function|refactor|test)/i.test(g)) {
      tasks.push({
        id: 'T2',
        title: 'Design approach',
        description: 'Outline the steps, files, and constraints for the coding task.',
        dependencies: ['T1'],
        tools: [],
      });
      tasks.push({
        id: 'T3',
        title: 'Implement solution',
        description: 'Write or modify the code needed to achieve the goal.',
        dependencies: ['T2'],
        tools: ['code'],
      });
      tasks.push({
        id: 'T4',
        title: 'Verify and document',
        description: 'Check the result and note how to use or test it.',
        dependencies: ['T3'],
        tools: [],
      });
    }
    // Generic fallback
    else {
      tasks.push({
        id: 'T2',
        title: 'Break goal into actionable steps',
        description: 'List concrete sub-steps required to complete the goal.',
        dependencies: ['T1'],
        tools: [],
      });
      tasks.push({
        id: 'T3',
        title: 'Execute main work',
        description: 'Carry out the core actions needed to achieve the goal.',
        dependencies: ['T2'],
        tools: [],
      });
      tasks.push({
        id: 'T4',
        title: 'Verify outcome',
        description: 'Confirm the goal is met and prepare a short final report.',
        dependencies: ['T3'],
        tools: [],
      });
    }

    return { goal, tasks };
  }
}

/** @deprecated Use HeuristicPlanner */
export class StubPlanner extends HeuristicPlanner {}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
