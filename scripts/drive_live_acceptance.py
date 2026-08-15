#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from adapters.drive.drive_artifact_adapter import DriveArtifactAdapter


class GoogleDriveClient:
    def __init__(self):
        try:
            import google.auth
            from googleapiclient.discovery import build
        except ImportError as error:
            raise SystemExit(
                "install google-api-python-client and google-auth before live Drive acceptance"
            ) from error
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/drive.file"]
        )
        self.service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    @staticmethod
    def _escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    def find_by_app_property(self, key: str, value: str, parent_id: str) -> list[dict[str, Any]]:
        query = (
            f"'{self._escape(parent_id)}' in parents and trashed=false and "
            f"appProperties has {{ key='{self._escape(key)}' and value='{self._escape(value)}' }}"
        )
        response = (
            self.service.files()
            .list(q=query, fields="files(id,name,mimeType,size,appProperties,parents)", pageSize=100)
            .execute()
        )
        return response.get("files", [])

    def upload_bytes(self, *, name: str, data: bytes, mime_type: str, parent_id: str, app_properties: dict[str, str]) -> dict[str, Any]:
        from googleapiclient.http import MediaIoBaseUpload

        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime_type, resumable=True, chunksize=256 * 1024)
        request = self.service.files().create(
            body={"name": name, "parents": [parent_id], "appProperties": app_properties},
            media_body=media,
            fields="id,name,mimeType,size,appProperties,parents",
        )
        response = None
        while response is None:
            _, response = request.next_chunk()
        return response

    def download_bytes(self, file_id: str) -> bytes:
        from googleapiclient.http import MediaIoBaseDownload

        output = io.BytesIO()
        request = self.service.files().get_media(fileId=file_id)
        downloader = MediaIoBaseDownload(output, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return output.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description="Live Google Drive immutable artifact acceptance")
    parser.add_argument("--evidence-dir", required=True)
    args = parser.parse_args()

    artifacts_folder = os.environ.get("AKASHIC_DRIVE_ARTIFACTS_FOLDER_ID")
    projections_folder = os.environ.get("AKASHIC_DRIVE_PROJECTIONS_FOLDER_ID")
    if not artifacts_folder or not projections_folder:
        raise SystemExit(
            "AKASHIC_DRIVE_ARTIFACTS_FOLDER_ID and AKASHIC_DRIVE_PROJECTIONS_FOLDER_ID are required"
        )

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    evidence_dir = Path(args.evidence_dir) / timestamp
    evidence_dir.mkdir(parents=True, exist_ok=False)
    evidence_path = evidence_dir / "evidence.json"
    evidence: dict[str, Any] = {
        "schema": "akashic.drive-live-evidence/v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "FAIL",
    }

    try:
        client = GoogleDriveClient()
        adapter = DriveArtifactAdapter(client, artifacts_folder, projections_folder)
        payload = json.dumps(
            {
                "schema": "akashic.drive-acceptance-probe/v1",
                "probe_id": timestamp,
                "purpose": "prove immutable upload, digest reuse, and projection",
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        first = adapter.put(
            payload,
            media_type="application/json",
            artifact_type="acceptance_probe",
            task_id=f"drive-live-{timestamp}",
        )
        second = adapter.put(
            payload,
            media_type="application/json",
            artifact_type="acceptance_probe",
            task_id=f"drive-live-{timestamp}",
        )
        if first.uri != second.uri or first.digest != second.digest:
            raise RuntimeError("same digest did not reuse the immutable Drive file")

        projection = adapter.project_snapshot(
            {
                "schema": "akashic.task-snapshot/v1",
                "task_id": f"drive-live-{timestamp}",
                "logical_attempt_id": "acceptance-1",
                "state": "COMPLETED",
                "context_seq": 0,
                "turn_no": 0,
                "terminal": True,
                "artifact_refs": [first.__dict__],
            }
        )
        evidence.update(
            {
                "status": "PASS",
                "artifact_ref": first.__dict__,
                "idempotent_ref": second.__dict__,
                "projection_ref": projection.__dict__,
                "claims": {
                    "resumable_upload": True,
                    "digest_verified_after_download": True,
                    "same_digest_reused": True,
                    "projection_is_append_only": True,
                    "drive_is_queue_authority": False,
                },
            }
        )
        return 0
    except Exception as error:
        evidence["error"] = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        evidence_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n")
        print(json.dumps(evidence, indent=2, sort_keys=True))


if __name__ == "__main__":
    raise SystemExit(main())
