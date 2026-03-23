import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionCache } from '../core/session-cache.js';

export function registerCtxMetrics(server: McpServer, cache: SessionCache): void {
  server.tool(
    'ctx_metrics',
    'Show token savings statistics for this session. Reports cache hits, misses, and estimated tokens saved by lean-ctx.',
    {},
    async () => {
      const stats = cache.getStats();

      const hitRate = stats.totalReads > 0
        ? Math.round((stats.cacheHits / stats.totalReads) * 100)
        : 0;

      const lines = [
        'lean-ctx Session Metrics',
        '========================',
        `Files tracked: ${stats.filesTracked}`,
        `Total reads: ${stats.totalReads}`,
        `Cache hits: ${stats.cacheHits} (${hitRate}%)`,
        `Cache misses: ${stats.cacheMisses}`,
        `Estimated tokens saved: ~${stats.estimatedTokensSaved.toLocaleString()}`,
      ];

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );
}
