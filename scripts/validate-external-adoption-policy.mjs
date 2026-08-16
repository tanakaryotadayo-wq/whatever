import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const policy = JSON.parse(await readFile("knowledge/external-adoption-policy.json", "utf8"));
const receiptSet = JSON.parse(await readFile("knowledge/adoption-receipts/v0.8-rc1.json", "utf8"));

assert.equal(policy.schema, "akashic.external-adoption-policy/v1");
assert.equal(policy.rules.search_before_build, true);
assert.equal(policy.rules.require_conformance_tests, true);
assert.equal(policy.rules.require_source_revision, true);
assert.equal(policy.rules.experimental_dependency_default, "FORBID");
assert.ok(Array.isArray(policy.priority_order) && policy.priority_order.at(-1) === "CUSTOM_IMPLEMENTATION");
assert.equal(receiptSet.schema, "akashic.external-adoption-receipt-set/v1");
assert.ok(Array.isArray(receiptSet.receipts) && receiptSet.receipts.length > 0);

const ids = new Set();
for (const receipt of receiptSet.receipts) {
  for (const field of policy.required_receipt_fields) {
    assert.ok(Object.hasOwn(receipt, field), `${receipt.receipt_id ?? "unknown"}: missing ${field}`);
  }
  assert.match(receipt.receipt_id, /^[a-z0-9][a-z0-9._-]+$/);
  assert.equal(ids.has(receipt.receipt_id), false, `duplicate receipt_id: ${receipt.receipt_id}`);
  ids.add(receipt.receipt_id);
  assert.ok(Array.isArray(receipt.packet_ids) && receipt.packet_ids.length > 0);
  assert.ok(policy.import_modes.includes(receipt.import_mode), `${receipt.receipt_id}: invalid import_mode`);
  assert.ok(["ADOPTED", "ADAPTED", "REJECTED", "DEFERRED"].includes(receipt.decision));
  assert.ok(Array.isArray(receipt.sources) && receipt.sources.length > 0);
  for (const source of receipt.sources) {
    assert.ok(policy.priority_order.includes(source.class), `${receipt.receipt_id}: unknown source class`);
    assert.match(source.url, /^https:\/\//);
    assert.ok(typeof source.revision === "string" && source.revision.length > 0);
  }
  if (["ADOPTED", "ADAPTED"].includes(receipt.decision)) {
    assert.ok(receipt.implementation_paths.length > 0, `${receipt.receipt_id}: no implementation path`);
    assert.ok(receipt.conformance_tests.length > 0, `${receipt.receipt_id}: no conformance test`);
  }
  if (receipt.import_mode === "PINNED_DEPENDENCY") {
    assert.ok(receipt.license && receipt.pinned_version, `${receipt.receipt_id}: dependency lacks license/version`);
  }
  if (receipt.sources.some((source) => source.experimental === true) && receipt.import_mode === "PINNED_DEPENDENCY") {
    assert.fail(`${receipt.receipt_id}: experimental dependency is forbidden without an explicit approved exception`);
  }
  assert.ok(typeof receipt.rollback === "string" && receipt.rollback.length > 0);
}

console.log(JSON.stringify({
  ok: true,
  policy_id: policy.policy_id,
  receipt_count: receiptSet.receipts.length,
  packet_count: new Set(receiptSet.receipts.flatMap((receipt) => receipt.packet_ids)).size
}));
