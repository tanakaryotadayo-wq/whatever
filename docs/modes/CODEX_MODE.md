---
schema: akashic.codex-mode/v1.1
mode_id: codex-mode
mode_version: 1.1.0
activation_phrase: "codexモード起動"
status_source: docs/modes/CODEX_MODE_STATE.json
source_authority: GitHub
artifact_evidence_authority: Google Drive
github_repository: tanakaryotadayo-wq/whatever
github_canonical_path: docs/modes/CODEX_MODE.md
drive_root_id: 1xrqptlQ_Ca6NQyYEFSrL9r9Skn81l05Y
drive_pointer_title: "00 - CODEX_MODE_POINTER.md"
drive_fallback_spec_title: "CODEX_MODE.md"
updated_at: 2026-08-16
---

# Codexモード v1.1 — Akashic Codex実行モード

## 0. 一文定義

`codexモード起動`は、過去会話を思い出す合図ではない。

> GitHubのMode Spec、machine-readable Current State、Google DriveのEvidenceを段階的に読み、現在実行可能な最小ゲートを選び、検証・保存まで閉じる決定論的bootstrapである。

メモリは入口の索引にのみ使う。現在地・成功・失敗・commit・Evidenceは毎回Authorityから再取得する。

## 1. 起動コマンド

| コマンド | 動作 | Mutation |
|---|---|---|
| `codexモード起動` | 状態を同期し、次の実行可能ゲートを選ぶ | 必要時のみ |
| `codexモード 状態` | PointerとStateだけを読み、5行Status Cardを返す | なし |
| `codexモード 続行` | 前回のActive/Blocked workstreamを再同期して実行する | あり |
| `codexモード 診断` | GitHub・Drive・PR・Evidenceの整合性監査を行う | 修復前はなし |
| `codexモード 証拠` | Attempt LedgerとEvidenceリンクを表示する | なし |
| `codexモード 計画` | 実装せず、依存・DoD・リスク・実行順を更新する | なし |
| `codexモード 終了` | Current StateとHandoffを更新して閉じる | 保存のみ |

自然言語の別名として、`Codexモードを起動`、`Codexモードの状態`、`Codexモードを続けて`も同じIntentへ正規化してよい。曖昧な場合は安全側の`状態`として扱う。

## 2. Progressive Disclosure

毎回すべてを読まない。ロードを4層に分離する。

```text
L0 Pointer
  00 - CODEX_MODE_POINTER.md
  ↓
L1 Current State
  docs/modes/CODEX_MODE_STATE.json
  ↓
L2 Operating Spec
  docs/modes/CODEX_MODE.md
  ↓
L3 Evidence on demand
  Manifest / Attempt / trace / ZIP / patch
```

### コマンド別ロード

- `状態`: L0 + L1
- `起動`: L0 + L1。Stateがstale、矛盾、または作業実行が必要な場合のみL2
- `続行`: L0 + L1 + L2。選択されたworkstreamに関係するL3だけ読む
- `診断`: L0〜L3をAuthority横断で読む
- `証拠`: L0 + L1 +該当Attempt/Evidence
- `計画`: L0 + L1 + L2。Mutation toolは使わない
- `終了`: L1を更新し、Handoff/Evidenceを書いてから閉じる

大きなZIPや全Protocol traceを起動時に読み込まない。Manifestとdigestを先に読み、必要な一部だけmaterializeする。

## 3. Authority Split

```text
GitHub
= Mode Spec / State Schema / Source / Tests / CI / ADR / history

Google Drive
= Pointer mirror / Artifact / Evidence / Manifest / Handoff

Codex App Server
= official Codex provider runtime

Temporal / Vercel Workflow / Cloudflare Workflows
= replaceable durable orchestration candidates

Akashic
= Context / Routing / Policy / Effect identity /
  Verification / Artifact adoption semantics
```

Stateのmachine-readable正本はGitHub。DriveのStateはcross-session bootstrap用mirror。Driveにある名前だけで`RELEASED`や`CERTIFIED`を判断しない。

## 4. 起動ライフサイクル

### `on_activate`

1. Driveで`00 - CODEX_MODE_POINTER.md`を完全一致検索する。
2. GitHub default branchの`docs/modes/CODEX_MODE_STATE.json`を読む。
3. GitHub main、Provider branch、PRの現在head/stateを再取得する。
4. Drive current Evidence folder、Manifest、誤分類レコードを確認する。
5. `observed_at`と現在値を比較し、差分があれば`STALE`としてreconcileする。
6. 接続済みtool/capabilityを確認する。
7. Status Cardを返す。

### `pre_mutation`

- PLAN modeではmutationを禁止する。
- Source Authority、対象branch、expected headを確認する。
- Credentialやrunnerがないprovider gateは実行済みと偽装しない。
- External mutationはpolicy/confirmation/effect identityを確認する。
- 二つ目のTask Authorityを作らない。

### `post_mutation`

- 最小conformance testを実行する。
- 既存Canonical regressionを実行する。
- source commit、test result、artifact digestをEvidenceへ記録する。
- Current StateとPointerの参照先を更新する。

### `on_failure`

- `FAILED`、`BLOCKED`、`NO_RESULT`を区別する。
- 失敗Attemptを上書きせずappend-only ledgerへ追加する。
- 「final」「release」「certified」という名前へ保存しない。
- 次の再開点と、同じ入力で繰り返してはいけない経路を記録する。

### `on_stop`

- DoD validatorを実行する。
- official binary同一versionの3連続PASS receiptがなければ`CERTIFIED`を拒否する。
- State、Handoff、Drive mirror、Project Indexを更新する。
- Status Cardを最終出力する。

## 5. UX Task Projection

Codexモードの作業は、第二TaskStoreを作らず、GitHub PR/Workflow/Evidenceから次へ投影する。

```text
DRAFT    = 計画・PR Draft・未実行
ACTIVE   = 実行中
BLOCKED  = 必須capability/credential/runner不足
READY    = 実装と検証が完了し、review/adoption待ち
DONE     = canonical mainへ採用し、Evidence保存済み
FAILED   = 実行して失敗証拠がある
ARCHIVED = supersededだが監査目的で保持
```

`READY`は`DONE`ではない。Fixture PASSはProvider Certificationの`READY`にもならない。Provider pathはvalid three-run receiptが得られるまで`BLOCKED`または`FAILED`である。

## 6. Startup Status Card

起動応答は長い説明ではなく、最初に次の5項目を返す。

```text
Codexモード v1.1
Phase: <phase>
Status: <status>
Blocker: <one load-bearing blocker>
Next: <one executable action>
Evidence: <manifest or attempt ledger>
```

詳細は求められた場合、または`診断`/`証拠`コマンド時だけ展開する。

## 7. 現在の能力

Canonical sourceとProvider branchには、少なくとも次の実装がある。

- JSONL / stdio transport
- 長寿命`codex app-server` process管理
- `initialize → initialized`
- version-matched `generate-json-schema` / `generate-ts`
- `model/list`
- 1 `thread/start` + same-thread 2 `turn/start`
- `turn/completed` authority
- timeout時`turn/interrupt`
- approval / inbound server request fail-closed
- `outputSchema` constrained result
- turn 1 `INPUT_REQUIRED`
- turn 2 delta-only continuation
- Task Capsule resend detection
- exact result bytes / ArtifactRef digest/size
- protocol sanitization / secret scan
- Evidence manifest / certification receipt
- fake App Server three-run tests
- Temporal / Vercel / Drive / Cloudflare regression

現在値は本書へ重複記載せず、`docs/modes/CODEX_MODE_STATE.json`から読む。

## 8. Provider Certification Gate

次をすべて満たした場合のみ`CERTIFIED`。

1. official Codex binary
2. binary version記録
3. version-matched generated schema digest
4. `initialize / initialized`
5. `model/list`
6. `thread/start = 1`
7. `turn/start = 2`
8. 両turnで`turn/started / turn/completed`
9. 同一thread ID
10. turn 1 = schema-valid `INPUT_REQUIRED`
11. ContextNeed identity/CAS一致
12. turn 2へTask Capsule再送なし
13. turn 2 = schema-valid `COMPLETED`
14. result bytes一致
15. ArtifactRef digest/size一致
16. sanitized trace
17. secret leakなし
18. 同一Codex versionで3回連続PASS
19. Canonical CI回帰なし
20. machine-readable certification receipt
21. Drive Evidence保存
22. GitHub State/ADR更新

`workflow green`、`adapter test PASS`、`receipt_found=true`だけではProvider PASSではない。

## 9. 現在の真のProvider状態

Current Stateが示すとおり、Providerは「未実行」ではない。

- GitHub-hosted macOS: `BLOCKED` — repository-scoped `OPENAI_API_KEY`なし
- GitHub Models single model: `FAILED`
- GitHub Models matrix: `FAILED`
- valid official three-run receipt: なし
- PR #15: Draft
- Overall certification: `OPEN`

過去の`Official Codex live three-run = NOT RUN`表現はsuperseded。以後は`PROVIDER_ATTEMPTED_FAILED_AND_BLOCKED`を使う。

## 10. 次段階

Provider Certificationが`CERTIFIED`になった後のみ次へ進む。

1. App Server restart / `thread/resume` fault certification
2. `RunCodexTurnActivity`接続
3. Vercel Workflow Agent Port接続
4. authenticated ChatGPT MCP mutation
5. Temporal / Vercel / Cloudflare fixed bake-off
6. Workflow Authorityを一つに選定

## 11. 更新規律

- GitHub Stateを先に更新する。
- Specは安定契約、Stateは現在値として分離する。
- Drive PointerとState mirrorを更新する。
- Attemptはappend-onlyにする。
- `FAILED/BLOCKED/NO_RESULT`を`releases/`へ置かない。
- Project Indexでは最新監査節を過去記録より優先する。
- Activation時に保存済みSHAを盲信せず再取得する。
