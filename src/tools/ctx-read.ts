import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionCache } from '../core/session-cache.js';
import { Compressor } from '../core/compressor.js';

const compressor = new Compressor();

export function registerCtxRead(server: McpServer, cache: SessionCache): void {
  server.tool(
    'ctx_read',
    'Smart file read with session caching. Returns cached summary if file was already read and unchanged. Saves tokens by avoiding redundant reads.',
    {
      path: z.string().describe('Absolute or relative file path to read'),
      query: z
        .string()
        .optional()
        .describe('Optional relevance filter — only return sections matching this query'),
      force: z
        .boolean()
        .optional()
        .describe('Force re-read even if cached (default: false)'),
    },
    async ({ path: filePath, query, force }) => {
      const absPath = resolve(filePath);

      if (!force) {
        const check = await cache.checkFile(absPath);

        if (check.cached && !check.changed && check.entry) {
          const turnsAgo = cache.turnsAgo(check.entry);
          const lines = check.entry.lineCount;
          const summary = `File already in context (read ${turnsAgo} turn${turnsAgo !== 1 ? 's' : ''} ago, ${lines} lines, unchanged).`;

          if (query) {
            const filtered = filterByQuery(check.entry.content, query);
            if (filtered) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `${summary}\nFiltered for "${query}":\n\n${filtered}`,
                  },
                ],
              };
            }
          }

          return {
            content: [{ type: 'text' as const, text: summary }],
          };
        }
      }

      let content: string;
      try {
        content = await readFile(absPath, 'utf-8');
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }

      const compressed = compressor.compressCode(content);
      cache.store(absPath, content);

      let output = compressed.output;

      if (query) {
        const filtered = filterByQuery(output, query);
        if (filtered) {
          output = `Filtered for "${query}" (${compressed.reductionPercent}% compressed):\n\n${filtered}`;
        }
      }

      const meta = compressed.reductionPercent > 0
        ? `\n[lean-ctx: ${compressed.reductionPercent}% smaller, ${content.split('\n').length} lines]`
        : '';

      return {
        content: [{ type: 'text' as const, text: output + meta }],
      };
    }
  );
}

function filterByQuery(content: string, query: string): string | null {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const lines = content.split('\n');
  const matchingRanges: [number, number][] = [];

  const CONTEXT_BEFORE = 3;
  const CONTEXT_AFTER = 5;

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (queryTerms.some((term) => lower.includes(term))) {
      const start = Math.max(0, i - CONTEXT_BEFORE);
      const end = Math.min(lines.length - 1, i + CONTEXT_AFTER);
      matchingRanges.push([start, end]);
    }
  }

  if (matchingRanges.length === 0) return null;

  const merged = mergeRanges(matchingRanges);
  const sections: string[] = [];

  for (const [start, end] of merged) {
    const section = lines.slice(start, end + 1);
    sections.push(`[lines ${start + 1}-${end + 1}]\n${section.join('\n')}`);
  }

  return sections.join('\n\n...\n\n');
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1] + 1) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}
