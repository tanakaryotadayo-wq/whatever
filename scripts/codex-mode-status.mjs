import { readFile } from "node:fs/promises";

const state = JSON.parse(await readFile("docs/modes/CODEX_MODE_STATE.json", "utf8"));
const jsonMode = process.argv.includes("--json");
const observed = Date.parse(state.observed_at);
const ageSeconds = Number.isFinite(observed) ? Math.max(0, Math.floor((Date.now() - observed) / 1000)) : null;
const stale = ageSeconds === null || ageSeconds > state.freshness_ttl_seconds;
const projection = {
  mode_version: state.mode_version,
  phase: state.phase,
  status: stale ? "STALE" : state.status,
  stored_status: state.status,
  role: state.current_role,
  blocker: state.status_card.blocker,
  next: state.status_card.next,
  evidence: state.status_card.evidence,
  observed_at: state.observed_at,
  age_seconds: ageSeconds,
  freshness_ttl_seconds: state.freshness_ttl_seconds,
  live_reconciliation_required: stale,
  reconciled_against_main_head: state.source.reconciled_against_main_head,
  main_head_relation: state.source.main_head_relation,
  handoff: state.integrity.handoff_path,
};

if (jsonMode) {
  console.log(JSON.stringify(projection, null, 2));
} else {
  console.log(`Codexモード v${projection.mode_version}`);
  console.log(`Phase: ${projection.phase}`);
  console.log(`Status: ${projection.status}`);
  console.log(`Role: ${projection.role}`);
  console.log(`Blocker: ${projection.blocker}`);
  console.log(`Next: ${projection.next}`);
  console.log(`Evidence: ${projection.evidence}`);
  if (stale) console.log("Freshness: STALE — live GitHub/Drive reconciliation required");
}
