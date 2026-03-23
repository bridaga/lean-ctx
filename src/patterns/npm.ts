import type { CompressionPattern } from './index.js';

export const npmPattern: CompressionPattern = {
  name: 'npm',

  matches(command: string): boolean {
    return /\bnpm\b|\bnpx\b|\byarn\b|\bpnpm\b/.test(command);
  },

  compress(output: string): string {
    const lines = output.split('\n');
    const errors: string[] = [];
    const warnings: string[] = [];
    const keyLines: string[] = [];

    let addedPackages = '';
    let auditResult = '';
    let buildResult = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^npm warn/i.test(trimmed) || /^warn\s/i.test(trimmed)) {
        const msg = trimmed.replace(/^npm warn\s*/i, '').replace(/^warn\s*/i, '');
        if (!warnings.includes(msg)) warnings.push(msg);
        continue;
      }

      if (/^npm error|^ERR!/i.test(trimmed) || /error\s/i.test(trimmed)) {
        errors.push(trimmed);
        continue;
      }

      if (/^added \d+ packages?/i.test(trimmed)) {
        addedPackages = trimmed;
        continue;
      }

      if (/^\d+ packages? are looking for funding/i.test(trimmed)) continue;
      if (/^run `npm fund`/i.test(trimmed)) continue;

      if (/^found \d+ vulnerabilit/i.test(trimmed)) {
        auditResult = trimmed;
        continue;
      }

      if (/\d+ packages? in \d+/i.test(trimmed) && !addedPackages) {
        addedPackages = trimmed;
        continue;
      }

      if (/^npm notice/i.test(trimmed)) continue;
      if (/^⸨.*⸩/.test(trimmed)) continue;
      if (/^\[={2,}/.test(trimmed)) continue;

      if (/^(✓|✔|√|done|success|built|compiled)/i.test(trimmed)) {
        buildResult = trimmed;
        continue;
      }

      keyLines.push(trimmed);
    }

    const parts: string[] = [];

    if (addedPackages) parts.push(addedPackages);
    if (auditResult) parts.push(auditResult);
    if (buildResult) parts.push(buildResult);
    if (warnings.length > 0) {
      parts.push(`Warnings (${warnings.length}):`);
      for (const w of warnings.slice(0, 5)) parts.push(`  - ${w}`);
      if (warnings.length > 5) parts.push(`  ... +${warnings.length - 5} more`);
    }
    if (errors.length > 0) {
      parts.push(`Errors (${errors.length}):`);
      for (const e of errors) parts.push(`  ${e}`);
    }
    if (keyLines.length > 0 && keyLines.length <= 20) {
      parts.push(...keyLines);
    } else if (keyLines.length > 20) {
      parts.push(...keyLines.slice(0, 10));
      parts.push(`... +${keyLines.length - 10} more lines`);
    }

    return parts.join('\n') || 'ok (no output)';
  },
};
