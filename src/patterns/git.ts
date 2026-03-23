import type { CompressionPattern } from './index.js';

export const gitPattern: CompressionPattern = {
  name: 'git',

  matches(command: string): boolean {
    return /\bgit\b/.test(command);
  },

  compress(output: string): string {
    const lines = output.split('\n').filter((l) => l.trim());

    if (lines.length === 0) return 'ok (no output)';

    const isStatus = lines.some(
      (l) => /^On branch|^Changes|^Untracked|^nothing to commit/i.test(l.trim())
    );
    if (isStatus) return compressGitStatus(lines);

    const isDiff = lines.some((l) => /^diff --git|^@@/.test(l.trim()));
    if (isDiff) return compressGitDiff(lines);

    const isLog = lines.some((l) => /^commit [a-f0-9]{40}/.test(l.trim()));
    if (isLog) return compressGitLog(lines);

    if (lines.length > 30) {
      return [...lines.slice(0, 15), `... +${lines.length - 15} more lines`].join('\n');
    }

    return lines.join('\n');
  },
};

function compressGitStatus(lines: string[]): string {
  let branch = '';
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];
  let clean = false;

  let section = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^On branch (.+)/.test(trimmed)) {
      branch = trimmed.replace('On branch ', '');
      continue;
    }

    if (/^nothing to commit/i.test(trimmed)) {
      clean = true;
      continue;
    }

    if (/^Changes to be committed/i.test(trimmed)) { section = 'staged'; continue; }
    if (/^Changes not staged/i.test(trimmed)) { section = 'modified'; continue; }
    if (/^Untracked files/i.test(trimmed)) { section = 'untracked'; continue; }
    if (/^\(use "git/.test(trimmed)) continue;

    const fileMatch = trimmed.match(/^(?:new file|modified|deleted|renamed):\s*(.+)/) ||
      trimmed.match(/^\s*(.+\.\w+)$/);

    if (fileMatch) {
      const file = fileMatch[1].trim();
      if (section === 'staged') staged.push(file);
      else if (section === 'modified') modified.push(file);
      else if (section === 'untracked') untracked.push(file);
    }
  }

  const parts: string[] = [];
  if (branch) parts.push(`Branch: ${branch}`);
  if (clean) { parts.push('Clean working tree'); return parts.join('\n'); }
  if (staged.length) parts.push(`Staged (${staged.length}): ${staged.join(', ')}`);
  if (modified.length) parts.push(`Modified (${modified.length}): ${modified.join(', ')}`);
  if (untracked.length) parts.push(`Untracked (${untracked.length}): ${untracked.join(', ')}`);

  return parts.join('\n') || lines.join('\n');
}

function compressGitDiff(lines: string[]): string {
  const files: { name: string; additions: number; deletions: number; hunks: string[] }[] = [];
  let current: typeof files[0] | null = null;
  let inHunk = false;
  let hunkLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (current && hunkLines.length) {
        current.hunks.push(hunkLines.join('\n'));
      }
      const match = line.match(/b\/(.+)$/);
      current = { name: match?.[1] ?? '?', additions: 0, deletions: 0, hunks: [] };
      files.push(current);
      inHunk = false;
      hunkLines = [];
      continue;
    }

    if (line.startsWith('@@') && current) {
      if (hunkLines.length) current.hunks.push(hunkLines.join('\n'));
      hunkLines = [line];
      inHunk = true;
      continue;
    }

    if (inHunk && current) {
      if (line.startsWith('+') && !line.startsWith('+++')) current.additions++;
      if (line.startsWith('-') && !line.startsWith('---')) current.deletions++;
      hunkLines.push(line);
    }
  }

  if (current && hunkLines.length) {
    current.hunks.push(hunkLines.join('\n'));
  }

  const parts: string[] = [`${files.length} file(s) changed`];
  for (const f of files) {
    parts.push(`  ${f.name}: +${f.additions} -${f.deletions} (${f.hunks.length} hunk${f.hunks.length !== 1 ? 's' : ''})`);
  }

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);
  if (totalAdditions + totalDeletions <= 100) {
    parts.push('');
    for (const f of files) {
      for (const hunk of f.hunks) parts.push(hunk);
    }
  } else {
    parts.push(`(${totalAdditions + totalDeletions} total changes — full diff omitted for brevity)`);
  }

  return parts.join('\n');
}

function compressGitLog(lines: string[]): string {
  const commits: { hash: string; author: string; date: string; message: string }[] = [];
  let current: typeof commits[0] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const commitMatch = trimmed.match(/^commit ([a-f0-9]{40})/);
    if (commitMatch) {
      if (current) commits.push(current);
      current = { hash: commitMatch[1].slice(0, 8), author: '', date: '', message: '' };
      continue;
    }

    if (current) {
      if (/^Author:/.test(trimmed)) {
        current.author = trimmed.replace('Author: ', '').replace(/<.*>/, '').trim();
      } else if (/^Date:/.test(trimmed)) {
        current.date = trimmed.replace('Date:', '').trim();
      } else if (trimmed && !current.message) {
        current.message = trimmed;
      }
    }
  }
  if (current) commits.push(current);

  return commits
    .map((c) => `${c.hash} ${c.message} (${c.author}, ${c.date})`)
    .join('\n');
}
