import assert from "node:assert/strict";
import test from "node:test";
import {
  gatewayAuthMode,
  mutations,
  requireAuthorizedMutation,
  requireMutation,
  runnerUrl,
  sanitize,
  verifyGatewayRequest,
} from "../lib/gateway-utils.js";

function requestWithAuthorization(value = null) {
  return new Request("https://gateway.example/api/mcp", {
    headers: value ? { authorization: value } : {},
  });
}

test("sanitize strips credential-like keys and bounds depth/arrays", () => {
  const deep = { token: "hidden", ok: true };
  let cursor = deep;
  for (let index = 0; index < 12; index += 1) {
    cursor.child = {};
    cursor = cursor.child;
  }
  const output = sanitize({ deep, values: Array.from({ length: 300 }, (_, i) => i) });
  assert.equal("token" in output.deep, false);
  assert.equal(output.deep.ok, true);
  assert.equal(output.values.length, 256);
  function containsTruncated(value) {
    if (value === "[truncated]") return true;
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some(containsTruncated);
  }
  assert.equal(containsTruncated(output.deep), true);
});

test("runnerUrl requires TLS remotely and permits localhost HTTP", () => {
  assert.throws(() => runnerUrl({}), /not configured/);
  assert.throws(
    () => runnerUrl({ AKASHIC_RUNNER_URL: "http://runner.example/base" }),
    /must use HTTPS/,
  );
  const local = runnerUrl({
    AKASHIC_RUNNER_URL: "http://localhost:8080/base/?query=1#fragment",
  });
  assert.equal(local.href, "http://localhost:8080/base");
});

test("mutation flag is explicit and authentication mode is normalized", () => {
  assert.equal(mutations({}), false);
  assert.equal(mutations({ AKASHIC_MUTATIONS_ENABLED: "TRUE" }), true);
  assert.equal(mutations({ AKASHIC_MUTATIONS_ENABLED: "1" }), false);
  assert.equal(gatewayAuthMode({}), "none");
  assert.equal(gatewayAuthMode({ AKASHIC_GATEWAY_AUTH_MODE: "BEARER" }), "bearer");
});

test("mutations fail closed without both enablement and authentication", () => {
  assert.throws(() => requireMutation({}), (error) => error.code === "mutations_disabled");
  assert.throws(
    () => requireMutation({ AKASHIC_MUTATIONS_ENABLED: "true" }),
    (error) => error.code === "auth_not_configured",
  );
  assert.throws(
    () =>
      requireMutation({
        AKASHIC_MUTATIONS_ENABLED: "true",
        AKASHIC_GATEWAY_AUTH_MODE: "bearer",
      }),
    (error) => error.code === "auth_not_configured",
  );
  assert.doesNotThrow(() =>
    requireMutation({
      AKASHIC_MUTATIONS_ENABLED: "true",
      AKASHIC_GATEWAY_AUTH_MODE: "bearer",
      AKASHIC_GATEWAY_BEARER_TOKEN: "secret",
    }),
  );
});

test("bearer verification and authorized mutation gate reject wrong callers", () => {
  const env = {
    AKASHIC_MUTATIONS_ENABLED: "true",
    AKASHIC_GATEWAY_AUTH_MODE: "bearer",
    AKASHIC_GATEWAY_BEARER_TOKEN: "top-secret",
  };
  assert.equal(
    verifyGatewayRequest(requestWithAuthorization("Bearer top-secret"), env),
    true,
  );
  assert.equal(
    verifyGatewayRequest(requestWithAuthorization("Bearer wrong"), env),
    false,
  );
  assert.throws(
    () => requireAuthorizedMutation(requestWithAuthorization("Bearer wrong"), env),
    (error) => error.code === "unauthorized" && error.status === 401,
  );
  assert.doesNotThrow(() =>
    requireAuthorizedMutation(
      requestWithAuthorization("Bearer top-secret"),
      env,
    ),
  );
});
