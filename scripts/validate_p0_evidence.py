#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".akashic-evidence" / "p0" / "manifest.json"
SUBJECTS = [
    "schemas/v1/akashic-contracts.schema.json",
    "packages/runtime/akashic_runtime.py",
    "workers/codex/stateful_turn_worker.py",
    "adapters/drive/drive_artifact_adapter.py",
    "workflows/temporal/src/workflows.ts",
    "workflows/temporal/src/control-server.ts",
    "deploy/vercel-chatgpt-app/app/api/mcp/route.js",
]


def digest(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def latest_live_codex_evidence() -> dict | None:
    root = ROOT / ".akashic-evidence" / "codex-live"
    if not root.exists():
        return None
    candidates = sorted(root.glob("*/evidence.json"), reverse=True)
    if not candidates:
        candidates = sorted(root.glob("evidence.json"), reverse=True)
    for candidate in candidates:
        try:
            return json.loads(candidate.read_text())
        except Exception:
            continue
    return None


def main() -> int:
    missing = [relative for relative in SUBJECTS if not (ROOT / relative).is_file()]
    if missing:
        raise SystemExit(f"missing P0 subjects: {missing}")

    live = latest_live_codex_evidence()
    live_status = "PASS" if live and live.get("status") == "PASS" else "NOT_RUN"
    report = {
        "schema": "akashic.p0-evidence-manifest/v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "scope": "contract + fixture vertical slice",
        "subjects": {relative: digest(ROOT / relative) for relative in SUBJECTS},
        "gates": {
            "contract_freeze": "PASS",
            "stateful_one_turn_worker": "PASS_BY_PRECEDING_TEST_SUITE",
            "temporal_fixture_two_turn": "PASS_BY_PRECEDING_TEST_SUITE",
            "stale_context_delta_rejection": "PASS_BY_PRECEDING_TEST_SUITE",
            "verification_and_fenced_adoption": "PASS_BY_PRECEDING_TEST_SUITE",
            "drive_adapter_contract": "PASS_BY_PRECEDING_TEST_SUITE",
            "official_codex_live_two_turn": live_status,
        },
        "claims": {
            "core_ci_is_live_codex_evidence": False,
            "drive_unit_test_is_live_drive_evidence": False,
            "production_ready": live_status == "PASS",
        },
        "external_gates": [] if live_status == "PASS" else [
            "Run `make test-codex-live` on an authenticated self-hosted Codex machine."
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
