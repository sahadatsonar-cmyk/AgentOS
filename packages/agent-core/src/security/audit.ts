export type AuditLevel = 'info' | 'warn' | 'error';

export type AuditEntry = {
  sessionId: string;
  level: AuditLevel;
  message: string;
  metadata?: Record<string, unknown>;
};

/**
 * Build a consistent audit message for tool / approval actions.
 */
export function formatAuditMessage(
  action: string,
  detail?: string,
): string {
  return detail ? `[security] ${action}: ${detail}` : `[security] ${action}`;
}
