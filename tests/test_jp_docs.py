import tempfile
import unittest
from pathlib import Path

import jp_docs


class JapaneseDocsTests(unittest.TestCase):
    def test_generate_docs_creates_per_directory_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "src" / "app.py").write_text("print('ok')\n", encoding="utf-8")

            generated = jp_docs.generate_docs(root)

            self.assertIn(root / jp_docs.DOC_FILE_NAME, generated)
            self.assertIn(root / "src" / jp_docs.DOC_FILE_NAME, generated)
            content = (root / "src" / jp_docs.DOC_FILE_NAME).read_text(encoding="utf-8")
            self.assertIn("AI記入必須", content)
            self.assertIn("`app.py`", content)

    def test_audit_docs_detects_missing_and_unfilled(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "pkg").mkdir()
            (root / jp_docs.DOC_FILE_NAME).write_text("- [x] 目的\n", encoding="utf-8")

            report = jp_docs.audit_docs(root)

            self.assertEqual("needs_attention", report["status"])
            self.assertIn("pkg", report["missing_docs"])
            self.assertEqual([], report["unfilled_docs"])

    def test_audit_docs_detects_todo_placeholder_as_unfilled(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / jp_docs.DOC_FILE_NAME).write_text(
                "- [x] 目的と背景: 完了\n- [x] 主要ロジックの説明: 完了\nTODO_AI\n",
                encoding="utf-8",
            )

            report = jp_docs.audit_docs(root)

            self.assertEqual("needs_attention", report["status"])
            self.assertEqual([], report["missing_docs"])
            self.assertIn(".", report["unfilled_docs"])


if __name__ == "__main__":
    unittest.main()
