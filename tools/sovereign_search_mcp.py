#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Thin MCP server wrapper for sovereign_search.py / sovereign-search.

Install:
  python3 -m pip install mcp

Run:
  SOVEREIGN_SEARCH_BIN=/path/to/sovereign_search.py python3 tools/sovereign_search_mcp.py
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Literal

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Missing dependency: mcp. Install with: python3 -m pip install mcp", file=sys.stderr)
    raise

SourceMode = Literal["all", "github", "akashic", "hf"]
mcp = FastMCP("sovereign-search")


class ToolError(Exception):
    code = "tool_error"


class InputError(ToolError):
    code = "invalid_input"


class RunnerError(ToolError):
    code = "runner_not_found"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_runner() -> list[str]:
    configured = os.environ.get("SOVEREIGN_SEARCH_BIN")
    candidates: list[str] = []
    if configured:
        candidates.append(configured)
    candidates.append(str(repo_root() / "sovereign_search.py"))
    candidates.append(str(Path(__file__).resolve().with_name("sovereign_search.py")))
    for name in ("sovereign-search", "sovereign_search.py"):
        found = shutil.which(name)
        if found:
            candidates.append(found)

    for candidate in candidates:
        path = Path(candidate).expanduser()
        if path.exists() and path.is_file():
            if path.suffix == ".py" or not os.access(path, os.X_OK):
                return [sys.executable, str(path)]
            return [str(path)]
        if "/" not in candidate and shutil.which(candidate):
            return [candidate]

    raise RunnerError("Could not find sovereign-search. Set SOVEREIGN_SEARCH_BIN or place sovereign_search.py at repository root.")


def clamp_int(value: Any, name: str, lo: int, hi: int) -> int:
    try:
        ivalue = int(value)
    except Exception as exc:
        raise InputError(f"{name} must be an integer") from exc
    if ivalue < lo or ivalue > hi:
        raise InputError(f"{name} must be between {lo} and {hi}")
    return ivalue


def build_argv(
    *,
    query: str,
    top: int,
    source: SourceMode,
    no_hf: bool,
    github_per_page: int,
    graph_depth: int,
    db: str | None,
) -> list[str]:
    if not isinstance(query, str) or not query.strip():
        raise InputError("query is required")
    if len(query) > 2000:
        raise InputError("query is too long; keep it <= 2000 chars")
    if source not in ("all", "github", "akashic", "hf"):
        raise InputError("source must be one of: all, github, akashic, hf")

    top = clamp_int(top, "top", 1, 50)
    github_per_page = clamp_int(github_per_page, "github_per_page", 1, 100)
    graph_depth = clamp_int(graph_depth, "graph_depth", 0, 4)

    argv = resolve_runner()
    argv += [query, "--json", "--top", str(top), "--github-per-page", str(github_per_page), "--graph-depth", str(graph_depth)]

    if source == "github":
        argv.append("--github-only")
    elif source == "akashic":
        argv.append("--akashic-only")
    elif source == "hf":
        argv.append("--hf-only")
    elif no_hf:
        argv.append("--no-hf")

    if db:
        argv += ["--db", str(Path(db).expanduser())]

    return argv


def run_sovereign_search(
    *,
    query: str,
    top: int = 12,
    source: SourceMode = "all",
    no_hf: bool = False,
    github_per_page: int = 20,
    graph_depth: int = 1,
    db: str | None = None,
    timeout_sec: int = 90,
) -> dict[str, Any]:
    try:
        timeout_sec = clamp_int(timeout_sec, "timeout_sec", 5, 600)
        argv = build_argv(
            query=query,
            top=top,
            source=source,
            no_hf=no_hf,
            github_per_page=github_per_page,
            graph_depth=graph_depth,
            db=db,
        )
    except ToolError as exc:
        return {"ok": False, "error": exc.code, "message": str(exc)}
    except Exception as exc:
        return {"ok": False, "error": "prepare_error", "message": str(exc)}

    try:
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout_sec, shell=False)
    except subprocess.TimeoutExpired as exc:
        return {
            "ok": False,
            "error": "timeout",
            "message": f"sovereign-search timed out after {timeout_sec}s",
            "argv": argv,
            "stdout_tail": (exc.stdout or "")[-2000:] if isinstance(exc.stdout, str) else "",
            "stderr_tail": (exc.stderr or "")[-2000:] if isinstance(exc.stderr, str) else "",
        }
    except Exception as exc:
        return {"ok": False, "error": "execution_error", "message": str(exc), "argv": argv}

    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()

    if proc.returncode != 0:
        return {
            "ok": False,
            "error": "nonzero_exit",
            "returncode": proc.returncode,
            "argv": argv,
            "stdout_tail": stdout[-4000:],
            "stderr_tail": stderr[-4000:],
        }

    try:
        payload = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError as exc:
        return {
            "ok": False,
            "error": "invalid_json",
            "message": str(exc),
            "argv": argv,
            "stdout_tail": stdout[-4000:],
            "stderr_tail": stderr[-4000:],
        }

    return {
        "ok": True,
        "query": payload.get("query", query),
        "tokens": payload.get("tokens", []),
        "sources": payload.get("sources", []),
        "results": payload.get("results", []),
        "dedup_count": payload.get("dedup_count", 0),
        "total_candidates": payload.get("total_candidates", 0),
        "diagnostics": {
            "stderr": stderr[-4000:],
            "argv": argv,
            "returncode": proc.returncode,
        },
    }


@mcp.tool(description="Search GitHub, Hugging Face, and/or Akashic DB through sovereign-search and return ranked JSON results.")
def sovereign_search(
    query: str,
    top: int = 12,
    source: SourceMode = "all",
    no_hf: bool = False,
    github_per_page: int = 20,
    graph_depth: int = 1,
    db: str | None = None,
    timeout_sec: int = 90,
) -> dict[str, Any]:
    return run_sovereign_search(
        query=query,
        top=top,
        source=source,
        no_hf=no_hf,
        github_per_page=github_per_page,
        graph_depth=graph_depth,
        db=db,
        timeout_sec=timeout_sec,
    )


if __name__ == "__main__":
    mcp.run()
