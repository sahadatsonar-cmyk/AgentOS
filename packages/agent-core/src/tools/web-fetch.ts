import { z } from 'zod';
import type { ToolDefinition } from './types';

const WebFetchInputSchema = z.object({
  url: z.string().url().describe('HTTP or HTTPS URL to fetch'),
  maxBytes: z.number().int().positive().max(500_000).optional(),
});

type WebFetchInput = {
  url: string;
  maxBytes?: number;
};

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function assertSafeUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Local or internal hosts are blocked');
  }
  if (
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error('Private IP ranges are blocked');
  }
  return url;
}

export const webFetchTool: ToolDefinition<
  WebFetchInput,
  { url: string; status: number; contentType: string | null; body: string; truncated: boolean }
> = {
  name: 'web_fetch',
  description: 'Fetch text content from a public HTTP/HTTPS URL (size-limited)',
  version: '1.0.0',
  permissions: ['network', 'read'],
  inputSchema: WebFetchInputSchema,
  async execute(input) {
    const url = assertSafeUrl(input.url);
    const maxBytes = input.maxBytes ?? 100_000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'AgentOS/1.0 (+https://github.com/sahadatsonar-cmyk/AgentOS)',
          Accept: 'text/html,application/json,text/plain,*/*',
        },
      });

      const contentType = res.headers.get('content-type');
      const buf = Buffer.from(await res.arrayBuffer());
      const truncated = buf.byteLength > maxBytes;
      const slice = truncated ? buf.subarray(0, maxBytes) : buf;
      const body = slice.toString('utf8');

      return {
        url: url.toString(),
        status: res.status,
        contentType,
        body,
        truncated,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
