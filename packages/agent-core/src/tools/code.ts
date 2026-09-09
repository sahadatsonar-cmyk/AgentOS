import { z } from 'zod';
import type { ToolDefinition } from './types';

const CodeAnalyzeInputSchema = z.object({
  language: z.string().max(40).optional(),
  source: z.string().min(1).max(50_000),
  focus: z.string().max(200).optional(),
});

type CodeAnalyzeInput = {
  language?: string;
  source: string;
  focus?: string;
};

/**
 * Static analysis only — no code execution.
 */
export const codeAnalyzeTool: ToolDefinition<
  CodeAnalyzeInput,
  {
    language: string;
    lines: number;
    chars: number;
    findings: Array<{ severity: 'info' | 'warn' | 'error'; message: string }>;
    summary: string;
  }
> = {
  name: 'code_analyze',
  description:
    'Statically analyze a code snippet (complexity heuristics, TODOs, rough issues). Does not execute code.',
  version: '1.0.0',
  permissions: ['read'],
  inputSchema: CodeAnalyzeInputSchema,
  async execute(input) {
    const language = (input.language || detectLanguage(input.source)).toLowerCase();
    const lines = input.source.split(/\r?\n/).length;
    const findings: Array<{ severity: 'info' | 'warn' | 'error'; message: string }> = [];

    if (input.source.includes('TODO') || input.source.includes('FIXME')) {
      findings.push({ severity: 'info', message: 'Contains TODO/FIXME markers' });
    }
    if (/eval\s*\(/.test(input.source)) {
      findings.push({ severity: 'error', message: 'Uses eval() — high risk' });
    }
    if (/innerHTML\s*=/.test(input.source)) {
      findings.push({ severity: 'warn', message: 'Assigns innerHTML — XSS risk if untrusted' });
    }
    if (/password\s*=\s*['"][^'"]+['"]/i.test(input.source)) {
      findings.push({ severity: 'error', message: 'Possible hardcoded password/secret' });
    }
    if (lines > 400) {
      findings.push({ severity: 'warn', message: `Large snippet (${lines} lines) — consider splitting` });
    }
    if (language === 'typescript' || language === 'javascript') {
      if (!/\b(function|=>|class|const|let|var)\b/.test(input.source)) {
        findings.push({ severity: 'info', message: 'No clear function/class declarations detected' });
      }
    }

    if (input.focus) {
      findings.push({
        severity: 'info',
        message: `Focus requested: ${input.focus}`,
      });
    }

    if (findings.length === 0) {
      findings.push({ severity: 'info', message: 'No major static issues flagged' });
    }

    return {
      language,
      lines,
      chars: input.source.length,
      findings,
      summary: `Analyzed ${lines} lines of ${language}: ${findings.length} finding(s)`,
    };
  },
};

const ProposePatchInputSchema = z.object({
  path: z.string().min(1).max(300),
  instruction: z.string().min(1).max(2000),
  original: z.string().max(50_000).optional(),
});

type ProposePatchInput = {
  path: string;
  instruction: string;
  original?: string;
};

/**
 * Propose a textual patch plan — does not write to disk.
 * Real apply happens via GitHub PR tools when token is present.
 */
export const proposePatchTool: ToolDefinition<
  ProposePatchInput,
  {
    path: string;
    instruction: string;
    plan: string[];
    note: string;
  }
> = {
  name: 'propose_patch',
  description:
    'Propose a file change plan from an instruction. Does not write files. Pair with GitHub tools to open a PR.',
  version: '1.0.0',
  permissions: ['read'],
  inputSchema: ProposePatchInputSchema,
  async execute(input) {
    const plan = [
      `Open file: ${input.path}`,
      `Apply change: ${input.instruction}`,
      input.original
        ? `Base content length: ${input.original.length} chars`
        : 'No original content provided — will need to fetch file first',
      'Run tests / typecheck after applying',
      'Open PR or commit if approved',
    ];

    return {
      path: input.path,
      instruction: input.instruction,
      plan,
      note: 'Proposal only. Use github_create_pr or local git when credentials are available.',
    };
  },
};

function detectLanguage(source: string): string {
  if (/\binterface\s+\w+|:\s*string\b|import\s+type\b/.test(source)) return 'typescript';
  if (/\bfunction\b|const\s+\w+\s*=|=>/.test(source)) return 'javascript';
  if (/def\s+\w+\(|import\s+\w+/.test(source)) return 'python';
  if (/fn\s+\w+|let\s+mut\s+/.test(source)) return 'rust';
  return 'unknown';
}
