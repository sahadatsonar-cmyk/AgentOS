import { z } from 'zod';
import type { ToolDefinition } from './types';

const WebSearchInput = z.object({
  query: z.string().min(1).max(300).describe('Search query'),
  maxResults: z.number().int().min(1).max(10).optional().default(5),
});

type WebSearchInput = z.infer<typeof WebSearchInput>;

export type SearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Web search using DuckDuckGo Instant Answer API (no API key).
 * Returns Abstract + RelatedTopics when available.
 * Note: coverage is limited vs full SERP APIs; Phase 3+ can swap in SerpAPI etc.
 */
export const webSearchTool: ToolDefinition<
  WebSearchInput,
  { query: string; abstract: string | null; abstractURL: string | null; results: SearchResultItem[] }
> = {
  name: 'web_search',
  description: 'Search the web (DuckDuckGo Instant Answer). Good for facts and topic overviews.',
  version: '1.0.0',
  permissions: ['network', 'read'],
  inputSchema: WebSearchInput,
  async execute(input) {
    const maxResults = input.maxResults ?? 5;
    const url = new URL('https://api.duckduckgo.com/');
    url.searchParams.set('q', input.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_redirect', '1');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('skip_disambig', '1');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`DuckDuckGo API HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        RelatedTopics?: Array<
          | { Text?: string; FirstURL?: string }
          | { Name?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }
        >;
      };

      const results: SearchResultItem[] = [];

      if (json.AbstractText) {
        results.push({
          title: json.Heading || input.query,
          url: json.AbstractURL || '',
          snippet: json.AbstractText,
        });
      }

      const pushTopic = (t: { Text?: string; FirstURL?: string }) => {
        if (!t.Text) return;
        if (results.length >= maxResults) return;
        results.push({
          title: t.Text.split(' - ')[0] || t.Text.slice(0, 80),
          url: t.FirstURL || '',
          snippet: t.Text,
        });
      };

      for (const topic of json.RelatedTopics || []) {
        if (results.length >= maxResults) break;
        if ('Topics' in topic && Array.isArray(topic.Topics)) {
          for (const sub of topic.Topics) {
            pushTopic(sub);
            if (results.length >= maxResults) break;
          }
        } else if ('Text' in topic) {
          pushTopic(topic);
        }
      }

      return {
        query: input.query,
        abstract: json.AbstractText || null,
        abstractURL: json.AbstractURL || null,
        results,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
