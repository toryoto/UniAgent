# コーディング規約

UniAgent モノレポ全体で守る設計・配置・ドキュメントの指針です。AI エージェント向けの要約は `CLAUDE.md` の **Coding Conventions** を参照してください。

## 基本原則

1. **関心の分離**: UI、HTTP 境界、永続化、ドメインロジック、外部 I/O を混ぜない。
2. **既存パターンに合わせる**: 新規抽象化は、実際に複数箇所の複雑さを減らす場合だけ導入する。
3. **依存方向を守る**: 下位パッケージは上位 workspace に依存しない。
4. **最小 diff**: 依頼範囲外のリファクタや「ついで」の共通化は避ける。

## パッケージ境界と依存方向

```text
packages/shared  (DB・フレームワーク非依存)
       ↓
packages/database  (Prisma + shared への委譲)
       ↓
web / agent / a2a-agents / contracts  (アプリケーション workspace)
```

| 配置 | 置くもの | 置かないもの |
| ---- | -------- | ------------ |
| `packages/shared/` | 共通型、定数、純粋関数、ABI JSON、フレームワーク非依存ユーティリティ | Prisma、Next.js、React、Privy、環境変数読み取り、HTTP クライアント |
| `packages/database/` | Prisma Client、複数 workspace から使う DB クエリ | UI ロジック、認証、Web/API 固有の永続化 |
| `web/src/lib/db/` | User、Conversation、Message、BudgetSettings など Web 固有の永続化 | Agent Service 専用のクエリ |
| `agent/` | LangChain Agent、tool、A2A/x402 連携、Agent Service 専用 DB helper | React コンポーネント、Next.js Route Handler |
| `a2a-agents/` | 外部 A2A HTTP Agent、x402 ミドルウェア、`.well-known/agent.json` | マーケットプレイス UI、会話履歴 |
| `contracts/` | Solidity、Hardhat deploy/test | アプリ側ビジネスロジック |

### `packages/shared` に置く判断基準

次の **すべて** を満たすときだけ shared に移す。

- **2 つ以上** の workspace から使う（または近い将来使う見込みが明確）
- DB・React・Next.js・特定 SDK に依存しない
- 副作用がなく、テストしやすい（型・定数・純粋関数・変換ロジック）

例: `discoverAgentsFromCache`、`AgentCacheRow` 型、`CONTRACT_ADDRESSES`、`createLogger`

逆に、1 workspace だけの都合（Privy 認証、SSE 永続化、Registration guard など）はその workspace に留める。

### DB アクセスの分離

| 層 | 責務 |
| -- | ---- |
| `packages/database` | AgentCache 検索など、agent/web 双方から使うモデル |
| `web/src/lib/db/*` | 認証ユーザー、会話、予算設定、Attestation など Web 固有 |
| `agent/src/services/*` | Agent Service 専用の DB 操作（例: attestation-db） |

**禁止**: API Route / Server Component / React コンポーネントから `@prisma/client` や `prisma` を直接 import しない。必ず `web/src/lib/db/` 経由にする。

## ディレクトリ構成

### `web/`

```text
web/src/
  app/              # App Router: page.tsx, layout.tsx, api/**/route.ts
  components/       # UI コンポーネント（feature ごとにサブディレクトリ）
  lib/
    db/             # Web 固有の DB アクセス（Prisma はここだけ）
    hooks/          # クライアント用 React hooks
    auth/           # 認証・トークン検証
    agent/          # Agent SSE 連携など Web↔Agent 境界
    blockchain/     # wagmi / コントラクト呼び出し（Web 固有）
    registration/   # Agent 登録フロー（guards 等）
    utils/          # 純粋ユーティリティ（共通化対象なら shared へ）
```

- **`app/api/**/route.ts`**: 認証・入力検証・オーケストレーションのみ。永続化は `lib/db`、ドメインロジックは `lib/*` または shared へ。
- **`components/`**: 表示とユーザー操作。fetch / Prisma / 環境変数の直接参照は避け、hooks または Server Component から props で渡す。
- **`lib/hooks/`**: クライアント状態と API 呼び出し。Server-only コードを import しない。

### `agent/`

```text
agent/src/
  core/       # Agent 実行、ストリーミング、メッセージ組み立て
  tools/      # LangChain tools（discover / fetch / execute 等）
  lib/        # A2A、x402、payment など外部連携
  services/   # Agent Service 専用の DB・評価・Attestation
  prompts/    # システムプロンプト、評価プロンプト
  config/     # 定数（workspace 固有。複数 workspace で使うなら shared）
  server/     # HTTP サーバー入口
```

- **tools**: 1 tool = 1 ファイル。tool 内に HTTP サーバー起動や UI ロジックを書かない。
- **lib/**: プロトコル実装（A2A、x402）。ビジネス判断は core / tools / shared に分ける。

### `a2a-agents/`

```text
a2a-agents/
  src/              # 共通 A2A サーバー基盤（routes, middleware, response）
  hotel-agent/      # 個別 Agent workspace（必要に応じて増やす）
    src/
      tools/        # Agent 固有 tool
      server.ts     # 起動入口
```

個別 Agent にしかないロジックは `hotel-agent/` 以下に閉じ、複数 Agent で使う HTTP/x402 基盤だけ `a2a-agents/src/` に置く。

## 関心の分離（レイヤー別）

```text
[UI / Route Handler]  →  入力検証・認可・レスポンス整形
        ↓
[Application / lib]     →  ユースケース orchestration
        ↓
[Domain / shared]       →  純粋ロジック・型・定数
        ↓
[Infrastructure]      →  DB (lib/db, packages/database), 外部 API, chain
```

具体例:

- **`/api/agent/stream`**: Route で Privy 認証 → `lib/db` で BudgetSettings 取得 → Agent Service へプロキシ。`autoApproveThreshold` はクライアント入力を信用せず DB から読む。
- **`discoverAgents` (database)**: SQL / Prisma で行取得 → `discoverAgentsFromCache` (shared) で変換・フィルタ。
- **ChatView**: メッセージ表示とスクロール。SSE 接続は `useAgentStream` に委譲。

## TSDoc の書き方

TSDoc は **読者が意図を誤解しやすい箇所** にだけ書く。自明なコードへの冗長なコメントは避ける。

### 書く

| 対象 | 内容 |
| ---- | ---- |
| 公開 export 関数・クラス | 1 行概要 + 必要なら `@param` / `@returns` |
| モジュール全体 | ファイル先頭に `@module` と責務（例: `lib/payment/x402-client`） |
| セキュリティ境界 | 信用してはいけない入力、サーバー側で再取得する値 |
| 非自明なビジネスルール | スコア計算、自動承認閾値、プロトコル上の前提 |
| 外部プロトコル連携 | x402 の再送フロー、A2A メッセージ形式、SSE イベント契約 |

### 書かない

- getter/setter や `{ cn }` のような自明なユーティリティ
- 実装の逐語訳（`// increment counter` など）
- 変更のたびに陳腐化する内部実装詳細

### 形式の例

```typescript
/**
 * @module lib/payment/x402-client
 * x402 対応 fetch クライアントのファクトリ。
 */

/**
 * AgentCache 行を DiscoveredAgent に変換する。
 * attestation スコアと staking 量は shared 側のランキング式に従う。
 *
 * @param row - DB から取得した生行（JSON フィールドは未パース）
 * @returns UI / Agent tool 向けの正規化済みエージェント
 */
export function agentCardRowToDiscoveredAgent(row: AgentCacheRow): DiscoveredAgent { ... }
```

React コンポーネントでは、props の意味が型名から明らない場合のみ JSDoc を付ける（例: 「下端追従スクロールを有効にする距離(px)」）。

## TypeScript・命名・export

- **`any` は避ける**。外部 JSON は parse 後に型を絞る（必要なら Zod）。
- **named export を優先**し、パッケージ公開 API は `index.ts` で re-export する。
- **ファイル名**: kebab-case（`agent-sse-persistence.ts`）。React コンポーネントは PascalCase（`ChatView.tsx`）。
- **import パス**: workspace 内は相対または `@/`（web）。パッケージ間は `@agent-marketplace/shared` 等の workspace 名を使う。
- **環境変数**: クライアントに必要なものだけ `NEXT_PUBLIC_`。秘密情報・閾値・DB URL はサーバー側のみ。

## ロギング

`@agent-marketplace/shared/logger`（pino ベース）を全 workspace で使う。`console.*` はサーバーコードでは使わない（CLI スクリプトは除く）。

- **API**: pino ネイティブの引数順に従う — `log.info({ key: value }, 'message')`。メッセージは固定文字列にし、可変値は第 1 引数のオブジェクトに入れる。
- **ロガー取得**: ファイル先頭で `const log = createLogger('component')`。component は kebab-case（agent / payment / logic / eval / http、web は `conversations-api` 等）。
- **エラー**: `log.error({ err }, 'message')` の `err` キーに Error オブジェクトをそのまま渡す（pino の serializer が stack 付きで構造化する）。`error.message` を手で展開しない。
- **トレーサビリティ**: リクエスト境界で `runWithLogContext({ requestId }, ...)`、実行単位確定時に `bindLogContext({ threadId })`。スコープ内の全ログに自動付与されるため、個々のログに threadId を手書きしない。
- **レベル**: trace/debug/info/warn/error/fatal のみ（`success` は使わない）。冗長な中間状態は `debug`。出力レベルは `LOG_LEVEL` 環境変数で制御（デフォルト info）。
- **機密情報**: privateKey / apiKey / authorization 等は redact で自動マスクされるが、深いネストは対象外。秘密情報はそもそもログに含めない。
- **出力**: 開発は pino-pretty（色付き）、本番（NODE_ENV=production）は JSON 1 行。web で pino を使う場合は `next.config.ts` の `serverExternalPackages` に含めたままにする。

## テストと検証

- 純粋関数（shared）はユニットテスト向き。副作用のある Route / tool は既存 test パターンに合わせる。
- 変更後は `npm run type-check`、`npm run lint`、該当 workspace の build/test を実行する（`CLAUDE.md` の Verification 参照）。

## やってはいけないこと

- `web/src/app/api/agents/*` にダミー Agent ルートを復活させる
- `packages/shared` から Prisma / Next / React を import する
- クライアント送信値の `autoApproveThreshold` をそのまま Agent Service に渡す
- 1 箇所でしか使わないコードを早合目に shared へ移す
- UI コンポーネント内で Prisma クエリを直接書く
