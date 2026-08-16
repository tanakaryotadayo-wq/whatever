#!/usr/bin/env bash
set -euo pipefail

if ! command -v codex >/dev/null 2>&1; then
  echo '{"status":"SKIPPED","reason":"codex binary not found","exit_code":77}'
  exit 77
fi
if [[ "${AKASHIC_CODEX_LIVE:-0}" != "1" ]]; then
  echo '{"status":"SKIPPED","reason":"set AKASHIC_CODEX_LIVE=1 to authorize a real subscription-auth run","exit_code":77}'
  exit 77
fi

mkdir -p evidence/codex-live-two-turn
codex --version | tee evidence/codex-live-two-turn/codex-version.txt
codex app-server --help > evidence/codex-live-two-turn/app-server-help.txt 2>&1
node --test \
  packages/codex-app-server-adapter/test/protocol.test.mjs \
  packages/codex-app-server-adapter/test/two-turn.fixture.test.mjs
CODEX_LIVE_RUNS=3 node scripts/codex-app-server-live-two-turn.mjs \
  | tee evidence/codex-live-two-turn/live-run-summary.jsonl
