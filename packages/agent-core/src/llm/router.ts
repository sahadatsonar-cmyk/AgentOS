import type { LlmProvider, ChatCompletionResponse } from './types';
import { createOpenAiProvider, createXaiProvider } from './openai-compatible';

/**
 * Prefer xAI (Grok) if configured, else OpenAI.
 */
export function resolveLlmProvider(): LlmProvider | null {
  const xai = createXaiProvider();
  if (xai.isConfigured()) return xai;

  const openai = createOpenAiProvider();
  if (openai.isConfigured()) return openai;

  return null;
}

export type FinalAnswerContext = {
  goal: string;
  taskTitles: string[];
  toolSummaries: string[];
  rawAnswers: string[];
};

/**
 * Turn tool outputs into a short natural-language final answer.
 * Falls back to heuristic if no LLM key is set.
 */
export async function generateFinalAnswer(
  ctx: FinalAnswerContext,
): Promise<{ text: string; source: 'llm' | 'heuristic'; provider?: string; model?: string }> {
  const heuristic = buildHeuristicAnswer(ctx);
  const provider = resolveLlmProvider();

  if (!provider) {
    return { text: heuristic, source: 'heuristic' };
  }

  try {
    const system = `You are AgentOS, a helpful autonomous agent.
Write a clear, concise final answer for the user based on the goal and tool results.
- Prefer facts from tools over speculation.
- If the goal is math, state the numeric answer first.
- If search results are provided, synthesize a short useful summary (not a dump).
- Keep it under ~200 words unless the user asked for detail.
- Do not mention internal task IDs or system status.`;

    const user = [
      `Goal: ${ctx.goal}`,
      '',
      `Tasks completed: ${ctx.taskTitles.join(' → ') || '(none)'}`,
      '',
      'Tool results:',
      ...(ctx.toolSummaries.length
        ? ctx.toolSummaries.map((s, i) => `${i + 1}. ${s}`)
        : ['(no tool results)']),
      '',
      ctx.rawAnswers.length
        ? `Extracted answers:\n${ctx.rawAnswers.map((a) => `- ${a}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res: ChatCompletionResponse = await provider.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      maxTokens: 600,
    });

    return {
      text: res.content,
      source: 'llm',
      provider: res.provider,
      model: res.model,
    };
  } catch (err) {
    // Soft fallback — never fail the whole run for LLM issues
    const msg = err instanceof Error ? err.message : String(err);
    return {
      text: `${heuristic}\n\n(Note: LLM summary unavailable: ${msg.slice(0, 120)})`,
      source: 'heuristic',
    };
  }
}

function buildHeuristicAnswer(ctx: FinalAnswerContext): string {
  if (ctx.rawAnswers.length > 0) {
    return ctx.rawAnswers.join('\n\n');
  }
  if (ctx.toolSummaries.length > 0) {
    return [
      `Completed goal: ${ctx.goal}`,
      '',
      'Findings:',
      ...ctx.toolSummaries.map((s) => `• ${s}`),
    ].join('\n');
  }
  return `Completed plan for: ${ctx.goal}`;
}
