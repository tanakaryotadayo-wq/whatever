import assert from "node:assert/strict";
import test from "node:test";

const enabled = process.env.AKASHIC_CODEX_LIVE === "1";

test("official Codex App Server live certification is an explicit provider gate", { skip: !enabled }, () => {
  // The actual three-run certification is executed by
  // scripts/codex-app-server-live-two-turn.mjs on the self-hosted runner.
  assert.equal(process.env.AKASHIC_CODEX_LIVE, "1");
});
