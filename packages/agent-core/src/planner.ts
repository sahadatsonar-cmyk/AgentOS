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
 */
export class HeuristicPlanner implements Planner {
  async createPlan(goal: string): Promise<Plan> {
    const g = goal.toLowerCase();
    const tasks: Plan['tasks'] = [];

    const hasMathExpr = /[0-9]+\s*[+\-*/×÷%]\s*[0-9]+/.test(goal);
    const isMathGoal =
      hasMathExpr ||
      /(calculat|compute|math|evaluate|what is\s+[0-9]|\d+\s*\+\s*\d+)/i.test(g);

    if (isMathGoal) {
      tasks.push({
        id: 'T1',
        title: 'Parse math expression',
        description: `Extract expression from: "${truncate(goal, 120)}"`,
        dependencies: [],
        tools: [],
      });
      tasks.push({
        id: 'T2',
        title: 'Calculate result',
        description: 'Evaluate the math expression using the calculator tool.',
        dependencies: ['T1'],
        tools: ['calculator'],
      });
      tasks.push({
        id: 'T3',
        title: 'Report answer',
        description: 'Return the numeric result clearly.',
        dependencies: ['T2'],
        tools: [],
      });
      return { goal, tasks };
    }

    tasks.push({
      id: 'T1',
      title: 'Clarify goal and success criteria',
      description: `Break down: "${truncate(goal, 120)}". Define what a good result looks like.`,
      dependencies: [],
      tools: [],
    });

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
    } else if (/(time|date|timezone|clock|now|today|utc)/i.test(g)) {
      tasks.push({
        id: 'T2',
        title: 'Get current date/time',
        description: 'Use datetime tool to get current time.',
        dependencies: ['T1'],
        tools: ['datetime'],
      });
      tasks.push({
        id: 'T3',
        title: 'Report time',
        description: 'Present the time clearly to the user.',
        dependencies: ['T2'],
        tools: [],
      });
    } else if (/https?:\/\//i.test(goal) || /(fetch|scrape|download page|read url)/i.test(g)) {
      tasks.push({
        id: 'T2',
        title: 'Fetch URL content',
        description: 'Download content from the given URL.',
        dependencies: ['T1'],
        tools: ['web_fetch'],
      });
      tasks.push({
        id: 'T3',
        title: 'Extract useful information',
        description: 'Summarize or extract the relevant parts of the page.',
        dependencies: ['T2'],
        tools: [],
      });
    } else if (
      /(code|implement|build|fix|bug|api|function|refactor|test|github|repo|pull request|pr\b)/i.test(
        g,
      )
    ) {
      tasks.push({
        id: 'T2',
        title: 'Inspect repository context',
        description:
          'List relevant paths or read key files (GitHub tools if token configured).',
        dependencies: ['T1'],
        tools: ['github_list_dir'],
      });
      tasks.push({
        id: 'T3',
        title: 'Analyze code / design approach',
        description: 'Static analysis and implementation plan for the coding goal.',
        dependencies: ['T2'],
        tools: ['code_analyze', 'propose_patch'],
      });
      tasks.push({
        id: 'T4',
        title: 'Verify and document',
        description:
          'Summarize findings, proposed patch, and next steps (tests, PR). Shell is sandboxed.',
        dependencies: ['T3'],
        tools: ['shell'],
      });
    } else {
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
