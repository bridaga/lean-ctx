import type { CompressionPattern } from './index.js';

export const dockerPattern: CompressionPattern = {
  name: 'docker',

  matches(command: string): boolean {
    return /\bdocker\b|\bdocker-compose\b|\bdocker compose\b/.test(command);
  },

  compress(output: string): string {
    const lines = output.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return 'ok (no output)';

    const isBuild = lines.some((l) => /^(#\d+|Step \d+|STEP \d+|=>\s)/i.test(l.trim()));
    if (isBuild) return compressBuild(lines);

    const isPs = lines.some((l) => /CONTAINER ID|NAMES|STATUS/i.test(l));
    if (isPs) return compressPs(lines);

    if (lines.length > 30) {
      return [...lines.slice(0, 15), `... +${lines.length - 15} more lines`].join('\n');
    }

    return lines.join('\n');
  },
};

function compressBuild(lines: string[]): string {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalSteps = 0;
  let lastStep = '';
  let imageId = '';
  let cached = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(#\d+|Step \d+|STEP \d+)/i.test(trimmed)) {
      totalSteps++;
      lastStep = trimmed;
    }

    if (/CACHED/i.test(trimmed)) cached++;

    if (/^(ERROR|error\[)/i.test(trimmed)) {
      errors.push(trimmed);
    }

    if (/warning/i.test(trimmed) && !/Sending build context/i.test(trimmed)) {
      warnings.push(trimmed);
    }

    const imgMatch = trimmed.match(/writing image sha256:([a-f0-9]+)/i) ||
      trimmed.match(/Successfully built ([a-f0-9]+)/i);
    if (imgMatch) imageId = imgMatch[1].slice(0, 12);

    if (/^sha256:[a-f0-9]+$/.test(trimmed)) imageId = trimmed.slice(7, 19);
  }

  const parts: string[] = [];
  parts.push(`Build: ${totalSteps} steps (${cached} cached)`);
  if (imageId) parts.push(`Image: ${imageId}`);
  if (errors.length > 0) {
    parts.push(`Errors (${errors.length}):`);
    for (const e of errors) parts.push(`  ${e}`);
  }
  if (warnings.length > 0 && warnings.length <= 5) {
    parts.push(`Warnings (${warnings.length}):`);
    for (const w of warnings) parts.push(`  ${w}`);
  } else if (warnings.length > 5) {
    parts.push(`Warnings: ${warnings.length} (omitted)`);
  }

  return parts.join('\n');
}

function compressPs(lines: string[]): string {
  if (lines.length <= 1) return 'No containers running';

  const header = lines[0];
  const containers = lines.slice(1).map((line) => {
    const parts = line.split(/\s{2,}/);
    const name = parts[parts.length - 1] || parts[0];
    const status = parts.find((p) => /up|exited|created|restarting/i.test(p)) || '';
    return `  ${name}: ${status}`;
  });

  return [`Containers (${containers.length}):`, ...containers].join('\n');
}
