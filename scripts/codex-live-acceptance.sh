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
mkdir -p .akashic-runtime/live-codex
codex --version | tee .akashic-runtime/live-codex/codex-version.txt
node scripts/codex-live-two-turn.mjs | tee .akashic-runtime/live-codex/result.json
