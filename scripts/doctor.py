#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "AGENTS.md",
    "akashic.workspace.json",
    "schemas/v1/workspace.schema.json",
    "schemas/v1/akashic-contracts.schema.json",
    "packages/runtime/akashic_runtime.py",
    "workers/codex/stateful_turn_worker.py",
    "adapters/drive/drive_artifact_adapter.py",
    "workflows/temporal/src/workflows.ts",
    "workflows/temporal/src/control-server.ts",
    "deploy/vercel-chatgpt-app/app/api/mcp/route.js",
]


def main() -> int:
    errors: list[str] = []
    missing = [path for path in REQUIRED if not (ROOT / path).exists()]
    if missing:
        errors.append(f"missing files: {', '.join(missing)}")

    try:
        workspace = json.loads((ROOT / "akashic.workspace.json").read_text())
        workspace_schema = json.loads((ROOT / "schemas/v1/workspace.schema.json").read_text())
        Draft202012Validator(workspace_schema).validate(workspace)
        expected = "akashic/v0.7-canonical-temporal-final"
        if workspace["source_authority"]["integration_branch"] != expected:
            errors.append("workspace integration branch is not canonical v0.7 branch")
    except Exception as error:
        errors.append(f"workspace contract invalid: {error}")

    try:
        contracts = json.loads((ROOT / "schemas/v1/akashic-contracts.schema.json").read_text())
        Draft202012Validator.check_schema(contracts)
    except Exception as error:
        errors.append(f"contracts schema invalid: {error}")

    tools = {name: shutil.which(name) for name in ("python3", "node", "npm", "git")}
    for name, location in tools.items():
        if not location:
            errors.append(f"required tool unavailable: {name}")

    forbidden = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or "node_modules" in path.parts:
            continue
        if path.name in {".env", "credentials.json"} or path.name.endswith(".pem"):
            forbidden.append(str(path.relative_to(ROOT)))
    if forbidden:
        errors.append(f"secret-bearing files present: {', '.join(forbidden)}")

    report = {
        "schema": "akashic.doctor-report/v1",
        "ok": not errors,
        "root": str(ROOT),
        "required_files": len(REQUIRED),
        "tools": tools,
        "errors": errors,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
