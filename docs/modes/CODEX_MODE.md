---
schema: akashic.codex-mode/v1
mode_id: codex-mode
activation_phrase: "codexモード起動"
status: ACTIVE_BOOTSTRAP_SPEC
source_authority: GitHub
artifact_evidence_authority: Google Drive
github_repository: tanakaryotadayo-wq/whatever
github_canonical_path: docs/modes/CODEX_MODE.md
drive_root_id: 1xrqptlQ_Ca6NQyYEFSrL9r9Skn81l05Y
drive_pointer_title: "00 - CODEX_MODE_POINTER.md"
drive_fallback_spec_title: "CODEX_MODE.md"
current_provider_gate: official-codex-app-server-live-two-turn
updated_at: 2026-08-16
---

# Codexモード — Akashic Codex App Server運用仕様

## 0. 起動合図

ユーザーが次の完全一致フレーズを送ったら、このモードを起動する。

```text
codexモード起動
```

起動時に、過去会話の要約だけで作業を開始してはならない。下記の「読み込み順序」に従い、Google DriveとGitHubの正本を実際に読み込む。

## 1. このモードの目的

Codexモードは、AkashicのCodex実行境界を扱う専用運用モードである。

主目的は次の経路を、公式Codex App Serverと証拠付きで閉じること。

```text
Task Capsule
  ↓
official codex app-server
  ↓
turn 1
  ↓
INPUT_REQUIRED / ContextNeed
  ↓
ContextPacketDeltaのみ追加
  ↓
同一thread上のturn 2
  ↓
COMPLETED
  ↓
Artifact / Evidence / Certification Receipt
```

新しいAgent framework、TaskStore、Workflow engineを増やすモードではない。既存のAkashic契約へ公式Codex App Serverを接続し、未証明部分を順番に閉じる。

## 2. 正本と読み込み順序

### 2.1 起動時の必須読み込み

1. Google Driveで完全一致タイトルを検索する。

```text
00 - CODEX_MODE_POINTER.md
```

2. Pointer内のGitHub repository/pathを読み取る。
3. GitHubのdefault branchから次を読む。

```text
tanakaryotadayo-wq/whatever
docs/modes/CODEX_MODE.md
```

4. Google DriveのPointerに記載された最新Artifact folderとManifestを読む。
5. 必要なときだけ、ZIP/Patch/Evidenceを取得する。
6. 読み込み完了後、現在地を3行以内で復唱してから作業へ入る。

### 2.2 Fallback

GitHubが利用できない場合は、Google Drive内の完全一致タイトル、

```text
CODEX_MODE.md
```

を読む。

Driveが利用できずGitHubが利用できる場合は、GitHubの正本だけで開始し、Drive Evidenceは未確認と明示する。

両方が利用できない場合のみ、ユーザーへ接続状況を報告する。過去会話の曖昧な記憶から成功状態を推測しない。

## 3. Authority split

```text
GitHub
= モード仕様、ソース、契約、テスト、履歴、CIの正本

Google Drive
= Artifact、Evidence、Manifest、Handoff、正本の読み取り用ミラー

Codex App Server
= 公式Codex provider runtime

Temporal / Vercel Workflow
= Durable orchestration候補
  ※ Codex provider certificationとは別レイヤー

Akashic
= Context、Routing、Policy、Effect identity、
  Verification、Artifact adoptionの意味論
```

メモリは索引としては使えるが、Authorityではない。モードの事実は必ずGitHub/Driveから再取得する。

## 4. 現在できること

### 4.1 実装済みAdapter機能

現在の成果物には、次のCodex App Server Adapter実装が含まれる。

- newline-delimited JSON / stdio transport
- 長寿命`codex app-server`子プロセス管理
- `initialize → initialized` handshake
- `model/list`による利用可能model・reasoning effort選択
- `thread/start`を1回だけ実行
- 同一threadに`turn/start`を複数回追加
- `turn/started` / item events / `turn/completed`の収集
- `turn/completed`を完了判定の正本として使用
- timeout時の`turn/interrupt`
- App Server死亡時のfail-closed
- approval / elicitation要求のfail-closed
- `outputSchema`による構造化出力
- turn 1の`INPUT_REQUIRED / ContextNeed`
- turn 2へTask Capsule全文を再送せず、ContextPacketDeltaのみ送信
- protocol traceのsanitization
- Artifact bytes / SHA-256 / size検証
- Evidence manifest / certification receipt生成
- 同一fixtureで3回連続認証するrunner
- 既存Temporal P0、Vercel build、Cloudflare conformanceへの回帰検査

### 4.2 今のモードで実行できる作業

Codexモード起動後のAssistantは、接続されているツール範囲で次を行う。

1. 現在のGitHub main、provider branch、Drive Evidenceを再同期する。
2. Adapterのソース、Protocol契約、テストを監査する。
3. 公式Codex versionに対応するschema生成手順を更新する。
4. Local/VM runnerが利用可能ならLive Two-Turnを実行する。
5. 実行結果をsanitized Evidenceへ変換する。
6. 3回連続PASSを同一Codex versionで確認する。
7. 成功時のみcertification receiptを作る。
8. GitHubへコード・ADR・テストを反映する。
9. DriveへManifest、Evidence、handoff bundleを保存する。
10. 未完了時は、失敗点と再開点をmachine-readableに残す。

### 4.3 現在できないと断定すべきこと

以下は、証拠がない限り成功扱いしない。

- 公式Codex binaryで3回連続Live PASS
- App Server process restart後の`thread/resume`
- Temporal Activity / Vercel Workflowからの本番Codex接続
- credentialed Drive REST adapterの完全認証
- authenticated ChatGPT → Vercel mutation path
- Workflow Authorityの最終選定

## 5. 現在の正確な状態

```text
Adapter implementation           PASS
Fixture three-run certification  PASS
Full regression suite            PASS
Drive preservation               PASS
Official Codex live three-run     NOT RUN
Overall P0 certification          OPEN
```

### 5.1 GitHub

Canonical repository:

```text
https://github.com/tanakaryotadayo-wq/whatever
```

Canonical main at the time of this record:

```text
3777ec97d159dc19b855b59acd626b1f1497eb8d
```

Provider work branch:

```text
akashic/p0-codex-app-server-live-two-turn
```

Observed branch head at this record:

```text
806ebf3eee3ae80aa6166be153011638c854637f
```

注意: このbranchはProvider P0の作業面であり、公式Live認証済みreleaseではない。正本化処理と公式binary認証は未完了。

### 5.2 Google Drive

Akashic root:

```text
https://drive.google.com/drive/folders/1xrqptlQ_Ca6NQyYEFSrL9r9Skn81l05Y
```

Current Codex P0 artifact folder:

```text
https://drive.google.com/drive/folders/1IptDk7ePL2wUWXcLAVal8YtwiwCZgLew
```

必須ファイル:

```text
AKASHIC_CODEX_APP_SERVER_P0_IN_PROGRESS_20260816.md
MANIFEST_akashic_codex_app_server_p0_in_progress_20260816.json
akashic_codex_app_server_p0_source_in_progress_20260816.zip
codex-app-server-p0.patch
```

Patch SHA-256:

```text
446e202dd2d4fd5b4b8582eb599b76b66ec08d48ffd29290acfe2aedcc751336
```

## 6. 起動時プロトコル

ユーザーが「codexモード起動」と言ったとき、Assistantは次を実行する。

```text
A. Drive Pointerを検索・読む
B. GitHub canonical specを読む
C. Drive current Manifestを読む
D. GitHub main / provider branchの現在headを確認
E. 最新statusを以下へ分類
   - CERTIFIED
   - LIVE_FAILED
   - FIXTURE_PASS_LIVE_OPEN
   - SOURCE_BLOCKED
   - TOOLING_UNAVAILABLE
F. 次の最小作業を一つ選ぶ
G. 作業を実行し、GitHub/DriveへEvidenceを戻す
```

起動応答の標準形:

```text
Codexモード起動。
正本: <GitHub path @ commit>
Evidence: <Drive folder / manifest>
現在地: <status>
次の一手: <one concrete gate>
```

ユーザーへ過去の事情を再説明させない。

## 7. 実装上の不変条件

1. stdio JSONLを安定境界にする。
2. experimental WebSocketを本番境界にしない。
3. App Serverを直接インターネット公開しない。
4. Protocol fieldは実Codex binary生成schemaから確認する。
5. `initialize`前に別RPCを送らない。
6. `thread/start`は1回、turnは同一threadへ追加する。
7. turn 2へTask Capsule全文を再送しない。
8. approval要求を自動承認しない。
9. fixture成功をofficial provider成功と呼ばない。
10. 3回連続Live PASS前にCERTIFIEDと報告しない。
11. Evidenceへcredential、authorization、cookie、tokenを保存しない。
12. GitHubがSource Authority、DriveはArtifact/Evidence Planeである。

## 8. Official Live Certification DoD

次をすべて満たした場合のみ`CERTIFIED`。

- official Codex binaryを使用
- binary versionを記録
- version対応schemaを生成しdigest化
- initialize / initialized成功
- model/list成功
- thread/start = 1回
- turn/start = 2回
- 両turnでturn/started / turn/completed観測
- 同一thread ID
- turn 1 = schema-valid INPUT_REQUIRED
- ContextNeed identity/CAS一致
- turn 2へTask Capsule再送なし
- turn 2 = schema-valid COMPLETED
- result.txtのbytes一致
- ArtifactRef digest/size一致
- sanitized trace存在
- secret leakなし
- 同一versionで3回連続PASS
- 既存Canonical CI回帰なし
- machine-readable certification receipt生成
- Drive Evidence保存
- GitHub ADR / status更新

## 9. Certification後の次段階

Live Two-TurnがCERTIFIEDになった後だけ、次へ進む。

1. App Server restart / `thread/resume` fault certification
2. `RunCodexTurnActivity`への接続
3. Vercel Workflow側Agent Portへの接続
4. authenticated ChatGPT MCP mutation
5. Temporal / Vercel / Cloudflare固定fault bake-off
6. Workflow Authorityを一つに選定

## 10. 更新規律

このファイルを更新する場合:

- GitHub `docs/modes/CODEX_MODE.md`を先に更新する。
- Drive mirrorを同内容へ更新する。
- Drive PointerのURL/path/statusを更新する。
- Project Indexへ最新モード状態を追記する。
- 古い成功主張を残す場合は、最新節が優先することを明記する。
- `updated_at`とcurrent Manifestを更新する。
