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

/**
 * TInput = parsed output type (after defaults).
 * inputSchema accepts Zod effects/defaults where _input may differ from output.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  version: string;
  permissions: ToolPermission[];
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export type AnyTool = ToolDefinition<any, any>;
