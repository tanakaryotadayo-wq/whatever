import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const [owner, repo] = process.env.REPOSITORY.split("/");
const branch = process.env.BRANCH;
const token = process.env.GH_TOKEN;
const checkoutSha = process.env.CHECKOUT_SHA;
const api = "https://api.github.com";

if (!owner || !repo || !branch || !token || !checkoutSha) {
  throw new Error("REPOSITORY, BRANCH, GH_TOKEN, and CHECKOUT_SHA are required");
}

async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "akashic-codex-p0-finalizer",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let value = {};
  if (text) {
    try {
      value = JSON.parse(text);
    } catch {
      value = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${text.slice(0, 4000)}`);
  }
  return value;
}

const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`;
const liveRef = await request("GET", refPath);
const parentSha = liveRef.object.sha;
if (parentSha !== checkoutSha) {
  throw new Error(`branch moved during validation: checkout=${checkoutSha} live=${parentSha}`);
}
const parentCommit = await request("GET", `/repos/${owner}/${repo}/git/commits/${parentSha}`);

const paths = execFileSync("git", ["diff", "--cached", "--name-only", "-z", "HEAD"])
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
if (paths.length === 0) throw new Error("validated tree has no changes");

const tree = [];
for (const path of paths) {
  if (!existsSync(path)) {
    tree.push({ path, mode: "100644", type: "blob", sha: null });
    continue;
  }
  const indexLine = execFileSync("git", ["ls-files", "-s", "--", path])
    .toString("utf8")
    .trim();
  const mode = indexLine.split(/\s+/)[0] || "100644";
  const bytes = readFileSync(path);
  const blob = await request("POST", `/repos/${owner}/${repo}/git/blobs`, {
    content: bytes.toString("base64"),
    encoding: "base64",
  });
  tree.push({ path, mode, type: "blob", sha: blob.sha });
}

const createdTree = await request("POST", `/repos/${owner}/${repo}/git/trees`, {
  base_tree: parentCommit.tree.sha,
  tree,
});
const createdCommit = await request("POST", `/repos/${owner}/${repo}/git/commits`, {
  message: "feat(codex): add official App Server live two-turn certification [codex-p0-ready]",
  tree: createdTree.sha,
  parents: [parentSha],
});

const refBeforeUpdate = await request("GET", refPath);
if (refBeforeUpdate.object.sha !== parentSha) {
  throw new Error(
    `branch changed before atomic ref update: expected=${parentSha} actual=${refBeforeUpdate.object.sha}`,
  );
}
await request(
  "PATCH",
  `/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`,
  { sha: createdCommit.sha, force: false },
);

console.log(JSON.stringify({
  ok: true,
  parent_sha: parentSha,
  tree_sha: createdTree.sha,
  commit_sha: createdCommit.sha,
  changed_paths: paths.length,
}));
