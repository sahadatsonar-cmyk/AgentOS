import { z } from 'zod';
import type { ToolDefinition } from './types';

const WebSearchInputSchema = z.object({
  query: z.string().min(1).max(300).describe('Search query'),
  maxResults: z.number().int().min(1).max(10).optional(),
});

type WebSearchInput = {
  query: string;
  maxResults?: number;
};

export type SearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<{
  abstract: string | null;
  abstractURL: string | null;
  results: SearchResultItem[];
}> {
  const url = new URL('https://api.duckduckgo.com/');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('no_redirect', '1');
  url.searchParams.set('no_html', '1');
  url.searchParams.set('skip_disambig', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { abstract: null, abstractURL: null, results: [] };
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
        title: json.Heading || query,
        url: json.AbstractURL || '',
        snippet: json.AbstractText,
      });
    }

    const pushTopic = (t: { Text?: string; FirstURL?: string }) => {
      if (!t.Text || results.length >= maxResults) return;
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
      abstract: json.AbstractText || null,
      abstractURL: json.AbstractURL || null,
      results,
    };
  } catch {
    return { abstract: null, abstractURL: null, results: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWikipedia(
  query: string,
  maxResults: number,
): Promise<SearchResultItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    // 1) Search for page titles
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('srlimit', String(Math.min(maxResults, 5)));
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    const searchRes = await fetch(searchUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AgentOS/1.0 (https://github.com/sahadatsonar-cmyk/AgentOS)',
      },
    });
    if (!searchRes.ok) return [];

    const searchJson = (await searchRes.json()) as {
      query?: { search?: Array<{ title: string; snippet: string; pageid: number }> };
    };
    const hits = searchJson.query?.search || [];
    if (hits.length === 0) return [];

    // 2) Fetch extracts for top hits
    const titles = hits.map((h) => h.title).join('|');
    const extractUrl = new URL('https://en.wikipedia.org/w/api.php');
    extractUrl.searchParams.set('action', 'query');
    extractUrl.searchParams.set('prop', 'extracts');
    extractUrl.searchParams.set('exintro', '1');
    extractUrl.searchParams.set('explaintext', '1');
    extractUrl.searchParams.set('titles', titles);
    extractUrl.searchParams.set('format', 'json');
    extractUrl.searchParams.set('origin', '*');

    const extractRes = await fetch(extractUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AgentOS/1.0 (https://github.com/sahadatsonar-cmyk/AgentOS)',
      },
    });

    const extracts: Record<string, string> = {};
    if (extractRes.ok) {
      const extractJson = (await extractRes.json()) as {
        query?: {
          pages?: Record<string, { title?: string; extract?: string }>;
        };
      };
      for (const page of Object.values(extractJson.query?.pages || {})) {
        if (page.title && page.extract) {
          extracts[page.title] = page.extract.slice(0, 600);
        }
      }
    }

    return hits.map((h) => {
      const snippet =
        extracts[h.title] ||
        h.snippet.replace(/<[^>]+>/g, '').slice(0, 300) ||
        '';
      return {
        title: h.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
        snippet,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Web search: DuckDuckGo Instant Answer first, Wikipedia fallback.
 * Empty results are OK (not an error) — Instant Answer is sparse.
 */
export const webSearchTool: ToolDefinition<
  WebSearchInput,
  {
    query: string;
    source: 'duckduckgo' | 'wikipedia' | 'none';
    abstract: string | null;
    abstractURL: string | null;
    results: SearchResultItem[];
  }
> = {
  name: 'web_search',
  description:
    'Search the web (DuckDuckGo + Wikipedia fallback). Good for facts and topic overviews.',
  version: '1.1.0',
  permissions: ['network', 'read'],
  inputSchema: WebSearchInputSchema,
  async execute(input) {
    const maxResults = input.maxResults ?? 5;

    const ddg = await searchDuckDuckGo(input.query, maxResults);
    if (ddg.results.length > 0 || ddg.abstract) {
      return {
        query: input.query,
        source: 'duckduckgo' as const,
        abstract: ddg.abstract,
        abstractURL: ddg.abstractURL,
        results: ddg.results,
      };
    }

    const wiki = await searchWikipedia(input.query, maxResults);
    if (wiki.length > 0) {
      return {
        query: input.query,
        source: 'wikipedia' as const,
        abstract: wiki[0]?.snippet || null,
        abstractURL: wiki[0]?.url || null,
        results: wiki,
      };
    }

    // Soft empty — not a hard failure
    return {
      query: input.query,
      source: 'none' as const,
      abstract: null,
      abstractURL: null,
      results: [],
    };
  },
};
