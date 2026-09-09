import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  LlmProvider,
} from './types';

export type OpenAiCompatibleConfig = {
  name: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
};

/**
 * Works with OpenAI and xAI (Grok) chat completions APIs.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(private config: OpenAiCompatibleConfig) {}

  get name() {
    return this.config.name;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey?.trim());
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error(`${this.config.name} API key is not configured`);
    }

    const model = req.model || this.config.defaultModel;
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 800,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `${this.config.name} HTTP ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };

      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error(`${this.config.name} returned empty content`);
      }

      return {
        content,
        model: json.model || model,
        provider: this.config.name,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createXaiProvider(apiKey?: string): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    name: 'xai',
    apiKey: apiKey || process.env.XAI_API_KEY || '',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
  });
}

export function createOpenAiProvider(apiKey?: string): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    name: 'openai',
    apiKey: apiKey || process.env.OPENAI_API_KEY || '',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  });
}
