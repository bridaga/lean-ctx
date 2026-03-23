# lean-ctx

Smart Context MCP Server that reduces LLM token consumption by **50-90%** on file reads, CLI output, and project exploration.

Unlike CLI proxies (e.g. RTK) that only compress shell output, lean-ctx works at the MCP level — it optimizes **all** context flowing to your LLM: file reads, directory listings, shell commands, and search results.

## How It Works

```
Cursor / Claude Code / any MCP client
        │
        ├── ctx_read   → cached file reads (90% savings on re-reads)
        ├── ctx_tree   → compact project maps (replaces ls/find)
        ├── ctx_shell  → compressed CLI output (60-90% savings)
        └── ctx_metrics → session statistics
```

### Key Differentiators vs. RTK

| Feature | RTK | lean-ctx |
|---------|-----|----------|
| Scope | CLI output only | Files + CLI + Search + Project context |
| Integration | Shell hook (Claude Code only) | MCP Server (Cursor, Claude Code, Windsurf, any MCP client) |
| Caching | None | Session-aware deduplication |
| Re-read savings | None | ~90% (returns "already in context") |
| Project awareness | None | Configurable per project |

## Quick Start

### 1. Install

```bash
cd /path/to/lean-ctx
npm install
npm run build
```

### 2. Add to Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lean-ctx": {
      "command": "node",
      "args": ["/absolute/path/to/lean-ctx/dist/index.js"],
      "env": {
        "LEAN_CTX_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

### 3. Add Cursor Rule (optional but recommended)

Create `.cursor/rules/lean-ctx.mdc` in your project:

```markdown
---
description: Token optimization via lean-ctx MCP server
globs: **/*
alwaysApply: true
---
When lean-ctx MCP tools are available, prefer them over built-in tools:
- Use ctx_read instead of Read for file reading (it caches and compresses)
- Use ctx_tree instead of ls/find for project exploration
- Use ctx_shell instead of Shell for CLI commands (it compresses output)
```

## Tools

### ctx_read — Smart File Read

Reads files with session caching. If the same file is requested again and hasn't changed, returns a short summary instead of the full content.

**Parameters:**
- `path` (string, required) — file path
- `query` (string, optional) — only return sections matching this query
- `force` (boolean, optional) — bypass cache

**First read:** Returns file content (with redundant comments and empty lines removed)

**Second read:** Returns `"File already in context (read N turns ago, X lines, unchanged)."` — saving ~90% tokens.

### ctx_tree — Project Map

Returns a compact directory tree, far more token-efficient than `ls -R` or `find`.

**Parameters:**
- `path` (string, optional) — root directory
- `depth` (number, optional) — max depth (default: 3)
- `show_sizes` (boolean, optional) — include file sizes and line counts
- `ignore` (string[], optional) — additional patterns to ignore

**Example output:**
```
my-project/
├── src/
│   ├── routes/ (8 files)
│   ├── lib/
│   │   ├── server/ (12 files)
│   │   └── components/ (8 files)
│   └── index.ts
├── package.json
└── tsconfig.json
```

### ctx_shell — Compressed Shell Execution

Executes shell commands and compresses the output using pattern-matched compression for common dev tools.

**Parameters:**
- `command` (string, required) — shell command
- `cwd` (string, optional) — working directory
- `timeout` (number, optional) — timeout in ms

**Supported patterns:**
- **npm/yarn/pnpm** — removes progress bars, funding notices, timing info
- **git** — compresses status (grouped by category), log (one-line format), diff (summary + hunks)
- **docker** — compresses build output (step count, cached layers), ps (container list)
- **tsc/svelte-check** — groups errors by type, deduplicates

**Example:**
```
$ npm install
added 234 packages in 3s
found 0 vulnerabilities
[lean-ctx: 78% compressed, 1200 → 264 chars]
```

### ctx_metrics — Session Statistics

Shows token savings for the current session.

```
lean-ctx Session Metrics
========================
Files tracked: 12
Total reads: 28
Cache hits: 16 (57%)
Cache misses: 12
Estimated tokens saved: ~8,400
```

## Configuration

Create `lean-ctx.config.json` in your project root:

```json
{
  "ignore": ["node_modules", ".git", "dist"],
  "compress": {
    "removeEmptyLines": true,
    "removeRedundantComments": true,
    "maxFileLines": 500
  },
  "patterns": {
    "npm": true,
    "git": true,
    "docker": true,
    "typescript": true
  }
}
```

## Architecture

```
lean-ctx/
├── src/
│   ├── index.ts              # MCP Server entry (McpServer + StdioTransport)
│   ├── tools/
│   │   ├── ctx-read.ts       # Smart file read with caching
│   │   ├── ctx-tree.ts       # Compact project structure
│   │   ├── ctx-shell.ts      # CLI output compression
│   │   └── ctx-metrics.ts    # Token savings report
│   ├── core/
│   │   ├── session-cache.ts  # In-memory cache with file hashes
│   │   ├── compressor.ts     # Pattern-based text compression
│   │   └── config.ts         # Project config loader
│   └── patterns/
│       ├── npm.ts            # npm/yarn/pnpm patterns
│       ├── git.ts            # git status/log/diff patterns
│       ├── docker.ts         # docker build/run patterns
│       ├── typescript.ts     # tsc/svelte-check patterns
│       └── index.ts          # Pattern registry
├── package.json
├── tsconfig.json
└── lean-ctx.config.example.json
```

## License

MIT
