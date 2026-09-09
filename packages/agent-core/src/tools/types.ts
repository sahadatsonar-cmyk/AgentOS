import { z } from 'zod';

export type ToolPermission = 'read' | 'write' | 'execute' | 'network';

export interface ToolContext {
  sessionId: string;
  userId?: string;
  taskId?: string;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  version: string;
  permissions: ToolPermission[];
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export type AnyTool = ToolDefinition<any, any>;
