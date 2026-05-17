# CLAUDE.md

AI coding agent 向けのリポジトリガイドです。`AGENTS.md` はこのファイルへの symlink として管理します。詳細な運用メモが必要な場合は `docs/ai-agent-operational-notes.md` を参照してください。

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
- `web/` は Next.js 16 + React 19、`agent/` は LangChain ReAct Agent、`contracts/` は Hardhat、`a2a-agents/` は外部 A2A HTTP Agent 群です。`mcp/` は legacy workspace で、現在の実行経路では使用しません。
- LangChain は `@langchain/core` 1.1.19 系です。v0 系から破壊的変更があるため、Agent 実装や LangChain API 変更時は必ず Context7 MCP などで LangChain v1.1 系の最新ドキュメントを確認してください。
- 共通型・純粋ロジックは `packages/shared/`、Prisma Client と共有 DB アクセスは `packages/database/` に置きます。
- Web 固有の DB アクセスは `web/src/lib/db/` に閉じ込め、API Route や Server Component から Prisma を直接 import しないでください。
- Web の `/api/agents/*` ダミールートは削除済みです。Agent endpoint は `a2a-agents` または外部ホストの `.well-known/agent.json` を AgentRegistry に登録します。
- `autoApproveThreshold` はサーバーサイドで DB から取得し、クライアントから送られた値は信用しないでください。

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

ここでいう MCP は Cursor/Supabase/Context7 などの外部 MCP ツールです。リポジトリ内の legacy workspace `mcp/` とは別物です。

- Supabase MCP: DB 構造確認、ログ、Advisor、SQL 検証に使います。スキーマ変更前は既存テーブルと RLS/権限を確認してください。
- Vercel MCP/CLI: `web` のデプロイ状況、Preview/Production URL、ログ、環境変数確認に使います。明示依頼なしに本番 deploy や env 変更をしないでください。
- Context7 MCP: Next.js、React、Prisma、Supabase、Vercel、x402 などの API や設定を書く前に最新ドキュメントを確認するために使います。
- Foundry `cast`: Base Sepolia の読み取り調査に使います。`cast call`、`cast code`、`cast logs`、`cast tx`、`cast receipt`、`cast balance` が主用途です。`cast send` など状態変更はユーザーの明示承認なしに実行しないでください。

## Deployed Contracts

- `AgentIdentityRegistry` (ERC-8004): `0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92`
- `USDC` (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Verification

変更の範囲に応じて、最低限 `npm run type-check`、`npm run lint`、該当 workspace の test/build を実行してください。コントラクト変更では `npm run compile --workspace=contracts` と `npm run test --workspace=contracts` を優先します。
