/**
 * Derive tool inputs from the session goal + task text.
 */
export function pickToolInput(
  toolName: string,
  goal: string,
  taskTitle: string,
  taskDescription: string | null,
): Record<string, unknown> | null {
  const text = `${goal}\n${taskTitle}\n${taskDescription || ''}`;

  switch (toolName) {
    case 'web_search':
      return { query: goal.slice(0, 300), maxResults: 5 };

    case 'web_fetch': {
      const urlMatch = text.match(/https?:\/\/[^\s"']+/i);
      if (urlMatch) {
        return { url: urlMatch[0], maxBytes: 80_000 };
      }
      return null;
    }

    case 'calculator': {
      const patterns = [
        /(?:calculate|compute|math|evaluate)\s*([0-9()\s+\-*/.%×÷]+)/i,
        /([0-9]+(?:\s*[+\-*/%×÷]\s*[0-9.]+)+)/,
        /([0-9()\s+\-*/.%]{3,})/,
      ];
      for (const re of patterns) {
        const m = goal.match(re) || text.match(re);
        if (m?.[1]) {
          const expression = m[1]
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .trim();
          if (/[0-9]/.test(expression) && /[+\-*/%]/.test(expression)) {
            return { expression };
          }
        }
      }
      return null;
    }

    case 'datetime':
      return { timezone: 'UTC' };

    case 'code_analyze': {
      // Prefer fenced code blocks in the goal
      const fence = goal.match(/```(?:\w+)?\n([\s\S]*?)```/);
      if (fence?.[1]) {
        return {
          source: fence[1].slice(0, 50_000),
          language: (goal.match(/```(\w+)/)?.[1]) || undefined,
          focus: taskTitle.slice(0, 200),
        };
      }
      // Fallback: treat whole goal as description and a tiny sample
      return {
        source: `// Goal: ${goal.slice(0, 500)}\n// No code block provided — analysis is limited.\n`,
        language: 'typescript',
        focus: taskTitle.slice(0, 200),
      };
    }

    case 'propose_patch': {
      const pathMatch = text.match(/(?:file|path)\s*[:=]?\s*([\w./-]+\.\w+)/i);
      return {
        path: pathMatch?.[1] || 'src/example.ts',
        instruction: goal.slice(0, 2000),
      };
    }

    case 'github_list_dir': {
      const m =
        text.match(/github\.com\/([\w-]+)\/([\w.-]+)/i) ||
        text.match(/([\w-]+)\/([\w.-]+)/);
      return {
        owner: m?.[1] || 'sahadatsonar-cmyk',
        repo: m?.[2] || 'AgentOS',
        path: '',
      };
    }

    case 'github_get_file': {
      const m =
        text.match(/github\.com\/([\w-]+)\/([\w.-]+)/i) ||
        text.match(/([\w-]+)\/([\w.-]+)/);
      const pathMatch = text.match(/(?:file|path)\s*[:=]?\s*([\w./-]+)/i);
      return {
        owner: m?.[1] || 'sahadatsonar-cmyk',
        repo: m?.[2] || 'AgentOS',
        path: pathMatch?.[1] || 'README.md',
      };
    }

    case 'shell':
      return { command: 'git status' };

    // legacy alias from older plans
    case 'code':
      return pickToolInput('code_analyze', goal, taskTitle, taskDescription);

    default:
      return {};
  }
}
