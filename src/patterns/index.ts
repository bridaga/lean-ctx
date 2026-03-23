export interface CompressionPattern {
  name: string;
  matches(command: string): boolean;
  compress(output: string): string;
}

export { npmPattern } from './npm.js';
export { gitPattern } from './git.js';
export { dockerPattern } from './docker.js';
export { typescriptPattern } from './typescript.js';

import { npmPattern } from './npm.js';
import { gitPattern } from './git.js';
import { dockerPattern } from './docker.js';
import { typescriptPattern } from './typescript.js';

export function getAllPatterns(): CompressionPattern[] {
  return [npmPattern, gitPattern, dockerPattern, typescriptPattern];
}
