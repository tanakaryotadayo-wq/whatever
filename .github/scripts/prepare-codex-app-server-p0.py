from pathlib import Path

client_path = Path("packages/codex-app-server-adapter/src/client.js")
client = client_path.read_text(encoding="utf-8")
replacements = {
    'processArgs = ["app-server", "--stdio"],': 'processArgs = ["app-server"],',
    '{ type: "text", text, textElements: [] }': '{ type: "text", text, text_elements: [] }',
    'sandbox: "workspaceWrite",': 'sandbox: "workspace-write",',
}
for old, new in replacements.items():
    if old not in client:
        raise SystemExit(f"missing client compatibility anchor: {old}")
    client = client.replace(old, new, 1)
client_path.write_text(client, encoding="utf-8")

manager_path = Path("packages/codex-app-server-adapter/src/process-manager.js")
manager = manager_path.read_text(encoding="utf-8")
old = 'args = ["app-server", "--stdio"],'
if old not in manager:
    raise SystemExit("missing process-manager compatibility anchor")
manager_path.write_text(
    manager.replace(old, 'args = ["app-server"],', 1),
    encoding="utf-8",
)

test_path = Path("packages/codex-app-server-adapter/test/protocol.test.mjs")
test = test_path.read_text(encoding="utf-8")
if 'from "node:fs/promises"' not in test:
    test = test.replace(
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\n'
        'import { mkdtemp, rm } from "node:fs/promises";\n'
        'import { tmpdir } from "node:os";\n'
        'import { join } from "node:path";\n',
        1,
    )

regression = r'''

test("stable App Server wire contract uses default stdio launch and generated field casing", async () => {
  assert.deepEqual(new CodexAppServerProcess().args, ["app-server"]);
  const client = adapter();
  const workspace = await mkdtemp(join(tmpdir(), "akashic-codex-wire-contract-"));
  const inputText = '{"task_id":"wire-task","logical_attempt_id":"wire-attempt"}';
  try {
    await client.start();
    const selection = client.selectModel();
    const { thread } = await client.startThread({ workspace, selection });
    await client.runTurn({
      threadId: thread.id,
      inputText,
      outputSchema: { type: "object" },
      selection,
      timeoutMs: 5_000,
    });
    const outbound = client.transport.trace.filter((entry) => entry.direction === "outbound");
    const threadStart = outbound.find((entry) => entry.message?.method === "thread/start");
    const turnStart = outbound.find((entry) => entry.message?.method === "turn/start");
    assert.equal(threadStart.message.params.sandbox, "workspace-write");
    assert.deepEqual(turnStart.message.params.input[0], {
      type: "text",
      text: inputText,
      text_elements: [],
    });
  } finally {
    await client.stop();
    await rm(workspace, { recursive: true, force: true });
  }
});
'''
if "stable App Server wire contract uses default stdio launch" not in test:
    test += regression

test_path.write_text(test, encoding="utf-8")
