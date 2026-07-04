# CLAUDE.md

AI coding agent 向けのリポジトリガイドです。`AGENTS.md` はこのファイルへの symlink として管理します。詳細は `docs/coding-conventions.md`（コーディング規約）と `docs/ai-agent-operational-notes.md`（運用メモ）を参照してください。

## Project Snapshot

UniAgent は A2A、x402、Base Sepolia、Privy を組み合わせた分散 AI Agent マーケットプレイスです。ユーザーの依頼を Web UI で受け、Agent Service が AgentRegistry や DB キャッシュから Agent を探索し、x402 決済つきで外部 A2A Agent を実行します。

```text
User -> web -> agent -> AgentRegistry / DB cache
                 |
                 v
            External A2A Agent
                 |
                 v
          SSE events back to web
```

## Repository Rules

- パッケージ管理は npm workspaces + Yarn 1.22.19 です。依存追加や `npm install` は必ずリポジトリルートで実行し、サブワークスペースに lockfile を作らないでください。
- `web/` は Next.js 16 + React 19、`agent/` は LangChain ReAct Agent、`contracts/` は Hardhat、`a2a-agents/` は外部 A2A HTTP Agent 群です。
- LangChain は `@langchain/core` 1.1.19 系です。v0 系から破壊的変更があるため、Agent 実装や LangChain API 変更時は必ず Context7 MCP などで LangChain v1.1 系の最新ドキュメントを確認してください。
- 共通型・純粋ロジックは `packages/shared/`、Prisma Client と共有 DB アクセスは `packages/database/` に置きます。
- Web 固有の DB アクセスは `web/src/lib/db/` に閉じ込め、API Route や Server Component から Prisma を直接 import しないでください。
- Web の `/api/agents/*` ダミールートは削除済みです。Agent endpoint は `a2a-agents` または外部ホストの `.well-known/agent.json` を AgentRegistry に登録します。
- `autoApproveThreshold` はサーバーサイドで DB から取得し、クライアントから送られた値は信用しないでください。

## Coding Conventions

モノレポ全体の設計・配置・TSDoc の指針です。詳細は `docs/coding-conventions.md` を参照してください。

### 関心の分離

- **UI (`web/components`)**: 表示と操作のみ。Prisma・秘密 env・Agent Service 直叩きは書かない。
- **API Route (`web/app/api`)**: 認証・入力検証・オーケストレーション。永続化は `web/src/lib/db/`、共有ロジックは `packages/shared/` へ委譲する。
- **Agent Service (`agent/`)**: LangChain tools / A2A / x402。React や Next.js に依存しない。
- **A2A Agent (`a2a-agents/`)**: 外部 HTTP Agent と `.well-known/agent.json`。マーケットプレイス UI や会話 DB は触らない。

レイヤーは `Route/UI → lib(orchestration) → shared(domain) → db/external` の順で依存する。

### パッケージ配置

| 置き場所 | 対象 |
| -------- | ---- |
| `packages/shared/` | 2 workspace 以上で使う型・定数・純粋関数（DB/フレームワーク非依存） |
| `packages/database/` | 複数 workspace 向け Prisma クエリ（変換・フィルタは shared に委譲） |
| `web/src/lib/db/` | Web 固有の永続化（User, Conversation, BudgetSettings 等） |
| 各 workspace 内 `lib/` | その workspace 専用の外部連携・ユースケース |

**shared に移す条件**: 複数 workspace で使う + 副作用なし + Prisma/React/Next に依存しない。1 箇所だけの都合は早合目に shared へ移さない。

**依存方向**: `shared → database → app workspaces`。`packages/shared` から Prisma や Next.js を import しない。

### ディレクトリ

- **`web/src/lib/db/`**: Web から Prisma を触る唯一の層。Route/Component から `@prisma/client` 直 import 禁止。
- **`web/src/lib/hooks/`**: クライアント用 hooks。Server-only コードを import しない。
- **`agent/src/tools/`**: 1 tool = 1 ファイル。`core/` は実行・ストリーム、`lib/` は A2A/x402 等のプロトコル実装。
- **`a2a-agents/src/`**: 共通 A2A 基盤。個別 Agent 固有ロジックは `hotel-agent/` 等のサブ workspace に閉じる。

### TSDoc

- **書く**: 公開 export、セキュリティ境界（信用しない入力）、非自明なビジネスルール、外部プロトコル（x402/A2A/SSE）の前提。
- **書かない**: 自明なユーティリティ、実装の逐語訳コメント。
- ファイル先頭に `@module`、公開関数に 1 行概要 + 必要なら `@param` / `@returns`。

### その他

- named export と `index.ts` による re-export を優先する。
- `any` は避け、外部 JSON は parse 後に型を絞る。
- 共通化は「複数箇所の複雑さを実際に減らす」ときだけ行う（YAGNI）。

## Frequent Commands

```bash
npm install
npm run dev
npm run dev --workspace=agent
npm run build
npm run lint
npm run type-check
npm run test
npm run compile --workspace=contracts
npm run deploy:base-sepolia --workspace=contracts
```

Prisma 関連は `web` の script 経由で実行します。

```bash
npm run db:generate --workspace=web
npm run db:push --workspace=web
npm run db:studio --workspace=web
```

## External Tooling

Cursor / Supabase / Context7 などの外部 MCP ツールの使い分けです。

- Supabase MCP: DB 構造確認、ログ、Advisor、SQL 検証に使います。スキーマ変更前は既存テーブルと RLS/権限を確認してください。
- Vercel MCP/CLI: `web` のデプロイ状況、Preview/Production URL、ログ、環境変数確認に使います。明示依頼なしに本番 deploy や env 変更をしないでください。
- Context7 MCP: Next.js、React、Prisma、Supabase、Vercel、x402 などの API や設定を書く前に最新ドキュメントを確認するために使います。
- Foundry `cast`: Base Sepolia の読み取り調査に使います。`cast call`、`cast code`、`cast logs`、`cast tx`、`cast receipt`、`cast balance` が主用途です。`cast send` など状態変更はユーザーの明示承認なしに実行しないでください。

## Deployed Contracts

- `AgentIdentityRegistry` (ERC-8004): `0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92`
- `USDC` (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Verification

変更の範囲に応じて、最低限 `npm run type-check`、`npm run lint`、該当 workspace の test/build を実行してください。コントラクト変更では `npm run compile --workspace=contracts` と `npm run test --workspace=contracts` を優先します。
