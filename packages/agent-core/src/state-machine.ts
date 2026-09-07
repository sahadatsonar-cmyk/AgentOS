import type { AgentStatus } from '@agent-os/shared';

/**
 * Allowed transitions for the Agent state machine (V1).
 * Invalid transitions must be rejected.
 */
const ALLOWED_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  idle: ['analyzing', 'cancelled'],
  analyzing: ['planning', 'failed', 'cancelled'],
  planning: ['awaiting_approval', 'executing', 'failed', 'cancelled'],
  awaiting_approval: ['executing', 'cancelled', 'failed'],
  executing: ['observing', 'failed', 'retrying', 'cancelled'],
  observing: ['verifying', 'executing', 'failed', 'cancelled'],
  verifying: ['completed', 'retrying', 'failed', 'cancelled'],
  retrying: ['executing', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(
  current: AgentStatus,
  next: AgentStatus,
): AgentStatus {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid agent state transition: ${current} → ${next}`);
  }
  return next;
}

export function isTerminal(status: AgentStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
