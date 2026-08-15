from __future__ import annotations

import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha256_digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class ArtifactRef:
    media_type: str
    digest: str
    size: int
    uri: str
    artifact_type: str | None = None
    schema: str = "akashic.artifact-ref/v1"


class ImmutableFileStore:
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def put(self, payload: bytes, media_type: str = "application/octet-stream", artifact_type: str | None = None) -> ArtifactRef:
        digest = sha256_digest(payload)
        hex_value = digest.split(":", 1)[1]
        path = self.root / "sha256" / hex_value[:2] / hex_value
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() != payload:
            raise RuntimeError("digest_collision")
        if not path.exists():
            fd, tmp = tempfile.mkstemp(dir=path.parent)
            try:
                os.write(fd, payload)
            finally:
                os.close(fd)
            os.replace(tmp, path)
        return ArtifactRef(media_type, digest, len(payload), path.as_uri(), artifact_type)


class EffectLedger:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> dict[str, dict[str, Any]]:
        if not self.path.exists():
            return {}
        records = [json.loads(line) for line in self.path.read_text().splitlines() if line.strip()]
        return {record["effect_key"]: record for record in records}

    def record_once(self, effect_key: str, subject_digest: str, result_digest: str, generation: int) -> dict[str, Any]:
        existing = self._load().get(effect_key)
        candidate = {
            "effect_key": effect_key,
            "subject_digest": subject_digest,
            "result_digest": result_digest,
            "generation": generation,
        }
        if existing:
            if existing != candidate:
                raise RuntimeError("effect_key_conflict")
            return {**existing, "idempotent_replay": True}
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(candidate, sort_keys=True) + "\n")
        return {**candidate, "idempotent_replay": False}


class AdoptionGate:
    def __init__(self, ledger: EffectLedger):
        self.ledger = ledger

    def adopt(
        self,
        *,
        effect_key: str,
        candidate: ArtifactRef,
        verification: dict[str, Any],
        expected_generation: int,
        current_generation: int,
    ) -> dict[str, Any]:
        if verification.get("verdict") != "PASS":
            raise RuntimeError("verification_not_passed")
        if verification.get("subject_digest") != candidate.digest:
            raise RuntimeError("verification_subject_mismatch")
        if expected_generation != current_generation:
            raise RuntimeError("stale_fencing_generation")
        return self.ledger.record_once(effect_key, candidate.digest, candidate.digest, current_generation + 1)
