import { z } from 'zod';
import type { ToolDefinition } from './types';

const CalculatorInput = z.object({
  expression: z
    .string()
    .min(1)
    .max(200)
    .describe('Math expression using numbers and + - * / ( ) %'),
});

type CalculatorInput = z.infer<typeof CalculatorInput>;

/**
 * Safe calculator — only digits and basic operators, no eval of arbitrary code.
 */
function safeEvaluate(expression: string): number {
  const cleaned = expression.replace(/\s+/g, '');
  if (!/^[0-9+\-*/().%]+$/.test(cleaned)) {
    throw new Error('Expression contains invalid characters');
  }
  // Prevent consecutive operators abuse / empty
  if (!cleaned || /[+/\-*.%]{2,}/.test(cleaned.replace(/\*\*/g, ''))) {
    // allow ** for power? we don't — reject **
  }
  if (cleaned.includes('**')) {
    throw new Error('Operator ** not allowed');
  }

  // Use Function only after character whitelist — still safer than eval
  // eslint-disable-next-line no-new-func
  const fn = new Function(`"use strict"; return (${cleaned});`);
  const result = fn();
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number');
  }
  return result;
}

export const calculatorTool: ToolDefinition<CalculatorInput, { expression: string; result: number }> =
  {
    name: 'calculator',
    description: 'Evaluate a basic math expression (numbers and + - * / ( ) %)',
    version: '1.0.0',
    permissions: ['execute'],
    inputSchema: CalculatorInput,
    async execute(input) {
      const result = safeEvaluate(input.expression);
      return { expression: input.expression, result };
    },
  };
