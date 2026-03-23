# lean-ctx

**Smart Context MCP Server** — reduces LLM token consumption by 89-99%.

Single Rust binary, zero runtime dependencies.

## Install

```bash
cargo install lean-ctx
```

Or download a prebuilt binary from [Releases](https://gitlab.pounce.ch/root/lean-ctx/-/releases).

## Configure

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lean-ctx": {
      "command": "lean-ctx"
    }
  }
}
```

### Claude Code

```bash
claude mcp add lean-ctx lean-ctx
```

### GitHub Copilot

Add to `.github/copilot/mcp.json`:

```json
{
  "servers": {
    "lean-ctx": {
      "command": "lean-ctx"
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "lean-ctx": {
      "command": "lean-ctx"
    }
  }
}
```

## 8 MCP Tools

| Tool | Description | Savings |
|---|---|---|
| `ctx_read` | Smart file read with 5 modes (full, signatures, diff, aggressive, entropy) | 74-99% |
| `ctx_tree` | Compact directory listing with file counts | 34-60% |
| `ctx_shell` | CLI output compression (git, npm, cargo, docker, tsc) | 70-89% |
| `ctx_search` | Regex search with compact results | 80-95% |
| `ctx_compress` | Context checkpoint from session cache | 90-99% |
| `ctx_benchmark` | Compare all strategies with tiktoken counts | — |
| `ctx_metrics` | Session statistics and savings report | — |
| `ctx_analyze` | Shannon entropy analysis + mode recommendation | — |

## How it works

lean-ctx sits between your AI editor and the LLM as an MCP server:

1. **Session Cache**: Every file read is hashed (MD5) and cached. Re-reads return `F1 [cached 2t 151L ∅]` (~13 tokens) instead of the full file.
2. **Signature Extraction**: `ctx_read --mode signatures` returns only function/class/type signatures.
3. **Diff Mode**: `ctx_read --mode diff` returns only changed lines since last read.
4. **Entropy Filtering**: Shannon entropy removes low-information lines; Jaccard similarity deduplicates patterns.
5. **CLI Compression**: `ctx_shell` recognizes git, npm, cargo, docker, and TypeScript output patterns.

## vs RTK

| Feature | RTK | lean-ctx |
|---|---|---|
| Architecture | Shell hook | MCP server (native) |
| File caching | ✗ | ✓ MD5 session cache |
| File compression | ✗ | ✓ 5 modes |
| CLI compression | ✓ | ✓ + cargo patterns |
| Context checkpoint | ✗ | ✓ ctx_compress |
| Token counting | Estimated | tiktoken-exact |
| Entropy analysis | ✗ | ✓ Shannon + Jaccard |
| Editors | Cursor (shell) | All MCP editors |

## License

MIT
