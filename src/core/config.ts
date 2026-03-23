import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface LeanCtxConfig {
  ignore: string[];
  compress: {
    removeEmptyLines: boolean;
    removeRedundantComments: boolean;
    maxFileLines: number;
  };
  patterns: {
    npm: boolean;
    git: boolean;
    docker: boolean;
    typescript: boolean;
  };
}

const DEFAULT_CONFIG: LeanCtxConfig = {
  ignore: ['node_modules', '.git', 'dist', 'build', '.svelte-kit', '__pycache__', '.next'],
  compress: {
    removeEmptyLines: true,
    removeRedundantComments: true,
    maxFileLines: 500,
  },
  patterns: {
    npm: true,
    git: true,
    docker: true,
    typescript: true,
  },
};

export async function loadConfig(projectRoot: string): Promise<LeanCtxConfig> {
  const configPath = join(projectRoot, 'lean-ctx.config.json');

  try {
    const raw = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(raw) as Partial<LeanCtxConfig>;
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function mergeConfig(defaults: LeanCtxConfig, overrides: Partial<LeanCtxConfig>): LeanCtxConfig {
  return {
    ignore: overrides.ignore ?? defaults.ignore,
    compress: { ...defaults.compress, ...overrides.compress },
    patterns: { ...defaults.patterns, ...overrides.patterns },
  };
}
