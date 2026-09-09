import { z } from 'zod';
import type { ToolDefinition } from './types';

const ShellInputSchema = z.object({
  command: z.string().min(1).max(500),
  cwd: z.string().max(300).optional(),
});

type ShellInput = {
  command: string;
  cwd?: string;
};

const ALLOWED_PREFIXES = [
  'node -v',
  'npm -v',
  'pnpm -v',
  'git status',
  'git log',
  'git diff',
  'git branch',
  'ls',
  'pwd',
  'echo ',
];

/**
 * Sandboxed terminal — intentionally restricted.
 * On Vercel/serverless this returns a clear unavailable message.
 * Local worker hosts may enable a real sandbox later.
 */
export const shellTool: ToolDefinition<
  ShellInput,
  {
    ok: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    note: string;
  }
> = {
  name: 'shell',
  description:
    'Restricted shell commands (read-only git/node version checks). Disabled on pure serverless unless a worker host is configured.',
  version: '1.0.0',
  permissions: ['execute'],
  inputSchema: ShellInputSchema,
  async execute(input) {
    const cmd = input.command.trim();

    // Never allow destructive patterns
    if (/[;&|`$]|\brm\b|\bsudo\b|\bcurl\b|\bwget\b|\bchmod\b|\bchown\b/i.test(cmd)) {
      throw new Error('Command blocked by sandbox policy');
    }

    const allowed = ALLOWED_PREFIXES.some(
      (p) => cmd === p || cmd.startsWith(p + ' ') || cmd.startsWith(p),
    );
    if (!allowed) {
      throw new Error(
        `Command not in allowlist. Allowed prefixes: ${ALLOWED_PREFIXES.join(', ')}`,
      );
    }

    // Serverless / Vercel: no real shell process
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return {
        ok: false,
        stdout: '',
        stderr: 'Shell execution is disabled on serverless. Use a dedicated worker host for sandbox terminal.',
        exitCode: 1,
        note: 'Phase 8 stub — real sandbox needs Firecracker/Docker worker.',
      };
    }

    // Local: still do not spawn by default (safety). Explicit opt-in required.
    if (process.env.AGENTOS_ENABLE_SHELL !== 'true') {
      return {
        ok: false,
        stdout: '',
        stderr:
          'Shell is disabled. Set AGENTOS_ENABLE_SHELL=true on a trusted local/worker host to enable allowlisted commands.',
        exitCode: 1,
        note: 'Safety default: no process spawn without explicit env flag.',
      };
    }

    // Minimal local allowlisted execution would go here in a future worker package.
    return {
      ok: false,
      stdout: '',
      stderr: 'Shell worker not implemented in this package yet.',
      exitCode: 1,
      note: 'Interface ready — implement in apps/worker with Docker sandbox.',
    };
  },
};
