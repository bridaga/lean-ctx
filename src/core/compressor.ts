import type { CompressionPattern } from '../patterns/index.js';

export interface CompressResult {
  output: string;
  originalLength: number;
  compressedLength: number;
  reductionPercent: number;
}

export class Compressor {
  private patterns: CompressionPattern[] = [];

  registerPattern(pattern: CompressionPattern): void {
    this.patterns.push(pattern);
  }

  registerPatterns(patterns: CompressionPattern[]): void {
    for (const p of patterns) {
      this.patterns.push(p);
    }
  }

  compressCode(content: string, aggressive = false): CompressResult {
    const original = content;
    let result = content;

    result = this.collapseEmptyLines(result);
    result = this.removeRedundantComments(result);

    if (aggressive) {
      result = this.reduceIndentation(result);
      result = this.stripObviousTypes(result);
      result = this.collapseSimpleBlocks(result);
      result = this.removeTrailingWhitespace(result);
    }

    return this.buildResult(original, result);
  }

  compressShellOutput(command: string, output: string): CompressResult {
    const original = output;
    let result = this.stripAnsiCodes(output);

    const matchedPattern = this.patterns.find((p) => p.matches(command));
    if (matchedPattern) {
      result = matchedPattern.compress(result);
    } else {
      result = this.genericCompress(result);
    }

    return this.buildResult(original, result);
  }

  private stripAnsiCodes(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  private collapseEmptyLines(text: string): string {
    return text.replace(/\n{3,}/g, '\n\n');
  }

  private removeRedundantComments(text: string): string {
    const lines = text.split('\n');
    const filtered: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (this.isRedundantComment(trimmed, lines[i + 1]?.trim())) {
        continue;
      }
      filtered.push(lines[i]);
    }

    return filtered.join('\n');
  }

  private isRedundantComment(comment: string, nextLine?: string): boolean {
    if (!comment.startsWith('//') && !comment.startsWith('#') && !comment.startsWith('*')) {
      return false;
    }

    const commentPatterns = [
      /^\/\/\s*(import|export|define|return|handle|increment|decrement|set|get|create|update|delete|remove|add)\s/i,
      /^\/\/\s*---+\s*$/,
      /^#\s*(import|export|define|return|handle)\s/i,
    ];

    return commentPatterns.some((p) => p.test(comment));
  }

  private genericCompress(text: string): string {
    let result = text;
    result = this.collapseEmptyLines(result);
    result = this.collapseRepeatedLines(result);
    result = this.removeProgressIndicators(result);
    return result.trim();
  }

  private collapseRepeatedLines(text: string): string {
    const lines = text.split('\n');
    if (lines.length < 5) return text;

    const result: string[] = [];
    let repeatCount = 0;
    let lastLine = '';

    for (const line of lines) {
      if (line === lastLine) {
        repeatCount++;
      } else {
        if (repeatCount > 2) {
          result.push(`  ... (${repeatCount} identical lines omitted)`);
        } else {
          for (let i = 0; i < repeatCount; i++) {
            result.push(lastLine);
          }
        }
        result.push(line);
        repeatCount = 0;
      }
      lastLine = line;
    }

    if (repeatCount > 2) {
      result.push(`  ... (${repeatCount} identical lines omitted)`);
    }

    return result.join('\n');
  }

  private removeProgressIndicators(text: string): string {
    const lines = text.split('\n');
    return lines
      .filter((line) => {
        const trimmed = line.trim();
        if (/^\[?[#=\-]+\]?\s*\d+%/.test(trimmed)) return false;
        if (/^[\s]*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣾⣽⣻⢿⡿⣟⣯⣷]/.test(trimmed)) return false;
        if (/^(Downloading|Extracting|Progress).*\d+%/.test(trimmed)) return false;
        return true;
      })
      .join('\n');
  }

  private reduceIndentation(text: string): string {
    return text.replace(/^( {4}|\t)/gm, '  ').replace(/^( {2}) {2}/gm, '$1');
  }

  private stripObviousTypes(text: string): string {
    const lines = text.split('\n');
    return lines
      .map((line) => {
        let result = line;
        result = result.replace(/:\s*string\s*=\s*(['"`])/g, '= $1');
        result = result.replace(/:\s*number\s*=\s*(\d)/g, '= $1');
        result = result.replace(/:\s*boolean\s*=\s*(true|false)/g, '= $1');
        result = result.replace(/:\s*void\s*(?={|$)/g, ' ');
        return result;
      })
      .join('\n');
  }

  private collapseSimpleBlocks(text: string): string {
    return text.replace(
      /\{\n\s*(return [^\n]{1,60};)\n\s*\}/g,
      '{ $1 }'
    );
  }

  private removeTrailingWhitespace(text: string): string {
    return text.replace(/[ \t]+$/gm, '');
  }

  private buildResult(original: string, compressed: string): CompressResult {
    const originalLength = original.length;
    const compressedLength = compressed.length;
    const reductionPercent =
      originalLength > 0
        ? Math.round(((originalLength - compressedLength) / originalLength) * 100)
        : 0;

    return { output: compressed, originalLength, compressedLength, reductionPercent };
  }
}
