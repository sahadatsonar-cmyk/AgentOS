export type RetryDecision =
  | { action: 'retry'; delayMs: number; reason: string }
  | { action: 'skip'; reason: string }
  | { action: 'fail'; reason: string }
  | { action: 'replan'; reason: string };

export type VerifyResult = {
  ok: boolean;
  score: number; // 0..1
  notes: string[];
};

/**
 * Decide whether to retry a failed tool/task.
 */
export function decideRetry(opts: {
  retryCount: number;
  maxRetries: number;
  error?: string | null;
  toolName?: string;
}): RetryDecision {
  const { retryCount, maxRetries, error, toolName } = opts;

  if (retryCount >= maxRetries) {
    return {
      action: 'fail',
      reason: `Max retries (${maxRetries}) reached${toolName ? ` for ${toolName}` : ''}`,
    };
  }

  const msg = (error || '').toLowerCase();

  // Non-retryable
  if (
    msg.includes('invalid') ||
    msg.includes('blocked') ||
    msg.includes('private ip') ||
    msg.includes('not allowed') ||
    msg.includes('could not derive input')
  ) {
    return { action: 'skip', reason: `Non-retryable error: ${error}` };
  }

  // Network / transient → retry with backoff
  if (
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('http 5') ||
    msg.includes('econn') ||
    msg.includes('temporar')
  ) {
    const delayMs = Math.min(2000 * Math.pow(2, retryCount), 8000);
    return {
      action: 'retry',
      delayMs,
      reason: `Transient error, retry ${retryCount + 1}/${maxRetries} after ${delayMs}ms`,
    };
  }

  // Default: one more attempt for unknown errors
  if (retryCount < 1) {
    return {
      action: 'retry',
      delayMs: 500,
      reason: `Unknown error, single retry: ${error || 'no message'}`,
    };
  }

  return { action: 'fail', reason: error || 'Failed after retries' };
}

/**
 * Lightweight verification against goal + tool outputs.
 * No LLM required.
 */
export function verifyOutcome(opts: {
  goal: string;
  answers: string[];
  toolSummaries: string[];
  failedTaskCount: number;
  totalTasks: number;
}): VerifyResult {
  const notes: string[] = [];
  let score = 1;

  if (opts.totalTasks === 0) {
    return { ok: false, score: 0, notes: ['No tasks executed'] };
  }

  if (opts.failedTaskCount > 0) {
    score -= 0.25 * opts.failedTaskCount;
    notes.push(`${opts.failedTaskCount} task(s) failed`);
  }

  const g = opts.goal.toLowerCase();
  const isMath = /[0-9]+\s*[+\-*/×÷%]\s*[0-9]+/.test(opts.goal) || /calculat/i.test(g);
  const isResearch = /(summar|research|benefits|what is|compare)/i.test(g);

  if (isMath) {
    const hasNumber = opts.answers.some((a) => /\d/.test(a));
    if (!hasNumber) {
      score -= 0.4;
      notes.push('Math goal but no numeric answer found');
    } else {
      notes.push('Numeric answer present');
    }
  }

  if (isResearch) {
    if (opts.toolSummaries.length === 0 && opts.answers.length === 0) {
      score -= 0.35;
      notes.push('Research goal but no search findings');
    } else {
      notes.push('Research findings present');
    }
  }

  if (opts.answers.length === 0 && opts.toolSummaries.length === 0) {
    score -= 0.2;
    notes.push('No answer content produced');
  }

  score = Math.max(0, Math.min(1, score));
  const ok = score >= 0.5;
  if (ok) notes.push(`Verification passed (score ${score.toFixed(2)})`);
  else notes.push(`Verification weak (score ${score.toFixed(2)})`);

  return { ok, score, notes };
}

/**
 * Suggest a simple recovery plan hint when verification fails.
 */
export function suggestReplan(opts: {
  goal: string;
  failedTools: string[];
  verify: VerifyResult;
}): { shouldReplan: boolean; hint: string } {
  if (opts.verify.ok) {
    return { shouldReplan: false, hint: 'No replan needed' };
  }

  if (opts.failedTools.includes('web_search')) {
    return {
      shouldReplan: true,
      hint: 'Search failed — retry with web_search or use Wikipedia-only path',
    };
  }

  if (opts.failedTools.includes('calculator')) {
    return {
      shouldReplan: true,
      hint: 'Calculator failed — re-extract expression from goal and retry once',
    };
  }

  return {
    shouldReplan: true,
    hint: `Verification score ${opts.verify.score.toFixed(2)}: ${opts.verify.notes.join('; ')}`,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
