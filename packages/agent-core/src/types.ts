import type { AgentStatus, AgentTask, Plan, AgentEvent } from '@agent-os/shared';

export interface AgentSession {
  id: string;
  userId: string;
  goal: string;
  status: AgentStatus;
  plan?: Plan;
  tasks: AgentTask[];
  currentTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentDecisionType =
  | 'PLAN'
  | 'TOOL_CALL'
  | 'ASK_USER'
  | 'VERIFY'
  | 'RETRY'
  | 'FINISH'
  | 'FAIL';

export interface AgentDecision {
  type: AgentDecisionType;
  payload?: unknown;
  reason?: string;
}

export interface AgentContext {
  session: AgentSession;
  recentEvents: AgentEvent[];
  availableTools: string[];
}
