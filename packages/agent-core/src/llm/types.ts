export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionRequest = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type ChatCompletionResponse = {
  content: string;
  model: string;
  provider: string;
};

export interface LlmProvider {
  name: string;
  isConfigured(): boolean;
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
