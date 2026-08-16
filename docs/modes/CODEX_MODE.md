---
schema: akashic.codex-mode/v1.2
mode_id: codex-mode
mode_version: 1.2.0
activation_phrase: "codexモード起動"
status_source: docs/modes/CODEX_MODE_STATE.json
handoff_source: docs/modes/CODEX_MODE_HANDOFF.json
source_authority: GitHub
artifact_evidence_authority: Google Drive
github_repository: tanakaryotadayo-wq/whatever
github_canonical_path: docs/modes/CODEX_MODE.md
drive_root_id: 1xrqptlQ_Ca6NQyYEFSrL9r9Skn81l05Y
drive_pointer_title: "00 - CODEX_MODE_POINTER.md"
drive_fallback_spec_title: "CODEX_MODE.md"
updated_at: 2026-08-16
---

# Codexモード v1.2 — Akashic Codex実行モード

## 0. 一文定義

`codexモード起動`は、過去会話を思い出す合図ではない。

> Pointer → Current State → Handoff → Stable Spec → selected Evidence の順に必要な情報だけを読み、現在実行可能な一つのゲートを選び、実行・検証・保存まで閉じる決定論的bootstrapである。

メモリは入口の索引にのみ使う。現在地、成功、失敗、commit、Evidenceは毎回Authorityから再取得する。

## 1. コマンド面

| コマンド | Intent | 動作 | Mutation |
|---|---|---|---|
| `codexモード起動` | BOOT | Stateを同期し、次の実行可能ゲートを選ぶ | 必要時のみ |
| `codexモード 状態` | STATUS | PointerとStateだけでStatus Cardを返す | なし |
| `codexモード 続行` | RESUME | StateとHandoffを読み、前回の一手を再開する | あり |
| `codexモード 診断` | DIAGNOSE | GitHub・Drive・PR・Evidenceを横断監査する | 修復前はなし |
| `codexモード 証拠` | EVIDENCE | Attempt LedgerとEvidence参照を表示する | なし |
| `codexモード 計画` | PLAN | Goal/Scope/DoD/Out of Scopeを更新する | なし |
| `codexモード 引継ぎ` | HANDOFF | 現在のWork Packetと再開点を表示・保存する | 保存のみ |
| `codexモード 終了` | CLOSE | State/Handoff/Evidenceを更新して閉じる | 保存のみ |

自然言語の別名は同じIntentへ正規化してよい。曖昧な依頼はMutationせず`STATUS`へ倒す。

## 2. Progressive Disclosure

```text
L0 Pointer
  docs/modes/CODEX_MODE_POINTER.md
  Drive: 00 - CODEX_MODE_POINTER.md
  ↓
L1 Current State
  docs/modes/CODEX_MODE_STATE.json
  ↓
L1.5 Active Handoff（RESUME/HANDOFF時）
  docs/modes/CODEX_MODE_HANDOFF.json
  ↓
L2 Stable Operating Spec
  docs/modes/CODEX_MODE.md
  ↓
L3 Selected Evidence
  Manifest / Attempt / trace / ZIP / patch
```

コマンド別ロード:

- `状態`: L0 + L1
- `起動`: L0 + L1。stale/矛盾/実行時のみL1.5/L2
- `続行`: L0 + L1 + L1.5 + 必要なL2/L3
- `診断`: L0〜L3をAuthority横断
- `証拠`: L0 + L1 + 該当L3
- `計画`: L0 + L1 + L2。Mutation tool禁止
- `引継ぎ`: L1 + L1.5
- `終了`: State/Handoff/Evidence更新後に閉じる

大きなZIPや全Protocol traceを起動時に読まない。Manifestとdigestを先に読み、必要な一部だけmaterializeする。

## 3. Authority split

```text
GitHub
= Mode Spec / Current State / Handoff contract / Source / Tests / CI / ADR / history

Google Drive
= Pointer mirror / Artifact / Evidence / Manifest / cross-session Handoff mirror

Codex App Server
= official Codex provider runtime

Temporal / Vercel Workflow / Cloudflare Workflows
= replaceable durable orchestration candidates

Akashic
= Context / Routing / Policy / Effect identity /
  Verification / Artifact adoption semantics
```

HandoffはTask Authorityではない。Taskの真実を複製せず、次のセッションが再開するための署名付き投影として扱う。

## 4. State integrity

Current Stateは**snapshot**であり、自分自身を含むmain commitのexact SHAを正本化しない。

```text
reconciled_against_main_head
= State生成前に照合したmainの基準commit

main_head_relation
= ANCESTOR_OR_EQUAL
```

Activation時にlive main headを再取得し、`reconciled_against_main_head`が祖先または同一かを確認する。完全一致を要求すると、State更新commit自身で即座にstaleになるため禁止する。

Provider branch headは`observed_at`時点の観測値。変化していればStateを`STALE`としてreconcileする。

## 5. Role pipelineとHandoff Contract

既存の「Codex App＝司令塔、CLI＝実働」という分担を、製品名ではなく意味論として吸収する。

```text
SUPERVISOR
  Goal / Scope / DoD / Out of Scope / authority / expected headを固定
       ↓ Work Packet
EXECUTOR
  許可pathだけ変更し、commands/tests/artifacts/risksを返す
       ↓ Result Packet
VERIFIER
  DoD・digest・回帰・provenanceを独立検証
       ↓ Adoption decision
SUPERVISOR
  State/Handoffを更新し、READY/DONE/FAILED/BLOCKEDを裁定
```

同じAssistantが三役を順番に担ってもよいが、役割境界と出力契約を省略しない。

### Work Packet

最低限:

- `goal`
- `scope`
- `definition_of_done`
- `out_of_scope`
- `authority`
- `expected_heads`
- `allowed_paths`
- `protected_paths`
- `evidence_required`
- `do_not_repeat_without_change`

### Executor Result

最低限:

- `files_changed`
- `commands_run`
- `test_results`
- `artifact_refs`
- `remaining_risks`
- `dod_check`
- `next_recommended_action`

### Adoption rule

`EXECUTOR`の自己申告だけでDONEにしない。`VERIFIER`がDoDとEvidenceを確認し、Source Authorityへ採用され、Drive Evidenceが保存された時だけDONE。

## 6. Lifecycle

### `on_activate`

1. Pointerを読む。
2. Current Stateを読む。
3. main/provider heads、PR状態を再取得する。
4. snapshot relationとfreshnessを検証する。
5. RESUMEならHandoffを読む。
6. 必要なEvidenceだけ読む。
7. Status Cardを返す。

### `pre_mutation`

- PLAN modeではMutation禁止。
- Source Authority、対象branch、expected head、allowed/protected pathsを確認。
- credential/runner不足のprovider gateを成功扱いしない。
- External mutationはpolicy/confirmation/effect identityを確認。
- 二つ目のTask Authorityを作らない。

### `post_mutation`

- 最小conformance testとCanonical regressionを実行。
- source commit、test result、artifact digestをResult Packetへ記録。
- VERIFIERがDoDを判定。
- State/Handoff/Manifest/Drive mirrorを更新。

### `on_failure`

- `FAILED`、`BLOCKED`、`NO_RESULT`を区別。
- Attemptを上書きせずappend-onlyで記録。
- 同じ仮説・同じ入力での無意味な再試行を禁止。
- `final`、`release`、`certified`名で保存しない。
- 次の再開点をHandoffへ残す。

### `on_stop`

- DoD validatorを実行。
- official binary同一versionの3連続PASS receiptがなければ`CERTIFIED`拒否。
- State/Handoff/Manifest/Drive mirror/Project Indexを更新。
- 最終Status Cardを返す。

## 7. UX Task Projection

```text
DRAFT    = Work Packet作成中
ACTIVE   = Executor実行中
BLOCKED  = 必須capability/credential/runner不足
READY    = 実装と検証が完了し、adoption待ち
DONE     = canonical main採用 + Evidence保存済み
FAILED   = 実行して失敗証拠あり
ARCHIVED = supersededだが監査保持
```

`READY`は`DONE`ではない。Fixture PASSはProvider CertificationのREADYにもならない。

## 8. Status Card

最初に長い説明をせず、次を返す。

```text
Codexモード v1.2
Phase: <phase>
Status: <status>
Role: <current role>
Blocker: <one load-bearing blocker>
Next: <one executable action>
Evidence: <manifest / handoff / attempt>
```

`npm run codex:status`は同じ投影を決定論的に出力する。

## 9. 現在の能力

Canonical sourceとProvider branchには少なくとも次がある。

- JSONL / stdio transport
- 長寿命`codex app-server` process管理
- `initialize → initialized`
- version-matched schema generation
- `model/list`
- 1 `thread/start` + same-thread 2 `turn/start`
- `turn/completed` authority
- timeout時`turn/interrupt`
- approval/inbound request fail-closed
- `outputSchema` constrained result
- turn 1 `INPUT_REQUIRED`
- turn 2 delta-only continuation
- Task Capsule resend detection
- exact result bytes / ArtifactRef digest/size
- protocol sanitization / secret scan
- Evidence manifest / certification receipt
- fake App Server three-run tests
- Temporal / Vercel / Drive / Cloudflare regression

現在値は本書へ重複記載せず、`CODEX_MODE_STATE.json`から読む。

## 10. Provider Certification Gate

次をすべて満たした場合のみ`CERTIFIED`。

1. official Codex binary
2. binary version記録
3. version-matched schema digest
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

workflow green、adapter test PASS、receipt fileの存在だけではProvider PASSではない。

## 11. 次段階

Provider Certificationが`CERTIFIED`になった後のみ:

1. App Server restart / `thread/resume` fault certification
2. `RunCodexTurnActivity`接続
3. Vercel Workflow Agent Port接続
4. authenticated ChatGPT MCP mutation
5. Temporal / Vercel / Cloudflare fixed bake-off
6. Workflow Authorityを一つに選定

## 12. 更新規律

- GitHub State/Handoffを先に更新する。
- Specは安定契約、Stateはsnapshot、Handoffは再開投影として分離する。
- Drive Pointer/State/Handoff/Manifest mirrorを更新する。
- Attemptはappend-only。
- `FAILED/BLOCKED/NO_RESULT`を`releases/`へ置かない。
- Project Indexでは最新監査節を過去記録より優先する。
- Activation時に保存済みSHAを盲信せず再取得する。
