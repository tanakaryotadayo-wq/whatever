# whatever

Build resilient language agents as graphs.

## Sovereign Search

This repository now includes a toolized `sovereign_search.py` surface for AI/CLI orchestration.

Core files:

- `sovereign_search.py` — unified search engine over GitHub, Hugging Face, and Akashic DB.
- `tools/sovereign_search_tool.py` — zero-MCP JSON CLI wrapper.
- `tools/sovereign_search_mcp.py` — MCP server wrapper.
- `.aicli/tools/sovereign_search.yaml` — AICLI tool declaration.
- `schemas/sovereign_search.openai.tool.json` — OpenAI-style function tool schema.
- `docs/sovereign_search.md` — usage and orchestration notes.

Quick check:

```bash
python3 tools/sovereign_search_tool.py --query "tauri pty session" --top 5
```

Self-test for the original engine:

```bash
python3 sovereign_search.py --self-test
```
