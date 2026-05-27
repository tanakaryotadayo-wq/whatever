# whatever
Build resilient language agents as graphs.

## 日本語docs自動生成（実験）

フォルダごとに日本語docsを作成し、AIが埋めるべき説明項目を強制し、未記入を可視化できます。

```bash
python jp_docs.py generate --root .
python jp_docs.py audit --root . --strict
```

- `generate`: 各フォルダに `AI_DOCS.ja.md` を生成します。
- `audit`: `TODO_AI` や `- [ ]` を検出して、AIの未記入・記入状況を可視化します。
