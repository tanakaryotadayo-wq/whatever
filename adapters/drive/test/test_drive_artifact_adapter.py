import unittest

from adapters.drive.drive_artifact_adapter import DriveArtifactAdapter


class FakeDrive:
    def __init__(self):
        self.files = {}
        self.count = 0

    def find_by_app_property(self, key, value, parent_id):
        return [file for file in self.files.values() if file["parent_id"] == parent_id and file["app_properties"].get(key) == value]

    def upload_bytes(self, **kwargs):
        self.count += 1
        file = {"id": str(self.count), **kwargs}
        self.files[file["id"]] = file
        return file

    def download_bytes(self, file_id):
        return self.files[file_id]["data"]


class DriveAdapterTests(unittest.TestCase):
    def test_same_digest_reuses_file(self):
        client = FakeDrive()
        adapter = DriveArtifactAdapter(client, "artifacts")
        first = adapter.put(b"x", media_type="text/plain", artifact_type="candidate")
        second = adapter.put(b"x", media_type="text/plain", artifact_type="candidate")
        self.assertEqual(first.uri, second.uri)
        self.assertEqual(client.count, 1)

    def test_projection_is_append_only_not_queue_move(self):
        client = FakeDrive()
        adapter = DriveArtifactAdapter(client, "artifacts", "projections")
        ref = adapter.project_snapshot({"task_id": "task-1", "state": "WORKING"})
        self.assertEqual(ref.artifact_type, "task_snapshot_projection")
        self.assertEqual(client.count, 1)


if __name__ == "__main__":
    unittest.main()
