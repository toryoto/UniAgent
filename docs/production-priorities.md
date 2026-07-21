# 本番前の優先対応事項

冪等性・セキュリティ境界・運用安定性・テストに関する調査メモ。実装の進捗に応じて本ドキュメントを更新すること。

最終更新: 2026-07-11

## 概要

現状の UniAgent はデモ・開発用途には十分だが、**本番の課金マーケットプレイス**としては以下が未整備。

- API 全体の冪等性設計
- ウォレット・課金まわりのサーバーサイド検証
- HITL 状態の永続化
- 一部 Webhook / 公開 API の保護
- 課金・認証まわりのテスト

推奨ブランチ名: `feature/security-boundaries`

---

## 1. 冪等性（Idempotency）

### 現状

- `Idempotency-Key` や `x-idempotency-key` などの**リクエスト単位の冪等性キーは未実装**
- `x-request-id` はログ相関専用（`with-api-logging` / Agent Service ミドルウェア）
- 部分的な保護のみ存在

| 領域 | 対策 | 効果 |
|------|------|------|
| x402 決済 tx | `Transaction.txHash` の `@unique` + オンチェーン検証 | 同一 tx の評価・アテステーション再利用を防止 |
| Faucet | `checkAndUpdateAccessLimit`（Serializable トランザクション） | レート制限の競合をある程度防止 |
| Webhook（Alchemy） | 署名検証 + `upsert` | 再送されても DB 状態は収束 |
| Webhook（Privy 一部） | `upsertUserWithWallet` | リンク系イベントは再送に強い |
| 設定系 PATCH | `upsert` / 単純 update | 同じ値の再送は実質安全 |

関連コード:

- `agent/src/lib/payment/verify-tx.ts` — txHash リプレイ検出
- `web/src/lib/db/access-limits.ts` — Faucet レート制限
- `web/src/lib/agent/conversation-resolver.ts` — stream 前のメッセージ永続化

### 危険箇所

#### `POST /api/agent/stream`（最重要）

- 冪等性キーなし
- ユーザーメッセージは Agent 実行**前**に DB 保存（`createMessage`）
- 毎回新しい `threadId`（`crypto.randomUUID()`）
- リトライ・二重送信 → **ユーザーメッセージ重複 + エージェント再実行 + x402 二重課金**の可能性

#### `POST /api/agent/resume`（HITL 承認）

- 承認の二重クリック・再送で同一ツールが再実行されうる
- `execute_and_evaluate_agent` は課金ツールのため金銭的リスクが高い

#### x402 決済リトライ（`sendWithRetry`）

- facilitator 競合時に新しい署名クライアントで再送（最大 `MAX_PAYMENT_RETRIES` 回）
- x402 側の冪等性に依存しており、二重決済の可能性はゼロではない

#### 日次予算チェックの競合

- `enforceDailyBudget` はリクエスト開始時の読み取りのみ（check-then-act）
- 並行リクエストで `dailyLimit` を超過しうる

#### Faucet（`POST /api/faucet/usdc`）

- レート制限を**先に消費**してから送金
- 送金失敗時 → クォータだけ消費
- 送金成功後にレスポンス欠落 → 再送は wallet 制限でブロック（受け取ったのに再試行不可）

#### その他

- Privy Webhook `user.created` は `createUser`（upsert ではない）→ 再送で unique 制約エラー
- アシスタントメッセージ保存に重複防止なし（stream 再実行ごとに新規レコード）

### 冪等性の改善案

1. `/api/agent/stream` に `Idempotency-Key`（または client message id）を導入
2. `/api/agent/resume` に `threadId` + decision の重複検出
3. 日次予算を原子的に（予約テーブル or トランザクション内チェック）
4. Faucet は「送金成功後にレート制限消費」または pending → confirmed の 2 段階

---

## 2. セキュリティ境界（冪等性以外の最優先）

### P0 — `walletAddress` のサーバー照合（ウォレット所有権検証）

`/api/agent/stream` は認証後に**クライアント送信の `walletAddress` が DB と照合されず**、そのまま Agent Service へ転送される。他人のウォレットで課金処理を起動できる余地がある。

- `autoApproveThreshold` はサーバー取得（正しい）
- `User.walletAddress`（既存カラム・`@unique`）との照合がない（要対応）

関連: `web/src/lib/agent/agent-route-orchestrator.ts`, `web/src/lib/agent/schemas.ts`

**対応方針（DB マイグレーション不要・`walletId` カラムは追加しない）:**

```text
1. body.walletAddress と user.walletAddress をサーバーで照合（大文字小文字は正規化）
2. isDelegated を DB で確認（既存カラム）
3. 照合 OK なら Agent へ walletId + walletAddress を渡す（現行のリクエスト形状は維持）
```

#### `walletId` との関係

| | `walletAddress` | `walletId` |
|--|-----------------|------------|
| 意味 | オンチェーンのアドレス（0x...） | Privy 内部のウォレット識別子 |
| **所有権検証（P0）** | **サーバー照合の対象** | **照合しない・DB に保存しない** |
| **x402 署名実行** | 表示・ログ用 | Privy API のキーとして Agent 実行時に必要 |

`walletId` は Privy の `signTypedData` に必要だが、所有権の根拠はオンチェーンアドレス側にある。認証ユーザーの `walletAddress` と一致することをサーバーで保証すれば、P0 の目的は達成できる。`User` テーブルへの `walletId` カラム追加は**行わない**。

### P0 — 委託（delegation）のサーバー強制

- `isDelegated` は UI（`ChatView`）で送信ボタン無効化のみ
- `PATCH /api/wallet/delegation` はクライアント申告を DB に書くだけ
- stream API 側では未チェック

**対応案:** stream / resume 前に `isDelegated === true` を必須化。理想は Privy API で session signer の実在確認（現状は DB フラグのみでも第一歩になる）。

### P0 — Agent Service（`:3002`）に認証がない

- `app.use(cors())` のみ。Bearer 検証なし
- Web をバイパスして直接 POST できれば、body にウォレット情報を入れるだけで課金処理を起動可能

関連: `agent/src/server/index.ts`, `web/src/lib/agent/agent-service-client.ts`

---

### P1 — 本番運用・資金保護

#### Privy Webhook の署名検証未実装

```ts
// TODO: Svix署名検証を実装
```

関連: `web/src/app/api/webhooks/privy/route.ts`

なりすまし Webhook でユーザー作成・ウォレット紐付けを操作できる。`user.created` は upsert 化も検討。

#### HITL 状態がインメモリ

- `MemorySaver` checkpointer（`agent/src/core/agent-factory.ts`）
- `thread-cost-store` もプロセス内メモリ

再起動・複数インスタンスで resume 失敗・コスト追跡ずれの可能性。

**対応案:** Postgres / SQLite ベースの checkpointer + thread cost 永続化。

#### Faucet の悪用・順序問題

- 認証なしで `walletAddress` を指定して叩ける
- レート制限を先に消費してから送金

#### 日次予算（dailyLimit）の競合

`getSpentToday` は assistant メッセージの `totalCost` 集計。並行実行時に上限超過しうる。

---

### P2 — 品質・信頼性

#### `maxPrice` 超過時に決済は止められない

決済成功後、`maxPrice` 超過は warn ログのみ。`maxPrice` は LLM がツール引数で決定（プロンプト依存）。

**対応案:** サーバー側で `maxPrice ≤ autoApproveThreshold` および残予算へのハードキャップ。

#### 公開 API のレート制限不足

Faucet 以外（`/api/agent/stream`、IPFS upload、discovery 等）にユーザー単位 quota がない。

#### メタデータアップロードが無認証

`POST /api/agents/register/upload-metadata` に認証なし。

---

## 3. 優先度マトリクス

| 優先度 | 課題 | カテゴリ | DB マイグレーション |
|--------|------|----------|---------------------|
| P0 | `walletAddress` 所有権検証 | セキュリティ | **不要** |
| P0 | Agent Service 認証 | セキュリティ | 不要 |
| P0 | delegation のサーバー強制 | セキュリティ | 不要 |
| P1 | Privy Webhook 署名 | セキュリティ | 不要 |
| P1 | HITL 永続化 | 運用 | 要（checkpointer 次第） |
| P1 | Faucet 強化 | 資金 | 任意 |
| P1 | stream / resume 冪等性 | 信頼性 | 要（Idempotency テーブル等） |
| P2 | 日次予算の原子性 | 資金 | 任意 |
| P2 | maxPrice ハードキャップ | 資金 | 不要 |
| P2 | 統合テスト追加 | 品質 | 不要 |
| P3 | API レート制限 | 運用 | 不要 |

---

## 4. 推奨実装順序

### セキュリティ（マイグレーションなしで着手可）

1. `walletAddress` 照合 + `enforceDelegation`（`agent-route-orchestrator.ts`）
2. `AGENT_SERVICE_TOKEN`（`agent/src/server/index.ts` + `agent-service-client.ts`）
3. Privy Webhook Svix 署名 + `user.created` upsert
4. 上記の unit test 追加

### その後

5. HITL 永続化（checkpointer + thread cost）
6. 冪等性（stream / resume）
7. 予算・Faucet の原子性
8. API レート制限

---

## 5. テストを書くべき箇所

現状は 12 テストファイル・ユーティリティ中心。課金・認証・API オーケストレーションはほぼ未カバー。

### 既存カバー済み

| 場所 | 内容 |
|------|------|
| `agent/src/__tests__/auto-approve.test.ts` | HITL 自動承認判定 |
| `agent/src/__tests__/thread-cost-store.test.ts` | 累積コスト保持 |
| `web/src/lib/agent/__tests__/apply-stream-event.test.ts` | SSE イベントの UI 反映 |
| `packages/shared/src/__tests__/*` | SSE バッファ、logger 等 |
| `contracts/test/*` | コントラクト |

### 優先して追加（実装とセット）

| 順 | ファイル | 対象 |
|----|----------|------|
| 1 | `web/src/lib/agent/__tests__/agent-route-orchestrator.test.ts` | `verifyWalletAddress`（`walletAddress` 照合のみ）, `enforceDelegation`, `enforceDailyBudget` |
| 2 | `agent/src/__tests__/server-auth.test.ts` | `AGENT_SERVICE_TOKEN` / `x-service-token` |
| 3 | `web/src/lib/agent/__tests__/schemas.test.ts` | `autoApproveThreshold` がクライアントから来ないこと |
| 4 | `agent/src/__tests__/verify-tx.test.ts` | txHash リプレイ |
| 5 | `web/src/lib/agent/__tests__/conversation-resolver.test.ts` | 会話の越権アクセス |
| 6 | `web/src/lib/db/__tests__/budget-settings.test.ts` | 日次予算集計 |
| 7 | `web/src/lib/db/__tests__/access-limits.test.ts` | Faucet レート制限 |
| 8 | `agent/src/__tests__/agent-execution.test.ts` | `sendWithRetry` |
| 9 | `web/src/lib/privy/__tests__/webhook.test.ts` | Svix 署名（実装後） |

### テスト種別

```text
単体（Vitest + モック）  ← 最優先。lib/ の検証関数・オーケストレータ
統合（Vitest + テスト DB） ← access-limits, budget-settings
E2E                       ← 後回し。LLM / Privy / オンチェーンは使わない
```

---

## 6. 比較的安全な箇所（現状）

- `GET` 系 API（会話一覧、予算取得など）
- `PATCH /api/wallet/budget`, `PATCH /api/wallet/delegation`（同値再送は問題になりにくい）
- Alchemy Webhook（署名 + upsert）
- txHash ベースのリプレイ検出（評価・アテステーション用途に限定）
- `autoApproveThreshold` のサーバーサイド取得（クライアント値を信用しない）

---

## 7. 関連ドキュメント

- [architecture.md](architecture.md) — セキュリティ境界・x402 フロー
- [ai-agent-operational-notes.md](ai-agent-operational-notes.md) — `autoApproveThreshold` の運用ルール
- [coding-conventions.md](coding-conventions.md) — レイヤー分離・DB 配置
