import type { AnyTool, ToolContext, ToolResult } from './types';
import { calculatorTool } from './calculator';
import { datetimeTool } from './datetime';
import { webFetchTool } from './web-fetch';
import { webSearchTool } from './web-search';
import { codeAnalyzeTool, proposePatchTool } from './code';
import { githubGetFileTool, githubListDirTool } from './github';
import { shellTool } from './shell';

export class ToolRegistry {
  private tools = new Map<string, AnyTool>();

  register(tool: AnyTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  list(): AnyTool[] {
    return Array.from(this.tools.values());
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  async execute<
    T = unknown,
  >(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolResult<T>> {
    const start = Date.now();
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        ok: false,
        error: `Unknown tool: ${name}. Available: ${this.names().join(', ') || '(none)'}`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const input = tool.inputSchema.parse(rawInput ?? {});
      const data = (await tool.execute(input, ctx)) as T;
      return { ok: true, data, durationMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }
}

/** Default built-in tools including Phase 8 coding agent tools */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(calculatorTool);
  registry.register(datetimeTool);
  registry.register(webFetchTool);
  registry.register(webSearchTool);
  registry.register(codeAnalyzeTool);
  registry.register(proposePatchTool);
  registry.register(githubGetFileTool);
  registry.register(githubListDirTool);
  registry.register(shellTool);
  return registry;
}
