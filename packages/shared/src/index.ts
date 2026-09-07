import { z } from 'zod';

// ─── Agent Status ───────────────────────────────────────────────
export const AgentStatusSchema = z.enum([
  'idle',
  'analyzing',
  'planning',
  'awaiting_approval',
  'executing',
  'observing',
  'verifying',
  'retrying',
  'completed',
  'failed',
  'cancelled',
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// ─── Task Status ────────────────────────────────────────────────
export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// ─── Priority ───────────────────────────────────────────────────
export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Priority = z.infer<typeof PrioritySchema>;

// ─── Permissions ────────────────────────────────────────────────
export const PermissionSchema = z.enum([
  'read',
  'write',
  'execute',
  'network',
  'database',
  'external_action',
]);
export type Permission = z.infer<typeof PermissionSchema>;

// ─── Risk Level ─────────────────────────────────────────────────
export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ─── Agent Task (core domain type) ──────────────────────────────
export const AgentTaskSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  title: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  priority: PrioritySchema.default('medium'),
  dependencies: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  verificationCriteria: z.array(z.string()).optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().nonnegative().default(3),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AgentTask = z.infer<typeof AgentTaskSchema>;

// ─── Tool Interface (contract) ──────────────────────────────────
export interface ToolContext {
  sessionId: string;
  userId: string;
  permissions: Permission[];
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  version: string;
  inputSchema: z.ZodType<TInput>;
  permissions: Permission[];
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

// ─── Approval ───────────────────────────────────────────────────
export const ApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  action: z.string(),
  riskLevel: RiskLevelSchema,
  explanation: z.string(),
  status: ApprovalStatusSchema,
  requestedAt: z.coerce.date(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ─── Agent Event (for live UI) ───────────────────────────────────
export const AgentEventTypeSchema = z.enum([
  'status',
  'thought_summary',
  'tool_call',
  'tool_result',
  'task_started',
  'task_completed',
  'error',
  'retry',
  'approval_required',
  'final_result',
]);
export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

export const AgentEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: AgentEventTypeSchema,
  data: z.unknown(),
  timestamp: z.coerce.date(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// ─── Plan ───────────────────────────────────────────────────────
export const PlanSchema = z.object({
  goal: z.string(),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      dependencies: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
    }),
  ),
});
export type Plan = z.infer<typeof PlanSchema>;
