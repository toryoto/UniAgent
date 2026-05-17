# AI Agent Operational Notes

## プロダクトの流れ

UniAgent は、ユーザーの自然言語依頼からオンチェーン AgentRegistry を検索し、外部 A2A Agent を x402 micropayment つきで実行する Agent marketplace です。

```text
web UI
  -> agent service
  -> LangChain ReAct agent
  -> discover_agents / fetch_agent_spec / execute_and_evaluate_agent
  -> AgentRegistry / DB cache / external A2A agents
  -> SSE streaming events back to web
```

Agent は「Web 内のダミー API」ではなく、`a2a-agents` または外部ホストの `.well-known/agent.json` を AgentRegistry に登録して使います。`web/src/app/api/agents/*` に新しいダミールートを戻さないでください。

## Monorepo と責務

| Workspace            | 役割                                        | 既定ポート |
| -------------------- | ------------------------------------------- | ---------- |
| `web/`               | Next.js 16 + React 19 の UI/API routes      | `3000`     |
| `agent/`             | LangChain ReAct Agent service               | `3002`     |
| `mcp/`               | Legacy MCP server。現在の実行経路では未使用 | `3001`     |
| `a2a-agents/`        | 外部 A2A HTTP Agent 群                      | `3003`     |
| `contracts/`         | Hardhat smart contracts / deploy scripts    | -          |
| `packages/shared/`   | DB 非依存の型、定数、純粋関数               | -          |
| `packages/database/` | Prisma Client と共有 DB アクセス            | -          |

依存方向は `shared -> database -> app workspaces` です。`packages/shared` から Prisma、Next.js、Node API、環境変数に依存しないでください。

## 作業ルール

- 依存追加と `npm install` は必ずリポジトリルートで実行します。サブワークスペースで lockfile を作らないでください。
- 既存パターンに合わせ、共通化は実際に複数箇所の複雑さを減らす場合だけ行います。
- API Route、Server Component、Agent tool で DB を触るときは、既存の DB helper を優先します。Prisma Client の直 import は避けてください。
- LangChain は `@langchain/core` 1.1.19 系です。v0 系から破壊的変更があるため、Agent 実装や LangChain API 変更時は必ず Context7 MCP などで LangChain v1.1 系の最新ドキュメントを確認してください。
- 秘密情報、wallet private key、service role key、`.env`、credential JSON はコミットしないでください。
- on-chain state、Vercel env、本番デプロイ、Supabase schema など外部状態を変える操作は、ユーザーの明示依頼または明確な合意なしに実行しないでください。

## DB と Prisma の配置

DB アクセスは「共有」と「web 固有」で分けます。

| 配置                | 対象                                | 例                                                                    |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `packages/database` | 複数 workspace から使うモデル・検索 | `discoverAgents`、AgentCache 検索                                     |
| `web/src/lib/db`    | Web 認証、会話、UI/API 固有の永続化 | User、Conversation、Message、BudgetSettings、AccessLimit、Attestation |

`autoApproveThreshold` はセキュリティ境界です。クライアントから送らせず、`/api/agent/stream` と `/api/agent/resume` で認証後に DB の `BudgetSettings` から取得して Agent Service に渡します。

## 外部 MCP ツールの使い分け

このセクションの MCP は Cursor/Supabase/Context7 などの外部 MCP ツールを指します。リポジトリ内の `mcp/` workspace は legacy で、現在の Agent discovery / execution flow では使用しません。`mcp/` に新規機能を追加したり、現役経路として前提にしたりしないでください。

### Supabase MCP

Supabase は主に Postgres 運用、調査、ログ確認のために使います。

- スキーマ変更前に `list_tables` で既存構造を確認します。
- 不具合調査では `get_logs` と `get_advisors` を先に見ます。
- SQL の検証や一時調査は MCP の SQL 実行系または Supabase CLI を使い、最終的なアプリ実装は Prisma schema / migration / DB helper と整合させます。
- RLS、Auth、Storage、View、Function に触るときは、公開 schema と権限境界を必ず確認します。
- `service_role` や secret key をクライアントに出さないでください。`NEXT_PUBLIC_` はブラウザ公開値です。

### Vercel MCP / CLI

Vercel は `web` のデプロイ、環境変数、ログ、Preview URL の確認に使います。

- デプロイ失敗調査では、まず deployment status、build logs、environment variables、project linkage を確認します。
- monorepo では `.vercel` の link 状態と対象 project/team を確認してから CLI 操作します。
- CI や自動化では interactive prompt を避け、必要なら `--yes` や `VERCEL_TOKEN` を使います。
- 明示依頼なしに `vercel --prod`、env の追加・削除・変更、domain 設定変更を実行しないでください。

### Context7 MCP

Context7 はライブラリや SaaS の最新仕様を確認するために使います。

- Next.js、React、Prisma、Supabase、Vercel、x402、Privy、LangChain などの API や設定を書く前に使います。
- まず library ID を解決し、ユーザーの質問や実装対象に近い query で docs を取得します。
- 既存コードのローカル規約と公式ドキュメントが衝突する場合は、既存規約を優先しつつ、変更が必要なら理由を明記します。

### Foundry `cast`

このリポジトリの contract 開発は Hardhat が主です。Foundry の `cast` は Base Sepolia や local node の読み取り調査用に使います。

よく使う用途:

```bash
cast call <contract> "<signature>" <args> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast code <contract> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast logs --address <contract> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast tx <txHash> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast receipt <txHash> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance <address> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast block latest --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

`cast send`、private key を使う操作、登録・送金・承認など状態変更を伴う操作は、ユーザーの明示承認がある場合だけ実行します。RPC URL や private key は `.env` または安全な shell 環境から読み、ログに秘密情報を出さないでください。

## Agent / x402 / A2A の暗黙知

- `discover_agents` と `fetch_agent_spec` は実行前の低コスト調査に使います。
- `discover_agents` は広い条件だと役割の違う Agent が混ざるため、フライト、ホテル、観光など役割ごとに検索条件を分けます。
- Agent 実行前に `.well-known/agent.json`、endpoint、input schema、price、receiver、network を確認します。
- x402 は Base Sepolia USDC と EIP-3009 署名を前提にしています。Privy delegated wallet の署名処理を変更するときは、支払い失敗時の recoverability とエラーメッセージを重視してください。
- SSE event は `start`、`log`、`content`、`tool_call`、`payment`、`end`、`error` を既存 UI が期待します。イベント名を変更する場合は UI と Agent Service の両方を確認します。

## 検証方針

- 小さな docs 変更: markdown の整合性とリンク・コマンド表記を確認します。
- TypeScript 変更: `npm run type-check` と関連 workspace の `npm run lint --workspace=<name>` を優先します。
- Next.js UI/API 変更: `npm run build --workspace=web` まで見ると安全です。
- Agent service や外部 MCP ツール連携の変更: 対象 workspace の type-check/lint に加え、実際の tool 入出力や SSE event を確認します。
- Contract 変更: `npm run compile --workspace=contracts` と `npm run test --workspace=contracts` を実行し、必要に応じて `cast call` で deployed state を確認します。
