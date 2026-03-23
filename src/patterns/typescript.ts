import type { CompressionPattern } from './index.js';

export const typescriptPattern: CompressionPattern = {
  name: 'typescript',

  matches(command: string): boolean {
    return /\btsc\b|\btsx\b|\bsvelte-check\b|\bvite\s+build\b|\bsvelte-kit\s+sync\b/.test(command);
  },

  compress(output: string): string {
    const lines = output.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return 'ok (no output)';

    const errors: Map<string, string[]> = new Map();
    const warnings: string[] = [];
    let errorCount = 0;
    let warningCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      const errorMatch = trimmed.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
      if (errorMatch) {
        const [, file, lineNum, , code, message] = errorMatch;
        const key = `${code}: ${message}`;
        if (!errors.has(key)) errors.set(key, []);
        errors.get(key)!.push(`${file}:${lineNum}`);
        errorCount++;
        continue;
      }

      if (/error/i.test(trimmed) && /\.tsx?|\.svelte/.test(trimmed)) {
        const key = trimmed;
        if (!errors.has(key)) errors.set(key, []);
        errorCount++;
        continue;
      }

      if (/warning/i.test(trimmed)) {
        warningCount++;
        if (warnings.length < 5) warnings.push(trimmed);
        continue;
      }
    }

    if (errorCount === 0 && warningCount === 0) {
      const summaryLine = lines.find((l) => /found \d+ error/i.test(l) || /\d+ error/i.test(l));
      if (summaryLine) return summaryLine.trim();
      return lines.length <= 10 ? lines.join('\n') : 'ok (compiled successfully)';
    }

    const parts: string[] = [];

    if (errorCount > 0) {
      parts.push(`Errors (${errorCount}, ${errors.size} unique):`);
      for (const [message, locations] of errors) {
        if (locations.length <= 3) {
          parts.push(`  ${message}`);
          for (const loc of locations) parts.push(`    at ${loc}`);
        } else {
          parts.push(`  ${message} (${locations.length} occurrences)`);
          for (const loc of locations.slice(0, 2)) parts.push(`    at ${loc}`);
          parts.push(`    ... +${locations.length - 2} more`);
        }
      }
    }

    if (warningCount > 0) {
      parts.push(`Warnings (${warningCount}):`);
      for (const w of warnings) parts.push(`  ${w}`);
      if (warningCount > 5) parts.push(`  ... +${warningCount - 5} more`);
    }

    return parts.join('\n');
  },
};
