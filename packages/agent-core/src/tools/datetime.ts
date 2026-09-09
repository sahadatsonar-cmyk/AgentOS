import { z } from 'zod';
import type { ToolDefinition } from './types';

const DateTimeInput = z.object({
  timezone: z
    .string()
    .optional()
    .describe('IANA timezone e.g. Asia/Dhaka. Defaults to UTC.'),
});

type DateTimeInput = z.infer<typeof DateTimeInput>;

export const datetimeTool: ToolDefinition<
  DateTimeInput,
  { iso: string; unix: number; timezone: string; localeString: string }
> = {
  name: 'datetime',
  description: 'Get current date and time, optionally in a timezone',
  version: '1.0.0',
  permissions: ['read'],
  inputSchema: DateTimeInput,
  async execute(input) {
    const timezone = input.timezone?.trim() || 'UTC';
    const now = new Date();
    let localeString: string;
    try {
      localeString = now.toLocaleString('en-US', { timeZone: timezone });
    } catch {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
    return {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      timezone,
      localeString,
    };
  },
};
