#!/usr/bin/env python3
"""フォルダ単位の日本語ドキュメント生成と未記入可視化。"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

DOC_FILE_NAME = "AI_DOCS.ja.md"
CODE_EXTENSIONS = {".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".rb", ".php", ".c", ".cc", ".cpp", ".h", ".hpp", ".cs"}

REQUIRED_FIELDS = [
    "目的と背景",
    "主要ロジックの説明",
    "入出力と副作用",
    "テスト観点",
]


@dataclass(frozen=True, slots=True)
class DirSummary:
    rel_dir: str
    files: list[str]
    code_files: list[str]


def collect_target_dirs(root: Path) -> Iterable[Path]:
    for current, dirs, _ in os.walk(root):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
        yield Path(current)


def summarize_dir(root: Path, directory: Path, doc_file_name: str) -> DirSummary:
    visible_entries = [
        p
        for p in directory.iterdir()
        if not p.name.startswith(".") and p.name not in {doc_file_name, "__pycache__"}
    ]
    entries = sorted(p.name for p in visible_entries)
    code_files = sorted(p.name for p in visible_entries if p.suffix in CODE_EXTENSIONS)
    rel = "." if directory == root else str(directory.relative_to(root))
    return DirSummary(rel_dir=rel, files=entries, code_files=code_files)


def render_doc(summary: DirSummary) -> str:
    file_lines = "\n".join(f"- `{name}`" for name in summary.files) or "- (ファイルなし)"
    code_lines = "\n".join(f"- `{name}`" for name in summary.code_files) or "- (コードファイルなし)"
    required_lines = "\n".join(f"- [ ] {field}: TODO_AI" for field in REQUIRED_FIELDS)

    return (
        f"# {summary.rel_dir} の日本語ドキュメント\n\n"
        "## 自動生成サマリー\n"
        f"- 対象ディレクトリ: `{summary.rel_dir}`\n"
        f"- ファイル数: {len(summary.files)}\n"
        "- ファイル一覧:\n"
        f"{file_lines}\n"
        "- コードファイル:\n"
        f"{code_lines}\n\n"
        "## AI記入必須（コードに応じて説明を埋める）\n"
        f"{required_lines}\n\n"
        "## AI誤魔化し可視化ルール\n"
        "- `TODO_AI` が残っている場合は未記入扱い\n"
        "- チェックボックスが `- [ ]` のままなら未完了扱い\n"
    )


def generate_docs(root: Path, doc_file_name: str = DOC_FILE_NAME, overwrite: bool = False) -> list[Path]:
    generated: list[Path] = []
    for directory in collect_target_dirs(root):
        target = directory / doc_file_name
        if target.exists() and not overwrite:
            continue

        summary = summarize_dir(root, directory, doc_file_name)
        target.write_text(render_doc(summary), encoding="utf-8")
        generated.append(target)
    return generated


def audit_docs(root: Path, doc_file_name: str = DOC_FILE_NAME) -> dict:
    missing_docs: list[str] = []
    unfilled_docs: list[str] = []

    for directory in collect_target_dirs(root):
        target = directory / doc_file_name
        rel = "." if directory == root else str(directory.relative_to(root))
        if not target.exists():
            missing_docs.append(rel)
            continue

        content = target.read_text(encoding="utf-8")
        has_unfilled_required = any(
            f"- [ ] {field}:" in content for field in REQUIRED_FIELDS
        )
        if "TODO_AI" in content or has_unfilled_required:
            unfilled_docs.append(rel)

    status = "ok" if not missing_docs and not unfilled_docs else "needs_attention"
    return {
        "status": status,
        "missing_docs": missing_docs,
        "unfilled_docs": unfilled_docs,
    }


def print_audit_report(report: dict) -> None:
    print(json.dumps(report, ensure_ascii=False, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="フォルダごとの日本語docsを生成し、未記入を可視化します。")
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate_parser = subparsers.add_parser("generate", help="日本語docsを自動生成")
    generate_parser.add_argument("--root", default=".", help="対象ルートディレクトリ")
    generate_parser.add_argument("--file-name", default=DOC_FILE_NAME, help="生成するdocsファイル名")
    generate_parser.add_argument("--overwrite", action="store_true", help="既存docsを上書き")

    audit_parser = subparsers.add_parser("audit", help="未記入や未生成を可視化")
    audit_parser.add_argument("--root", default=".", help="対象ルートディレクトリ")
    audit_parser.add_argument("--file-name", default=DOC_FILE_NAME, help="監査するdocsファイル名")
    audit_parser.add_argument("--strict", action="store_true", help="問題があれば終了コード1")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()

    if args.command == "generate":
        generated = generate_docs(root=root, doc_file_name=args.file_name, overwrite=args.overwrite)
        for path in generated:
            print(path)
        return 0

    report = audit_docs(root=root, doc_file_name=args.file_name)
    print_audit_report(report)
    if args.strict and report["status"] != "ok":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
