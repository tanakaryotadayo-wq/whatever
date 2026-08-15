import assert from "node:assert/strict";
import test from "node:test";
import { sanitize, runnerUrl, mutations, requireMutation } from "../lib/gateway-utils.js";

// ── sanitize ──────────────────────────────────────────────────────────────────

test("sanitize: scalars pass through unchanged", () => {
  assert.equal(sanitize(null), null);
  assert.equal(sanitize(42), 42);
  assert.equal(sanitize(true), true);
  assert.equal(sanitize("hello"), "hello");
});

test("sanitize: strips token/secret/password/authorization/cookie keys", () => {
  const out = sanitize({ token: "t", secret: "s", password: "p", authorization: "a", cookie: "c", ok: 1 });
  assert.deepEqual(out, { ok: 1 });
});

test("sanitize: truncates deeply nested objects at depth > 8", () => {
  let deep = { value: "leaf" };
  for (let i = 0; i < 10; i++) deep = { child: deep };
  const out = sanitize(deep);
  // depth 0-8 → object, depth 9 (>8) → "[truncated]"
  let cur = out;
  for (let i = 0; i < 9; i++) {
    assert.equal(typeof cur, "object", `depth ${i} should be object`);
    cur = cur.child;
  }
  assert.equal(cur, "[truncated]");
});

test("sanitize: array sliced to 256 entries", () => {
  const big = Array.from({ length: 300 }, (_, i) => i);
  const out = sanitize(big);
  assert.equal(out.length, 256);
});

// ── runnerUrl ─────────────────────────────────────────────────────────────────

test("runnerUrl: throws when AKASHIC_RUNNER_URL is unset", () => {
  delete process.env.AKASHIC_RUNNER_URL;
  assert.throws(() => runnerUrl(), /AKASHIC_RUNNER_URL is not configured/);
});

test("runnerUrl: rejects plain http for remote host", () => {
  process.env.AKASHIC_RUNNER_URL = "http://example.com/runner";
  assert.throws(() => runnerUrl(), /remote runner must use HTTPS/);
  delete process.env.AKASHIC_RUNNER_URL;
});

test("runnerUrl: accepts http for localhost", () => {
  process.env.AKASHIC_RUNNER_URL = "http://localhost:8080/runner/";
  const u = runnerUrl();
  assert.equal(u.hostname, "localhost");
  // trailing slash stripped from pathname
  assert.equal(u.pathname, "/runner");
  delete process.env.AKASHIC_RUNNER_URL;
});

test("runnerUrl: strips query and hash from returned URL", () => {
  process.env.AKASHIC_RUNNER_URL = "https://runner.example.com/path?q=1#frag";
  const u = runnerUrl();
  assert.equal(u.search, "");
  assert.equal(u.hash, "");
  delete process.env.AKASHIC_RUNNER_URL;
});

// ── mutations / requireMutation ───────────────────────────────────────────────

test("mutations: false by default", () => {
  delete process.env.AKASHIC_MUTATIONS_ENABLED;
  assert.equal(mutations(), false);
});

test("mutations: true only for explicit 'true'", () => {
  process.env.AKASHIC_MUTATIONS_ENABLED = "true";
  assert.equal(mutations(), true);
  process.env.AKASHIC_MUTATIONS_ENABLED = "TRUE";
  assert.equal(mutations(), true);
  process.env.AKASHIC_MUTATIONS_ENABLED = "1";
  assert.equal(mutations(), false);
  delete process.env.AKASHIC_MUTATIONS_ENABLED;
});

test("requireMutation: throws mutations_disabled when flag is off", () => {
  delete process.env.AKASHIC_MUTATIONS_ENABLED;
  assert.throws(() => requireMutation(), (err) => err.code === "mutations_disabled");
});

test("requireMutation: does not throw when mutations enabled", () => {
  process.env.AKASHIC_MUTATIONS_ENABLED = "true";
  assert.doesNotThrow(() => requireMutation());
  delete process.env.AKASHIC_MUTATIONS_ENABLED;
});
