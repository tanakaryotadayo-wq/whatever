import { timingSafeEqual } from "node:crypto";

export function sanitize(v, depth = 0) {
  if (depth > 8) return "[truncated]";
  if (v === null || ["string", "number", "boolean"].includes(typeof v)) return v;
  if (Array.isArray(v)) return v.slice(0, 256).map((x) => sanitize(x, depth + 1));
  if (typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 256)) {
      if (!/token|secret|password|authorization|cookie|api[-_]?key/i.test(k)) {
        o[k] = sanitize(x, depth + 1);
      }
    }
    return o;
  }
  return String(v);
}

export function runnerUrl(env = process.env) {
  const raw = (env.AKASHIC_RUNNER_URL ?? "").trim();
  if (!raw) {
    throw Object.assign(new Error("AKASHIC_RUNNER_URL is not configured"), {
      code: "runner_not_configured",
    });
  }
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    (u.protocol !== "https:" && !local)
  ) {
    throw Object.assign(new Error("remote runner must use HTTPS"), {
      code: "invalid_runner_url",
    });
  }
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.search = "";
  u.hash = "";
  return u;
}

export function mutations(env = process.env) {
  return String(env.AKASHIC_MUTATIONS_ENABLED ?? "false").toLowerCase() === "true";
}

export function gatewayAuthMode(env = process.env) {
  return String(env.AKASHIC_GATEWAY_AUTH_MODE ?? "none").toLowerCase();
}

function equalSecret(actual, expected) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyGatewayRequest(request, env = process.env) {
  const mode = gatewayAuthMode(env);
  if (mode === "none") return true;
  if (mode !== "bearer") {
    throw Object.assign(new Error(`unsupported gateway auth mode: ${mode}`), {
      code: "unsupported_auth_mode",
    });
  }
  const expected = env.AKASHIC_GATEWAY_BEARER_TOKEN;
  if (!expected) {
    throw Object.assign(new Error("bearer auth token is not configured"), {
      code: "auth_not_configured",
    });
  }
  const actual = request?.headers?.get?.("authorization") ?? "";
  return equalSecret(actual, `Bearer ${expected}`);
}

export function requireMutation(env = process.env) {
  if (!mutations(env)) {
    throw Object.assign(
      new Error("mutating tools are disabled until authenticated explicitly"),
      { code: "mutations_disabled" },
    );
  }
  const mode = gatewayAuthMode(env);
  if (mode === "none") {
    throw Object.assign(
      new Error("mutations require a configured authentication mode"),
      { code: "auth_not_configured" },
    );
  }
  if (mode === "bearer" && !env.AKASHIC_GATEWAY_BEARER_TOKEN) {
    throw Object.assign(new Error("bearer auth token is not configured"), {
      code: "auth_not_configured",
    });
  }
}

export function requireAuthorizedMutation(request, env = process.env) {
  requireMutation(env);
  if (!verifyGatewayRequest(request, env)) {
    throw Object.assign(new Error("unauthorized"), {
      code: "unauthorized",
      status: 401,
    });
  }
}

export function errorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = typeof error?.code === "string" ? error.code : "internal_error";
  const message = error instanceof Error ? error.message : String(error);
  return Response.json(
    { ok: false, error: { code, message, details: sanitize(error?.details ?? null) } },
    { status },
  );
}
