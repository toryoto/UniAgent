# @agent-marketplace/database

Prisma Client および DB アクセス層を提供。  
ビジネスロジックは `@agent-marketplace/shared` に委譲。

## 提供する機能

- **Prisma Client のシングルトン**: `prisma` インスタンス
- **DB 特化の検索関数**: `discoverAgents`（AgentCache テーブルから検索）

## 依存関係

- **`@agent-marketplace/shared`**: ビジネスロジック（`discoverAgentsFromCache` 等）を使用

## 環境変数（Prisma CLI 用）

`db:push` / `db:generate` / `db:studio` 実行時に、`packages/database/.env` が必要です。

```bash
cp .env.example .env
# .env に DATABASE_URL と DIRECT_URL を設定（web/.env と同値でよい）
```
