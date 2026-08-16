---
schema: akashic.mode-pointer/v1
mode_id: codex-mode
activation_phrase: "codexモード起動"
updated_at: 2026-08-16
---

# Codexモード起動ポインタ

このファイルは、別セッションのAssistantが「codexモード起動」を受け取ったときに最初に読む固定ポインタ。

## 読み込み順序

1. GitHub正本を読む。

```text
Repository: tanakaryotadayo-wq/whatever
Path: docs/modes/CODEX_MODE.md
Ref: default branch
```

2. GitHubが読めない場合、Driveで完全一致タイトルを検索する。

```text
CODEX_MODE.md
```

3. 現在のProvider P0成果物を読む。

```text
Folder:
https://drive.google.com/drive/folders/1IptDk7ePL2wUWXcLAVal8YtwiwCZgLew

Manifest:
MANIFEST_akashic_codex_app_server_p0_in_progress_20260816.json

Status:
AKASHIC_CODEX_APP_SERVER_P0_IN_PROGRESS_20260816.md
```

4. GitHubの現在headを再取得し、保存時点のSHAを盲信しない。

## 現在地

```text
Adapter implementation           PASS
Fixture three-run certification  PASS
Full regression suite            PASS
Drive preservation               PASS
Official Codex live three-run     NOT RUN
Overall P0 certification          OPEN
```

## 起動時の禁止事項

- ユーザーへ過去の詳細を再説明させない。
- fixture成功をofficial Codex成功と呼ばない。
- 3回連続Live PASS前にCERTIFIEDと報告しない。
- メモリだけで開始しない。
- 新しいAgent frameworkやTaskStoreへ逃げない。

## 起動応答

```text
Codexモード起動。
正本: <GitHub path @ current commit>
Evidence: <Drive manifest>
現在地: <status>
次の一手: <one concrete gate>
```
