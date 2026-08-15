export function sanitize(value, depth = 0) {
  if (depth > 8) return "[truncated]";
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 256).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 256)) {
      if (!/token|secret|password|authorization|cookie|credential/i.test(key)) {
        output[key] = sanitize(item, depth + 1);
      }
    }
    return output;
  }
  return String(value);
}

export function controlUrl() {
  const raw = (process.env.AKASHIC_CONTROL_URL ?? process.env.AKASHIC_RUNNER_URL ?? "").trim();
  if (!raw) {
    throw Object.assign(new Error("AKASHIC_CONTROL_URL is not configured"), {
      code: "control_not_configured",
    });
  }
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.username || url.password) {
    throw Object.assign(new Error("control URL credentials are forbidden"), {
      code: "invalid_control_url",
    });
  }
  if (!["http:", "https:"].includes(url.protocol) || (url.protocol !== "https:" && !local)) {
    throw Object.assign(new Error("remote control service must use HTTPS"), {
      code: "invalid_control_url",
    });
  }
  const allowlist = (process.env.AKASHIC_CONTROL_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0 && !local && !allowlist.includes(url.hostname.toLowerCase())) {
    throw Object.assign(new Error("control host is not allowlisted"), {
      code: "control_host_not_allowed",
    });
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

export const runnerUrl = controlUrl;

export function mutationsEnabled() {
  return String(process.env.AKASHIC_MUTATIONS_ENABLED ?? "false").toLowerCase() === "true";
}

export const mutations = mutationsEnabled;

export function requireMutation() {
  if (!mutationsEnabled()) {
    throw Object.assign(
      new Error("mutating tools are disabled until authenticated explicitly"),
      { code: "mutations_disabled" },
    );
  }
}
