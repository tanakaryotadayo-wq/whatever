---
schema: akashic.mode-pointer/v1.1
mode_id: codex-mode
mode_version: 1.1.0
activation_phrase: "codexモード起動"
updated_at: 2026-08-16
---

# Codexモード起動ポインタ

## 最短bootstrap

```text
L0: このPointer
L1: GitHub docs/modes/CODEX_MODE_STATE.json
L2: GitHub docs/modes/CODEX_MODE.md（必要時のみ）
L3: Stateが指すDrive Evidence（必要時のみ）
```

## GitHub正本

```text
Repository: tanakaryotadayo-wq/whatever
Spec: docs/modes/CODEX_MODE.md
State: docs/modes/CODEX_MODE_STATE.json
Ref: default branch
Provider branch: akashic/v0.10-codex-app-server-live
Provider PR: 15
```

## Drive fallback

```text
Root:
https://drive.google.com/drive/folders/1xrqptlQ_Ca6NQyYEFSrL9r9Skn81l05Y

Spec title:
CODEX_MODE.md

State title:
CODEX_MODE_STATE.json

Current retained source/evidence:
https://drive.google.com/drive/folders/1IptDk7ePL2wUWXcLAVal8YtwiwCZgLew
```

## 現在地

```text
Status: PROVIDER_ATTEMPTED_FAILED_AND_BLOCKED
Certification: OPEN
PR #15: DRAFT
Valid three-run receipt: ABSENT
```

過去の`NOT RUN`表現と、Drive上の`final evidence`という名前はsuperseded。Activation時は必ずGitHub Stateと現在headを再取得する。

## コマンド

```text
codexモード起動
codexモード 状態
codexモード 続行
codexモード 診断
codexモード 証拠
codexモード 計画
codexモード 終了
```

## 起動時禁止

- ユーザーへ過去の詳細を再説明させない
- メモリだけで開始しない
- fixture成功をofficial provider成功と呼ばない
- valid three-run receiptなしでCERTIFIEDと報告しない
- BLOCKED/FAILED/NO_RESULT成果物をrelease扱いしない
