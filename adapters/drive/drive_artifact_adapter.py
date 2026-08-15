from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Protocol


class DriveClient(Protocol):
    def find_by_app_property(self, key: str, value: str, parent_id: str) -> list[dict[str, Any]]: ...
    def upload_bytes(self, *, name: str, data: bytes, mime_type: str, parent_id: str, app_properties: dict[str, str]) -> dict[str, Any]: ...
    def download_bytes(self, file_id: str) -> bytes: ...


@dataclass(frozen=True)
class DriveArtifactRef:
    schema: str
    media_type: str
    digest: str
    size: int
    uri: str
    artifact_type: str | None = None
    annotations: dict[str, str] | None = None


class DriveArtifactAdapter:
    """Immutable digest-addressed Drive storage. Drive is never the queue authority."""

    def __init__(self, client: DriveClient, artifacts_parent_id: str, projections_parent_id: str | None = None):
        self.client = client
        self.artifacts_parent_id = artifacts_parent_id
        self.projections_parent_id = projections_parent_id

    @staticmethod
    def digest(data: bytes) -> str:
        return "sha256:" + hashlib.sha256(data).hexdigest()

    def put(self, data: bytes, *, media_type: str, artifact_type: str, task_id: str | None = None) -> DriveArtifactRef:
        digest = self.digest(data)
        existing = self.client.find_by_app_property("sha256", digest[7:], self.artifacts_parent_id)
        if existing:
            file = existing[0]
            if self.digest(self.client.download_bytes(file["id"])) != digest:
                raise RuntimeError("drive_digest_mismatch")
        else:
            properties = {"sha256": digest[7:], "artifact_kind": artifact_type}
            if task_id:
                properties["task_id"] = task_id
            file = self.client.upload_bytes(name=digest[7:], data=data, mime_type=media_type, parent_id=self.artifacts_parent_id, app_properties=properties)
        return DriveArtifactRef("akashic.artifact-ref/v1", media_type, digest, len(data), f"gdrive://{file['id']}", artifact_type, {"drive_file_id": file["id"]})

    def project_snapshot(self, snapshot: dict[str, Any]) -> DriveArtifactRef:
        if not self.projections_parent_id:
            raise RuntimeError("projection_parent_not_configured")
        body = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        digest = self.digest(body)
        task_id = str(snapshot["task_id"])
        file = self.client.upload_bytes(
            name=f"{task_id}.status.{digest[7:19]}.json",
            data=body,
            mime_type="application/json",
            parent_id=self.projections_parent_id,
            app_properties={"sha256": digest[7:], "artifact_kind": "task_snapshot_projection", "task_id": task_id, "projection": "true"},
        )
        return DriveArtifactRef("akashic.artifact-ref/v1", "application/json", digest, len(body), f"gdrive://{file['id']}", "task_snapshot_projection", {"drive_file_id": file["id"]})
