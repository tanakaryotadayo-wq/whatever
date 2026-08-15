export function sanitize(v, depth = 0) {
  if (depth > 8) return "[truncated]";
  if (v === null || ["string", "number", "boolean"].includes(typeof v)) return v;
  if (Array.isArray(v)) return v.slice(0, 256).map((x) => sanitize(x, depth + 1));
  if (typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 256)) {
      if (!/token|secret|password|authorization|cookie/i.test(k)) o[k] = sanitize(x, depth + 1);
    }
    return o;
  }
  return String(v);
}

export function runnerUrl() {
  const raw = (process.env.AKASHIC_RUNNER_URL ?? "").trim();
  if (!raw) throw Object.assign(new Error("AKASHIC_RUNNER_URL is not configured"), { code: "runner_not_configured" });
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  if (!["http:", "https:"].includes(u.protocol) || (u.protocol !== "https:" && !local))
    throw Object.assign(new Error("remote runner must use HTTPS"), { code: "invalid_runner_url" });
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.search = "";
  u.hash = "";
  return u;
}

export function mutations() {
  return String(process.env.AKASHIC_MUTATIONS_ENABLED ?? "false").toLowerCase() === "true";
}

export function requireMutation() {
  if (!mutations())
    throw Object.assign(new Error("mutating tools are disabled until authenticated explicitly"), { code: "mutations_disabled" });
}
