import { z } from 'zod';
import type { ToolDefinition } from './types';

function githubToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || null;
}

async function githubFetch(path: string, init?: RequestInit) {
  const token = githubToken();
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is not configured. Add a fine-scoped GitHub token to enable GitHub tools.',
    );
  }

  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AgentOS/1.0',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

const RepoFileInputSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  path: z.string().min(1).max(500),
  ref: z.string().max(100).optional(),
});

type RepoFileInput = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
};

export const githubGetFileTool: ToolDefinition<
  RepoFileInput,
  { path: string; sha: string; content: string; encoding: string; truncated: boolean }
> = {
  name: 'github_get_file',
  description: 'Read a file from a GitHub repository (requires GITHUB_TOKEN).',
  version: '1.0.0',
  permissions: ['network', 'read'],
  inputSchema: RepoFileInputSchema,
  async execute(input) {
    const q = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : '';
    const json = (await githubFetch(
      `/repos/${input.owner}/${input.repo}/contents/${input.path.replace(/^\//, '')}${q}`,
    )) as {
      type?: string;
      content?: string;
      encoding?: string;
      sha?: string;
      path?: string;
      size?: number;
    };

    if (json.type !== 'file' || !json.content) {
      throw new Error('Path is not a file or has no content');
    }

    const raw = Buffer.from(json.content, (json.encoding as BufferEncoding) || 'base64').toString(
      'utf8',
    );
    const max = 80_000;
    const truncated = raw.length > max;

    return {
      path: json.path || input.path,
      sha: json.sha || '',
      content: truncated ? raw.slice(0, max) : raw,
      encoding: 'utf-8',
      truncated,
    };
  },
};

const ListDirInputSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  path: z.string().max(500).optional(),
  ref: z.string().max(100).optional(),
});

type ListDirInput = {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
};

export const githubListDirTool: ToolDefinition<
  ListDirInput,
  { path: string; entries: Array<{ name: string; path: string; type: string; size?: number }> }
> = {
  name: 'github_list_dir',
  description: 'List files in a GitHub repo directory (requires GITHUB_TOKEN).',
  version: '1.0.0',
  permissions: ['network', 'read'],
  inputSchema: ListDirInputSchema,
  async execute(input) {
    const p = (input.path || '').replace(/^\//, '');
    const q = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : '';
    const json = await githubFetch(
      `/repos/${input.owner}/${input.repo}/contents/${p}${q}`,
    );

    const items = Array.isArray(json) ? json : [json];
    return {
      path: p || '/',
      entries: items.map((it: { name: string; path: string; type: string; size?: number }) => ({
        name: it.name,
        path: it.path,
        type: it.type,
        size: it.size,
      })),
    };
  },
};
