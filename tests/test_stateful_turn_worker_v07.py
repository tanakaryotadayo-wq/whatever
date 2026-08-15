import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

from workers.codex.stateful_turn_worker import StatefulCodexTurnWorker, TurnRequest, TurnStore


class StatefulTurnWorkerTests(unittest.TestCase):
    def request(self, workspace: str, prompt: str = "hello") -> TurnRequest:
        return TurnRequest("task-1", "attempt-1", 1, workspace, prompt, sandbox="read-only")

    def wait_terminal(self, worker: StatefulCodexTurnWorker, effect_key: str) -> dict:
        for _ in range(200):
            snapshot = worker.store.get(effect_key)
            if snapshot["state"] in {"COMPLETED", "FAILED", "CANCELED"}:
                return snapshot
            time.sleep(0.01)
        self.fail("turn did not become terminal")

    def test_submit_is_nonblocking_and_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            store = TurnStore(Path(directory) / "turns.sqlite")
            command = lambda _: [sys.executable, "-c", "import sys,time; time.sleep(.05); print(sys.stdin.read())"]
            worker = StatefulCodexTurnWorker(store, command)
            request = self.request(directory)
            first = worker.submit(request)
            second = worker.submit(request)
            self.assertTrue(first["accepted"])
            self.assertTrue(second["idempotent_replay"])
            final = self.wait_terminal(worker, request.effect_key)
            self.assertEqual(final["state"], "COMPLETED")

    def test_same_effect_key_with_different_payload_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            store = TurnStore(Path(directory) / "turns.sqlite")
            worker = StatefulCodexTurnWorker(store, lambda _: [sys.executable, "-c", "print('ok')"])
            worker.submit(self.request(directory, "one"))
            with self.assertRaisesRegex(RuntimeError, "turn_effect_key_conflict"):
                worker.submit(self.request(directory, "two"))

    def test_cancel_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            store = TurnStore(Path(directory) / "turns.sqlite")
            worker = StatefulCodexTurnWorker(store, lambda _: [sys.executable, "-c", "import time; time.sleep(10)"])
            request = self.request(directory)
            worker.submit(request)
            for _ in range(100):
                if store.get(request.effect_key)["state"] == "WORKING":
                    break
                time.sleep(0.01)
            first = worker.cancel(request.effect_key)
            second = worker.cancel(request.effect_key)
            self.assertEqual(first["state"], "CANCELED")
            self.assertTrue(second["idempotent_replay"])

    def test_restart_marks_working_turn_failed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "turns.sqlite"
            store = TurnStore(path)
            request = self.request(directory)
            store.submit(request)
            store.transition(request.effect_key, "WORKING", "PROCESS_STARTED", pid=999999)
            restarted = TurnStore(path)
            snapshot = restarted.get(request.effect_key)
            self.assertEqual(snapshot["state"], "FAILED")
            self.assertEqual(snapshot["error_code"], "worker_restart")


if __name__ == "__main__":
    unittest.main()
