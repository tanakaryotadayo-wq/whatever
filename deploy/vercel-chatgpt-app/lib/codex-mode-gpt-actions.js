import { createHash } from "node:crypto";
import {
  gatewayAuthMode,
  sanitize,
  verifyGatewayRequest,
} from "./gateway-utils.js";

const DEFAULT_REPOSITORY = "tanakaryotadayo-wq/whatever";
const DEFAULT_BRANCH = "main";

const MODE_PATHS = Object.freeze({
  state: "docs/modes/CODEX_MODE_STATE.json",
  handoff: "docs/modes/CODEX_MODE_HANDOFF.json",
  manifest: "docs/modes/MANIFEST_CODEX_MODE_20260816.json",
});

function encodePath(value) {
  return String(value)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function repositoryParts(env = process.env) {
  const raw = String(
    env.AKASHIC_GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY,
  ).trim();
  const parts = raw.split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw Object.assign(new Error("AKASHIC_GITHUB_REPOSITORY must be owner/repo"), {
      code: "invalid_github_repository",
      status: 500,
    });
  }
  return { owner: parts[0], repo: parts[1], full: raw };
}

function githubHeaders(env = process.env) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "akashic-codex-mode-gpt-actions",
    "x-github-api-version": "2022-11-28",
  };
  if (env.AKASHIC_GITHUB_TOKEN) {
    headers.authorization = `Bearer ${env.AKASHIC_GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubJson(url, { fetchImpl = fetch, env = process.env } = {}) {
  const response = await fetchImpl(url, {
    headers: githubHeaders(env),
    cache: "no-store",
    redirect: "error",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(
      new Error(body?.message ?? `GitHub returned HTTP ${response.status}`),
      {
        code: "github_read_failed",
        status: response.status === 404 ? 502 : response.status,
        details: { url: String(url), github_status: response.status },
      },
    );
  }
  return body;
}

async function fetchJsonFile(
  path,
  ref,
  { fetchImpl = fetch, env = process.env } = {},
) {
  const { owner, repo } = repositoryParts(env);
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
  );
  url.searchParams.set("ref", ref);
  const body = await githubJson(url, { fetchImpl, env });
  if (body?.encoding !== "base64" || typeof body?.content !== "string") {
    throw Object.assign(new Error(`GitHub file is not base64 content: ${path}`), {
      code: "invalid_github_file",
      status: 502,
    });
  }
  const text = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString(
    "utf8",
  );
  return {
    value: JSON.parse(text),
    blob_sha: body.sha,
    html_url: body.html_url,
    path,
    ref,
  };
}

async function fetchRef(
  branch,
  { fetchImpl = fetch, env = process.env } = {},
) {
  const { owner, repo } = repositoryParts(env);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodePath(branch)}`;
  const body = await githubJson(url, { fetchImpl, env });
  return body?.object?.sha ?? null;
}

async function fetchPullRequest(
  number,
  { fetchImpl = fetch, env = process.env } = {},
) {
  const { owner, repo } = repositoryParts(env);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`;
  const body = await githubJson(url, { fetchImpl, env });
  return {
    number: body.number,
    state: String(body.state ?? "").toUpperCase(),
    draft: Boolean(body.draft),
    merged: Boolean(body.merged_at),
    head_sha: body.head?.sha ?? null,
    base_sha: body.base?.sha ?? null,
    html_url: body.html_url ?? null,
  };
}

async function compareSnapshotToLive(
  snapshot,
  live,
  { fetchImpl = fetch, env = process.env } = {},
) {
  if (!snapshot || !live) return "UNKNOWN";
  if (snapshot === live) return "EQUAL";
  const { owner, repo } = repositoryParts(env);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(snapshot)}...${encodeURIComponent(live)}`;
  try {
    const body = await githubJson(url, { fetchImpl, env });
    if (body.status === "ahead") return "ANCESTOR";
    if (body.status === "identical") return "EQUAL";
    if (body.status === "behind") return "SNAPSHOT_AHEAD";
    if (body.status === "diverged") return "DIVERGED";
    return String(body.status ?? "UNKNOWN").toUpperCase();
  } catch {
    return "UNKNOWN";
  }
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function jsonDigest(value) {
  return `sha256:${createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex")}`;
}

export function authorizeCodexModeRead(request, env = process.env) {
  if (gatewayAuthMode(env) === "none") return true;
  if (!verifyGatewayRequest(request, env)) {
    throw Object.assign(new Error("unauthorized"), {
      code: "unauthorized",
      status: 401,
    });
  }
  return true;
}

function freshness(state, now = Date.now()) {
  const observed = Date.parse(state?.observed_at ?? "");
  const ttlMs = Number(state?.freshness_ttl_seconds ?? 0) * 1000;
  if (!Number.isFinite(observed) || ttlMs <= 0) {
    return { stale: true, age_seconds: null };
  }
  const age = Math.max(0, now - observed);
  return {
    stale: age > ttlMs,
    age_seconds: Math.floor(age / 1000),
  };
}

function chooseNextAction(state) {
  const actions = Array.isArray(state?.next_actions) ? state.next_actions : [];
  return (
    actions.find((action) => action?.assistant_executable_now === true) ??
    actions[0] ??
    null
  );
}

function statusCard(state, live) {
  const blocker =
    state?.blockers?.find((item) => item?.hard)?.description ??
    state?.status_card?.blocker ??
    "none";
  const nextAction = chooseNextAction(state);
  return {
    phase: state?.phase ?? "UNKNOWN",
    status: state?.status ?? "UNKNOWN",
    role: state?.current_role ?? "SUPERVISOR",
    blocker,
    next: nextAction?.title ?? state?.status_card?.next ?? "none",
    next_action_id: nextAction?.action_id ?? null,
    evidence: state?.status_card?.evidence ?? "none",
    certification: state?.certification ?? "OPEN",
    live,
  };
}

export async function loadCodexModeSnapshot({
  fetchImpl = fetch,
  env = process.env,
  includeHandoff = true,
  includeManifest = true,
  now = Date.now(),
} = {}) {
  const branch = String(env.AKASHIC_GITHUB_DEFAULT_BRANCH ?? DEFAULT_BRANCH);
  const stateFile = await fetchJsonFile(MODE_PATHS.state, branch, {
    fetchImpl,
    env,
  });
  const state = stateFile.value;
  const providerBranch = state?.source?.provider_branch;

  const [liveMain, liveProvider, pr, handoffFile, manifestFile] =
    await Promise.all([
      fetchRef(branch, { fetchImpl, env }),
      providerBranch
        ? fetchRef(providerBranch, { fetchImpl, env })
        : Promise.resolve(null),
      state?.source?.provider_pull_request?.number
        ? fetchPullRequest(state.source.provider_pull_request.number, {
            fetchImpl,
            env,
          })
        : Promise.resolve(null),
      includeHandoff
        ? fetchJsonFile(MODE_PATHS.handoff, branch, { fetchImpl, env })
        : Promise.resolve(null),
      includeManifest
        ? fetchJsonFile(MODE_PATHS.manifest, branch, { fetchImpl, env })
        : Promise.resolve(null),
    ]);

  const relation = await compareSnapshotToLive(
    state?.source?.reconciled_against_main_head,
    liveMain,
    { fetchImpl, env },
  );
  const live = {
    repository: repositoryParts(env).full,
    default_branch: branch,
    main_head: liveMain,
    state_snapshot_relation: relation,
    provider_branch: providerBranch ?? null,
    provider_head: liveProvider,
    provider_pr: pr,
  };
  const currentFreshness = freshness(state, now);
  return sanitize({
    ok: true,
    schema: "akashic.codex-mode-action-snapshot/v1",
    state_digest: jsonDigest(state),
    state_blob_sha: stateFile.blob_sha,
    freshness: currentFreshness,
    live,
    status_card: statusCard(state, live),
    state,
    handoff: handoffFile?.value ?? null,
    manifest: manifestFile?.value ?? null,
  });
}

export async function loadCodexModeStatus({
  fetchImpl = fetch,
  env = process.env,
  now = Date.now(),
} = {}) {
  const snapshot = await loadCodexModeSnapshot({
    fetchImpl,
    env,
    includeHandoff: false,
    includeManifest: false,
    now,
  });
  return sanitize({
    ok: true,
    schema: "akashic.codex-mode-status-response/v1",
    state_digest: snapshot.state_digest,
    freshness: snapshot.freshness,
    live: snapshot.live,
    status_card: snapshot.status_card,
    certification: snapshot.state?.certification ?? "OPEN",
    capabilities: snapshot.state?.capabilities ?? {},
    blockers: Array.isArray(snapshot.state?.blockers)
      ? snapshot.state.blockers
      : [],
    next_actions: Array.isArray(snapshot.state?.next_actions)
      ? snapshot.state.next_actions.slice(0, 3)
      : [],
  });
}

export async function loadCodexModeEvidence({
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  const snapshot = await loadCodexModeSnapshot({
    fetchImpl,
    env,
    includeHandoff: false,
    includeManifest: false,
  });
  const state = snapshot.state;
  const providerBranch = state?.source?.provider_branch;
  const attempts = Array.isArray(state?.provider_attempts)
    ? state.provider_attempts
    : [];

  const evidence = await Promise.all(
    attempts.map(async (attempt) => {
      if (!attempt?.evidence_path || !providerBranch) {
        return {
          attempt_id: attempt?.attempt_id ?? "unknown",
          status: attempt?.status ?? "UNKNOWN",
          evidence: null,
          read_error: "missing evidence_path or provider branch",
        };
      }
      try {
        const file = await fetchJsonFile(
          attempt.evidence_path,
          providerBranch,
          { fetchImpl, env },
        );
        return {
          attempt_id: attempt.attempt_id,
          status: attempt.status,
          source_commit: attempt.source_commit ?? null,
          evidence_path: attempt.evidence_path,
          evidence_blob_sha: file.blob_sha,
          evidence: file.value,
        };
      } catch (error) {
        return {
          attempt_id: attempt.attempt_id,
          status: attempt.status,
          source_commit: attempt.source_commit ?? null,
          evidence_path: attempt.evidence_path,
          evidence: null,
          read_error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return sanitize({
    ok: true,
    schema: "akashic.codex-mode-evidence-response/v1",
    state_digest: snapshot.state_digest,
    live: snapshot.live,
    attempts: evidence,
    certification: state?.certification ?? "OPEN",
    valid_certification_receipt:
      state?.capabilities?.valid_certification_receipt === true,
  });
}
