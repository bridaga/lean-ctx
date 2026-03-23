export interface ExtractedSignature {
  type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'import' | 'export' | 'jsdoc' | 'component';
  name: string;
  signature: string;
  line: number;
}

export interface ExtractionResult {
  signatures: ExtractedSignature[];
  formatted: string;
  originalLines: number;
  extractedLines: number;
}

export function extractSignatures(content: string, filePath: string): ExtractionResult {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const lines = content.split('\n');

  let signatures: ExtractedSignature[];

  if (ext === 'svelte') {
    signatures = extractSvelteSignatures(lines);
  } else if (['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) {
    signatures = extractTypeScriptSignatures(lines);
  } else {
    signatures = extractGenericSignatures(lines);
  }

  const formatted = formatSignatures(signatures, filePath, lines.length);

  return {
    signatures,
    formatted,
    originalLines: lines.length,
    extractedLines: formatted.split('\n').length,
  };
}

function extractTypeScriptSignatures(lines: string[]): ExtractedSignature[] {
  const sigs: ExtractedSignature[] = [];
  let pendingJsdoc: string[] = [];
  let inJsdoc = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('/**')) {
      inJsdoc = true;
      pendingJsdoc = [trimmed];
      if (trimmed.endsWith('*/')) { inJsdoc = false; }
      continue;
    }
    if (inJsdoc) {
      pendingJsdoc.push(trimmed);
      if (trimmed.includes('*/')) inJsdoc = false;
      continue;
    }

    if (/^import\s/.test(trimmed)) {
      sigs.push({ type: 'import', name: '', signature: trimmed, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    const funcMatch = trimmed.match(
      /^(export\s+)?(async\s+)?function\s+(\w+)/
    );
    if (funcMatch) {
      const sig = extractUntilOpenBrace(lines, i);
      if (pendingJsdoc.length) {
        sigs.push({ type: 'jsdoc', name: '', signature: pendingJsdoc.join('\n'), line: i + 1 - pendingJsdoc.length });
      }
      sigs.push({ type: 'function', name: funcMatch[3], signature: sig, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    const arrowMatch = trimmed.match(
      /^(export\s+)?(const|let)\s+(\w+)\s*[=:]\s*.*(?:=>|\bfunction\b)/
    );
    if (arrowMatch) {
      const sig = extractUntilOpenBrace(lines, i);
      if (pendingJsdoc.length) {
        sigs.push({ type: 'jsdoc', name: '', signature: pendingJsdoc.join('\n'), line: i + 1 - pendingJsdoc.length });
      }
      sigs.push({ type: 'function', name: arrowMatch[3], signature: sig, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    const classMatch = trimmed.match(/^(export\s+)?(abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      if (pendingJsdoc.length) {
        sigs.push({ type: 'jsdoc', name: '', signature: pendingJsdoc.join('\n'), line: i + 1 - pendingJsdoc.length });
      }
      sigs.push({ type: 'class', name: classMatch[3], signature: trimmed, line: i + 1 });
      extractMethodSignatures(lines, i, sigs);
      pendingJsdoc = [];
      continue;
    }

    const interfaceMatch = trimmed.match(/^(export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      const block = extractBlock(lines, i);
      if (pendingJsdoc.length) {
        sigs.push({ type: 'jsdoc', name: '', signature: pendingJsdoc.join('\n'), line: i + 1 - pendingJsdoc.length });
      }
      sigs.push({ type: 'interface', name: interfaceMatch[2], signature: block, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    const typeMatch = trimmed.match(/^(export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      const sig = extractUntilSemicolon(lines, i);
      sigs.push({ type: 'type', name: typeMatch[2], signature: sig, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    const enumMatch = trimmed.match(/^(export\s+)?(const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      const block = extractBlock(lines, i);
      sigs.push({ type: 'enum', name: enumMatch[3], signature: block, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    const exportVarMatch = trimmed.match(/^export\s+(const|let|var)\s+(\w+)/);
    if (exportVarMatch && !arrowMatch) {
      sigs.push({ type: 'variable', name: exportVarMatch[2], signature: trimmed, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    if (/^export\s+(default\s+)?{/.test(trimmed) || /^export\s+default\s+/.test(trimmed)) {
      sigs.push({ type: 'export', name: 'default', signature: trimmed, line: i + 1 });
      pendingJsdoc = [];
      continue;
    }

    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      pendingJsdoc = [];
    }
  }

  return sigs;
}

function extractSvelteSignatures(lines: string[]): ExtractedSignature[] {
  const sigs: ExtractedSignature[] = [];
  let inScript = false;
  let scriptLines: string[] = [];
  let scriptStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/<script/.test(trimmed)) {
      inScript = true;
      scriptLines = [];
      scriptStart = i;
      if (trimmed.includes('context="module"') || trimmed.includes('lang="ts"')) {
        sigs.push({ type: 'component', name: 'script', signature: trimmed, line: i + 1 });
      }
      continue;
    }

    if (/<\/script>/.test(trimmed)) {
      inScript = false;
      const tsSigs = extractTypeScriptSignatures(scriptLines);
      for (const sig of tsSigs) {
        sig.line += scriptStart + 1;
        sigs.push(sig);
      }
      continue;
    }

    if (inScript) {
      scriptLines.push(lines[i]);
      continue;
    }

    if (/^\s*{#(if|each|await|key)\s/.test(lines[i])) {
      sigs.push({ type: 'component', name: 'template-logic', signature: trimmed, line: i + 1 });
    }
  }

  return sigs;
}

function extractGenericSignatures(lines: string[]): ExtractedSignature[] {
  const sigs: ExtractedSignature[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^(def|fn|func|function|class|struct|trait|impl|module|package)\s/.test(trimmed)) {
      sigs.push({ type: 'function', name: trimmed.split(/\s+/)[1] || '', signature: trimmed, line: i + 1 });
    }
  }

  return sigs;
}

function extractUntilOpenBrace(lines: string[], startLine: number): string {
  let result = '';
  for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
    result += (result ? ' ' : '') + lines[i].trim();
    if (result.includes('{') || result.includes('=>')) {
      return result.replace(/\{[\s\S]*$/, '{...}').trim();
    }
  }
  return result.trim();
}

function extractUntilSemicolon(lines: string[], startLine: number): string {
  let result = '';
  for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
    result += (result ? ' ' : '') + lines[i].trim();
    if (result.includes(';')) {
      return result.replace(/;[\s\S]*$/, ';').trim();
    }
  }
  return result.trim();
}

function extractBlock(lines: string[], startLine: number): string {
  let depth = 0;
  let started = false;
  const result: string[] = [];

  for (let i = startLine; i < Math.min(startLine + 50, lines.length); i++) {
    const line = lines[i];
    result.push(line);

    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      if (ch === '}') depth--;
    }

    if (started && depth <= 0) break;
  }

  return result.join('\n');
}

function extractMethodSignatures(lines: string[], classStart: number, sigs: ExtractedSignature[]): void {
  let depth = 0;
  let started = false;

  for (let i = classStart; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      if (ch === '}') depth--;
    }

    if (depth === 1 && started) {
      const methodMatch = trimmed.match(
        /^(public|private|protected|static|async|get|set|\s)*\s*(\w+)\s*\(/
      );
      if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[2])) {
        const sig = extractUntilOpenBrace(lines, i);
        sigs.push({ type: 'function', name: methodMatch[2], signature: `  ${sig}`, line: i + 1 });
      }
    }

    if (started && depth <= 0) break;
  }
}

function formatSignatures(sigs: ExtractedSignature[], filePath: string, totalLines: number): string {
  const fileName = filePath.split('/').pop() || filePath;
  const parts: string[] = [`// ${fileName} (${totalLines} lines) — signatures only`];

  let lastType = '';

  for (const sig of sigs) {
    if (sig.type === 'import') continue;

    if (sig.type !== lastType && lastType !== '' && sig.type !== 'jsdoc') {
      parts.push('');
    }

    parts.push(sig.signature);
    lastType = sig.type;
  }

  const importCount = sigs.filter((s) => s.type === 'import').length;
  if (importCount > 0) {
    parts.splice(1, 0, `// ${importCount} imports (omitted)`);
  }

  return parts.join('\n');
}
