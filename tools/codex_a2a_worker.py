#!/usr/bin/env python3
"""Deprecated v0.6 task-wide Codex gateway.

The implementation remains available in Git history, but running it would create
an ambiguous second task lifecycle beside Temporal. Akashic v0.7 uses:

- `workflows/temporal/src/control-server.ts` for tasks/send|get|update|cancel;
- `workers/codex/stateful_turn_worker.py` for one idempotent agent turn;
- `scripts/codex_live_two_turn.py` for official Codex app-server acceptance.
"""

from __future__ import annotations

import sys

MESSAGE = """codex_a2a_worker.py is retired in Akashic v0.7.

Do not run a task-wide synchronous Codex server beside Temporal.
Use:
  make bootstrap
  cd workflows/temporal && npm run worker
  cd workflows/temporal && npm run control

For official binary acceptance:
  make test-codex-live
"""


def main() -> int:
    sys.stderr.write(MESSAGE)
    return 64


if __name__ == "__main__":
    raise SystemExit(main())
