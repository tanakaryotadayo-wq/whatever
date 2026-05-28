#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dry-run A2A-style gateway stub for a future Codex worker.

This file intentionally does not execute local commands. It validates the task
shape, returns the intended worker plan, and documents the contract expected by
an execution adapter.
"""
from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
AGENT_CARD_PATH = ROOT / "agents" / "codex.agent-card.json"
RESULT_SCHEMA_PATH = ROOT / "schemas" / "codex_result.schema.json"


def load_agent_card() -> dict[str, Any]:
    if AGENT_CARD_PATH.exists():
        return json.loads(AGENT_CARD_PATH.read_text(encoding="utf-8"))
    return {"name": "codex-worker", "version": "0.1.0"}


def sanitize_task_id(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "._-" else "-" for ch in value.strip())
    return cleaned[:120] or f"task-{int(time.time())}"


def extract_text(params: dict[str, Any]) -> str:
    msg = params.get("message") or {}
    parts = msg.get("parts") or []
    out: list[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str):
            out.append(part["text"])
    return "\n\n".join(out).strip()


def normalize_task(payload: dict[str, Any]) -> dict[str, Any]:
    if "goal" in payload:
        raw = payload
    else:
        params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
        metadata = params.get("metadata") if isinstance(params.get("metadata"), dict) else {}
        raw = {
            "task_id": payload.get("id") or metadata.get("task_id") or f"task-{int(time.time())}",
            "goal": extract_text(params) or metadata.get("goal") or "",
            "workspace": metadata.get("workspace") or ".",
            "mode": metadata.get("mode") or "implement",
            "sandbox": metadata.get("sandbox") or "workspace-write",
            "use_sovereign_search": metadata.get("use_sovereign_search", True),
            "constraints": metadata.get("constraints", []),
        }
    goal = str(raw.get("goal") or "").strip()
    if not goal:
        raise ValueError("goal is required")
    mode = raw.get("mode") or "implement"
    if mode not in ("research_then_implement", "implement", "review_diff"):
        raise ValueError("unsupported mode")
    sandbox = raw.get("sandbox") or "workspace-write"
    if sandbox not in ("read-only", "workspace-write"):
        raise ValueError("sandbox must be read-only or workspace-write for the stub")
    return {
        "task_id": sanitize_task_id(str(raw.get("task_id") or "task")),
        "goal": goal,
        "workspace": str(raw.get("workspace") or "."),
        "mode": mode,
        "sandbox": sandbox,
        "use_sovereign_search": bool(raw.get("use_sovereign_search", True)),
        "constraints": raw.get("constraints") or [],
    }


def make_plan(task: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "task_id": task["task_id"],
        "status": "dry_run",
        "message": "Stub accepted the task. A local execution adapter can translate this plan into codex exec.",
        "plan": {
            "workspace": task["workspace"],
            "mode": task["mode"],
            "sandbox": task["sandbox"],
            "use_sovereign_search": task["use_sovereign_search"],
            "result_schema": str(RESULT_SCHEMA_PATH),
            "artifacts_dir": str(ROOT / ".aicli" / "runs" / task["task_id"]),
            "local_adapter_contract": "Run Codex in the workspace, keep changes bounded, emit codex_result.schema.json, and preserve provenance."
        }
    }


def handle(payload: dict[str, Any]) -> dict[str, Any]:
    method = payload.get("method")
    if method == "agent.card":
        return {"ok": True, "result": load_agent_card()}
    if method in ("message.send", "tasks.send", "task.run") or "goal" in payload:
        return make_plan(normalize_task(payload))
    return {"ok": False, "error": "unsupported_method", "message": str(method)}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_json({"ok": True, "result": load_agent_card()})

    def do_POST(self) -> None:
        try:
            n = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            result = handle(payload)
            if "jsonrpc" in payload:
                result = {"jsonrpc": "2.0", "id": payload.get("id"), "result": result}
            self.send_json(result)
        except Exception as exc:
            self.send_json({"ok": False, "error": "bad_request", "message": str(exc)}, status=400)

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--once", help="Read one JSON task payload from a file and print dry-run plan")
    args = parser.parse_args()
    if args.once:
        print(json.dumps(handle(json.loads(Path(args.once).read_text(encoding="utf-8"))), ensure_ascii=False, indent=2))
        return 0
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"codex-a2a-worker-stub listening on http://{args.host}:{args.port}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
