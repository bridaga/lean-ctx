export interface DiffResult {
  hunks: DiffHunk[];
  summary: string;
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
}

const CONTEXT_LINES = 3;

export function computeDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const lcs = longestCommonSubsequence(oldLines, newLines);
  const rawDiff = buildRawDiff(oldLines, newLines, lcs);
  const hunks = groupIntoHunks(rawDiff, oldLines.length, newLines.length);

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const entry of rawDiff) {
    if (entry.type === 'add') added++;
    else if (entry.type === 'remove') removed++;
    else unchanged++;
  }

  const summary = `${added} added, ${removed} removed, ${unchanged} unchanged`;

  return { hunks, summary, addedLines: added, removedLines: removed, unchangedLines: unchanged };
}

export function formatDiff(diff: DiffResult): string {
  if (diff.hunks.length === 0) return 'No changes';

  const parts: string[] = [`Changes: ${diff.summary}`];

  for (const hunk of diff.hunks) {
    parts.push(`@@ -${hunk.oldStart} +${hunk.newStart} @@`);
    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      parts.push(`${prefix}${line.content}`);
    }
  }

  return parts.join('\n');
}

interface RawEntry {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldIdx: number;
  newIdx: number;
}

function buildRawDiff(oldLines: string[], newLines: string[], lcs: string[]): RawEntry[] {
  const result: RawEntry[] = [];
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi < oldLines.length && oldLines[oi] === lcs[li] &&
        ni < newLines.length && newLines[ni] === lcs[li]) {
      result.push({ type: 'context', content: oldLines[oi], oldIdx: oi, newIdx: ni });
      oi++;
      ni++;
      li++;
    } else if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
      result.push({ type: 'remove', content: oldLines[oi], oldIdx: oi, newIdx: ni });
      oi++;
    } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      result.push({ type: 'add', content: newLines[ni], oldIdx: oi, newIdx: ni });
      ni++;
    }
  }

  return result;
}

function groupIntoHunks(raw: RawEntry[], _oldLen: number, _newLen: number): DiffHunk[] {
  const changes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].type !== 'context') changes.push(i);
  }

  if (changes.length === 0) return [];

  const groups: number[][] = [];
  let currentGroup = [changes[0]];

  for (let i = 1; i < changes.length; i++) {
    if (changes[i] - changes[i - 1] <= CONTEXT_LINES * 2 + 1) {
      currentGroup.push(changes[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [changes[i]];
    }
  }
  groups.push(currentGroup);

  const hunks: DiffHunk[] = [];

  for (const group of groups) {
    const first = group[0];
    const last = group[group.length - 1];
    const start = Math.max(0, first - CONTEXT_LINES);
    const end = Math.min(raw.length - 1, last + CONTEXT_LINES);

    const lines: DiffLine[] = [];
    let oldStart = raw[start].oldIdx + 1;
    let newStart = raw[start].newIdx + 1;

    for (let i = start; i <= end; i++) {
      lines.push({ type: raw[i].type, content: raw[i].content });
    }

    hunks.push({ oldStart, newStart, lines });
  }

  return hunks;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  if (m > 5000 || n > 5000) {
    return fastLcs(a, b);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function fastLcs(a: string[], b: string[]): string[] {
  const bIndex = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    if (!bIndex.has(b[j])) bIndex.set(b[j], []);
    bIndex.get(b[j])!.push(j);
  }

  const result: string[] = [];
  let lastJ = -1;

  for (let i = 0; i < a.length; i++) {
    const positions = bIndex.get(a[i]);
    if (!positions) continue;

    for (const j of positions) {
      if (j > lastJ) {
        result.push(a[i]);
        lastJ = j;
        break;
      }
    }
  }

  return result;
}
