#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JSON CLI wrapper for sovereign_search.py.

This is intentionally boring:
- stdin/flags in
- JSON out
- shell=False
- bounded query/top/timeouts
- all failures are JSON
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


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

    raise RunnerError(
        "Could not find sovereign-search. Set SOVEREIGN_SEARCH_BIN or place sovereign_search.py at repository root."
    )


def clamp_int(value: Any, name: str, lo: int, hi: int) -> int:
    try:
        ivalue = int(value)
    except Exception as exc:
        raise InputError(f"{name} must be an integer") from exc
    if ivalue < lo or ivalue > hi:
        raise InputError(f"{name} must be between {lo} and {hi}")
    return ivalue


def build_argv(payload: dict[str, Any]) -> list[str]:
    query = str(payload.get("query") or "").strip()
    if not query:
        raise InputError("query is required")
    if len(query) > 2000:
        raise InputError("query is too long; keep it <= 2000 chars")

    source = payload.get("source", "all")
    if source not in ("all", "github", "akashic", "hf"):
        raise InputError("source must be one of: all, github, akashic, hf")

    top = clamp_int(payload.get("top", 12), "top", 1, 50)
    github_per_page = clamp_int(payload.get("github_per_page", 20), "github_per_page", 1, 100)
    graph_depth = clamp_int(payload.get("graph_depth", 1), "graph_depth", 0, 4)

    argv = resolve_runner()
    argv += [
        query,
        "--json",
        "--top", str(top),
        "--github-per-page", str(github_per_page),
        "--graph-depth", str(graph_depth),
    ]

    if source == "github":
        argv.append("--github-only")
    elif source == "akashic":
        argv.append("--akashic-only")
    elif source == "hf":
        argv.append("--hf-only")
    elif payload.get("no_hf", False):
        argv.append("--no-hf")

    db = payload.get("db")
    if db:
        argv += ["--db", str(Path(str(db)).expanduser())]

    return argv


def run(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        timeout_sec = clamp_int(payload.get("timeout_sec", 90), "timeout_sec", 5, 600)
        argv = build_argv(payload)
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
        data = json.loads(stdout) if stdout else {}
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
        "query": data.get("query", payload.get("query")),
        "tokens": data.get("tokens", []),
        "sources": data.get("sources", []),
        "results": data.get("results", []),
        "dedup_count": data.get("dedup_count", 0),
        "total_candidates": data.get("total_candidates", 0),
        "diagnostics": {
            "stderr": stderr[-4000:],
            "argv": argv,
            "returncode": proc.returncode,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="JSON tool wrapper for sovereign-search")
    parser.add_argument("--query", help="Search query. If omitted, reads a JSON object from stdin.")
    parser.add_argument("--top", type=int, default=12)
    parser.add_argument("--source", choices=["all", "github", "akashic", "hf"], default="all")
    parser.add_argument("--no-hf", action="store_true")
    parser.add_argument("--github-per-page", type=int, default=20)
    parser.add_argument("--graph-depth", type=int, default=1)
    parser.add_argument("--db")
    parser.add_argument("--timeout-sec", type=int, default=90)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.query:
        payload: dict[str, Any] = {
            "query": args.query,
            "top": args.top,
            "source": args.source,
            "no_hf": args.no_hf,
            "github_per_page": args.github_per_page,
            "graph_depth": args.graph_depth,
            "db": args.db,
            "timeout_sec": args.timeout_sec,
        }
    else:
        raw = sys.stdin.read().strip()
        if not raw:
            print(json.dumps({"ok": False, "error": "missing_input", "message": "provide --query or JSON on stdin"}, ensure_ascii=False))
            return 2
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            print(json.dumps({"ok": False, "error": "invalid_input_json", "message": str(exc)}, ensure_ascii=False))
            return 2
        if not isinstance(payload, dict):
            print(json.dumps({"ok": False, "error": "invalid_input", "message": "stdin JSON must be an object"}, ensure_ascii=False))
            return 2

    result = run(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
