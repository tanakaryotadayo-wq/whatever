import { access, readFile } from "node:fs/promises";

const registry = JSON.parse(await readFile("knowledge/packet-registry.json", "utf8"));
if (registry.schema !== "akashic.knowledge-packet-registry/v1") throw new Error("unexpected knowledge registry schema");
if (registry.source?.packet_count !== 30 || registry.packets?.length !== 30) throw new Error("knowledge registry must contain 30 packets");
const expected = Array.from({ length: 30 }, (_, index) => `KPK-${String(index + 1).padStart(3, "0")}`);
const ids = registry.packets.map((packet) => packet.packet_id);
if (new Set(ids).size !== 30 || expected.some((id) => !ids.includes(id))) throw new Error("knowledge registry packet IDs are incomplete or duplicated");
const matrix = await readFile("knowledge/PACKET_ADOPTION_MATRIX.md", "utf8");
for (const id of expected) if (!matrix.includes(id)) throw new Error(`adoption matrix is missing ${id}`);
const skills = ["akashic-task-routing", "akashic-context-negotiation", "akashic-artifact-adoption", "akashic-orchestrator-bakeoff"];
for (const skill of skills) {
  const path = `.agents/skills/${skill}/SKILL.md`; await access(path); const text = await readFile(path, "utf8");
  if (!text.startsWith("---\n") || !text.includes("\nname:") || !text.includes("\ndescription:")) throw new Error(`invalid skill front matter: ${path}`);
  if (/sk-[A-Za-z0-9_-]{12,}|BEGIN (RSA|OPENSSH) PRIVATE KEY|AKASHIC_GATEWAY_BEARER_TOKEN\s*=/.test(text)) throw new Error(`credential-like material detected in ${path}`);
}
const scenario = JSON.parse(await readFile("experiments/orchestrator-bakeoff/scenario.json", "utf8"));
const totalWeight = scenario.gates.reduce((sum, gate) => sum + gate.weight, 0);
if (totalWeight !== 100) throw new Error(`orchestrator bake-off weights must total 100, received ${totalWeight}`);
console.log(JSON.stringify({ ok: true, packets: ids.length, skills: skills.length, bakeoff_weight: totalWeight, source_sha256: registry.source.sha256 }));
