import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

export interface CacheEntry {
  content: string;
  hash: string;
  readAt: number;
  turnIndex: number;
  sizeBytes: number;
  lineCount: number;
}

export interface CacheStats {
  totalReads: number;
  cacheHits: number;
  cacheMisses: number;
  estimatedTokensSaved: number;
  filesTracked: number;
}

const CHARS_PER_TOKEN = 4;

export class SessionCache {
  private entries = new Map<string, CacheEntry>();
  private turnCounter = 0;
  private totalReads = 0;
  private cacheHits = 0;

  nextTurn(): void {
    this.turnCounter++;
  }

  async checkFile(path: string): Promise<{ cached: boolean; changed: boolean; entry?: CacheEntry }> {
    this.totalReads++;
    const existing = this.entries.get(path);

    if (!existing) {
      return { cached: false, changed: true };
    }

    const currentHash = await this.hashFile(path);
    if (currentHash === existing.hash) {
      this.cacheHits++;
      return { cached: true, changed: false, entry: existing };
    }

    return { cached: true, changed: true, entry: existing };
  }

  store(path: string, content: string): CacheEntry {
    const hash = createHash('md5').update(content).digest('hex');
    const entry: CacheEntry = {
      content,
      hash,
      readAt: Date.now(),
      turnIndex: this.turnCounter,
      sizeBytes: Buffer.byteLength(content),
      lineCount: content.split('\n').length,
    };
    this.entries.set(path, entry);
    return entry;
  }

  getEntry(path: string): CacheEntry | undefined {
    return this.entries.get(path);
  }

  turnsAgo(entry: CacheEntry): number {
    return this.turnCounter - entry.turnIndex;
  }

  getStats(): CacheStats {
    let estimatedTokensSaved = 0;
    for (const entry of this.entries.values()) {
      const tokensPerRead = Math.ceil(entry.content.length / CHARS_PER_TOKEN);
      const hitCount = Math.max(0, this.cacheHits);
      estimatedTokensSaved += tokensPerRead;
    }

    const totalCachedChars = Array.from(this.entries.values())
      .reduce((sum, e) => sum + e.content.length, 0);
    estimatedTokensSaved = Math.ceil(
      (totalCachedChars / CHARS_PER_TOKEN) * (this.cacheHits / Math.max(1, this.totalReads))
    );

    return {
      totalReads: this.totalReads,
      cacheHits: this.cacheHits,
      cacheMisses: this.totalReads - this.cacheHits,
      estimatedTokensSaved,
      filesTracked: this.entries.size,
    };
  }

  clear(): void {
    this.entries.clear();
    this.totalReads = 0;
    this.cacheHits = 0;
  }

  private async hashFile(path: string): Promise<string> {
    try {
      const content = await readFile(path, 'utf-8');
      return createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }
}
