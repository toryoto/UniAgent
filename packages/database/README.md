# @agent-marketplace/database

Prisma Client および DB アクセス層を提供。  
ビジネスロジックは `@agent-marketplace/shared` に委譲。

## 提供する機能

- **Prisma Client のシングルトン**: `prisma` インスタンス
- **DB 特化の検索関数**: `discoverAgents`（AgentCache テーブルから検索）

## 依存関係

- **`@agent-marketplace/shared`**: ビジネスロジック（`discoverAgentsFromCache` 等）を使用
