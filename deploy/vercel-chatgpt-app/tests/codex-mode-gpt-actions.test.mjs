import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeCodexModeRead,
  canonicalJson,
  jsonDigest,
  loadCodexModeEvidence,
  loadCodexModeSnapshot,
  loadCodexModeStatus,
} from "../lib/codex-mode-gpt-actions.js";

function encoded(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

const state = {
  schema: "akashic.codex-mode-state/v1.1",
  mode_id: "codex-mode",
  observed_at: "2026-08-16T00:00:00Z",
  freshness_ttl_seconds: 900,
  phase: "OFFICIAL_PROVIDER_CERTIFICATION",
  status: "PROVIDER_ATTEMPTED_FAILED_AND_BLOCKED",
  certification: "OPEN",
  current_role: "SUPERVISOR",
  source: {
    reconciled_against_main_head: "main-old",
    provider_branch: "akashic/provider",
    provider_pull_request: { number: 15 },
  },
  blockers: [{ hard: true, description: "credential missing" }],
  next_actions: [
    {
      action_id: "diagnose",
      title: "Diagnose retained evidence",
      assistant_executable_now: true,
    },
  ],
  status_card: { evidence: "evidence/latest.json" },
  provider_attempts: [
    {
      attempt_id: "attempt-1",
      status: "FAILED",
      evidence_path: "evidence/latest.json",
      source_commit: "provider-head",
    },
  ],
  capabilities: { valid_certification_receipt: false },
};

const handoff = { schema: "akashic.codex-mode-handoff/v1", role: "SUPERVISOR" };
const manifest = { schema: "akashic.codex-mode-manifest/v1" };
const attemptEvidence = { schema: "attempt/v1", status: "FAILED" };

function fakeFetch(url) {
  const value = String(url);
  let body;
  if (value.includes("/contents/docs/modes/CODEX_MODE_STATE.json")) {
    body = {
      encoding: "base64",
      content: encoded(state),
      sha: "state-blob",
      html_url: "https://example/state",
    };
  } else if (value.includes("/contents/docs/modes/CODEX_MODE_HANDOFF.json")) {
    body = {
      encoding: "base64",
      content: encoded(handoff),
      sha: "handoff-blob",
      html_url: "https://example/handoff",
    };
  } else if (
    value.includes("/contents/docs/modes/MANIFEST_CODEX_MODE_20260816.json")
  ) {
    body = {
      encoding: "base64",
      content: encoded(manifest),
      sha: "manifest-blob",
      html_url: "https://example/manifest",
    };
  } else if (value.includes("/contents/evidence/latest.json")) {
    body = {
      encoding: "base64",
      content: encoded(attemptEvidence),
      sha: "evidence-blob",
      html_url: "https://example/evidence",
    };
  } else if (value.includes("/git/ref/heads/main")) {
    body = { object: { sha: "main-live" } };
  } else if (value.includes("/git/ref/heads/akashic/provider")) {
    body = { object: { sha: "provider-head" } };
  } else if (value.includes("/pulls/15")) {
    body = {
      number: 15,
      state: "open",
      draft: true,
      merged_at: null,
      head: { sha: "provider-head" },
      base: { sha: "main-live" },
      html_url: "https://example/pr/15",
    };
  } else if (value.includes("/compare/main-old...main-live")) {
    body = { status: "ahead" };
  } else {
    return Promise.resolve(
      new Response(JSON.stringify({ message: `unmatched ${value}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

test("canonical digest is key-order independent", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(jsonDigest({ b: 2, a: 1 }), jsonDigest({ a: 1, b: 2 }));
});

test("read auth is fail-closed when bearer mode is configured", () => {
  const env = {
    AKASHIC_GATEWAY_AUTH_MODE: "bearer",
    AKASHIC_GATEWAY_BEARER_TOKEN: "secret",
  };
  assert.throws(
    () => authorizeCodexModeRead(new Request("https://example.test"), env),
    /unauthorized/,
  );
  assert.equal(
    authorizeCodexModeRead(
      new Request("https://example.test", {
        headers: { authorization: "Bearer secret" },
      }),
      env,
    ),
    true,
  );
});

test("boot snapshot reconciles live refs and exposes one next action", async () => {
  const result = await loadCodexModeSnapshot({
    fetchImpl: fakeFetch,
    env: {
      AKASHIC_GITHUB_REPOSITORY: "owner/repo",
      AKASHIC_GITHUB_DEFAULT_BRANCH: "main",
    },
    now: Date.parse("2026-08-16T00:01:00Z"),
  });
  assert.equal(result.ok, true);
  assert.equal(result.live.main_head, "main-live");
  assert.equal(result.live.state_snapshot_relation, "ANCESTOR");
  assert.equal(result.status_card.next_action_id, "diagnose");
  assert.equal(result.status_card.status, state.status);
  assert.equal(result.handoff.schema, handoff.schema);
});

test("evidence route reads only state-referenced provider evidence", async () => {
  const result = await loadCodexModeEvidence({
    fetchImpl: fakeFetch,
    env: {
      AKASHIC_GITHUB_REPOSITORY: "owner/repo",
      AKASHIC_GITHUB_DEFAULT_BRANCH: "main",
    },
  });
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].evidence.status, "FAILED");
  assert.equal(result.valid_certification_receipt, false);
});

test("status projection is compact and omits mutable full documents", async () => {
  const result = await loadCodexModeStatus({
    fetchImpl: fakeFetch,
    env: {
      AKASHIC_GITHUB_REPOSITORY: "owner/repo",
      AKASHIC_GITHUB_DEFAULT_BRANCH: "main",
    },
    now: Date.parse("2026-08-16T00:01:00Z"),
  });
  assert.equal(result.schema, "akashic.codex-mode-status-response/v1");
  assert.equal(result.status_card.next_action_id, "diagnose");
  assert.equal(Object.hasOwn(result, "state"), false);
  assert.equal(Object.hasOwn(result, "handoff"), false);
  assert.equal(Object.hasOwn(result, "manifest"), false);
});
