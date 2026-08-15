import tempfile
import unittest
from pathlib import Path

from packages.runtime.akashic_runtime import AdoptionGate, EffectLedger, ImmutableFileStore


class RuntimeTests(unittest.TestCase):
    def test_immutable_content_addressed_put(self):
        with tempfile.TemporaryDirectory() as directory:
            store = ImmutableFileStore(directory)
            first = store.put(b"abc")
            second = store.put(b"abc")
            self.assertEqual(first.digest, second.digest)
            self.assertEqual(first.uri, second.uri)

    def test_effect_replay_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = EffectLedger(Path(directory) / "effects.ndjson")
            first = ledger.record_once("e", "sha256:" + "1" * 64, "sha256:" + "2" * 64, 1)
            second = ledger.record_once("e", "sha256:" + "1" * 64, "sha256:" + "2" * 64, 1)
            self.assertFalse(first["idempotent_replay"])
            self.assertTrue(second["idempotent_replay"])

    def test_effect_conflict_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = EffectLedger(Path(directory) / "effects.ndjson")
            ledger.record_once("e", "a", "b", 1)
            with self.assertRaisesRegex(RuntimeError, "effect_key_conflict"):
                ledger.record_once("e", "a", "c", 1)

    def test_adoption_requires_verification_and_fence(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate = ImmutableFileStore(directory).put(b"candidate")
            gate = AdoptionGate(EffectLedger(Path(directory) / "effects.ndjson"))
            with self.assertRaisesRegex(RuntimeError, "verification_not_passed"):
                gate.adopt(effect_key="x", candidate=candidate, verification={"verdict": "FAIL", "subject_digest": candidate.digest}, expected_generation=0, current_generation=0)
            with self.assertRaisesRegex(RuntimeError, "stale_fencing_generation"):
                gate.adopt(effect_key="x", candidate=candidate, verification={"verdict": "PASS", "subject_digest": candidate.digest}, expected_generation=0, current_generation=1)
            receipt = gate.adopt(effect_key="x", candidate=candidate, verification={"verdict": "PASS", "subject_digest": candidate.digest}, expected_generation=0, current_generation=0)
            self.assertEqual(receipt["generation"], 1)


if __name__ == "__main__":
    unittest.main()
