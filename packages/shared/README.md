# @agent-marketplace/shared

Pure Functions、型定義、ビジネスロジックを提供。  
DB やフレームワークに依存しない。

## 提供する機能

- **`discoverAgentsFromCache`**: エージェント検索ロジック（Pure Function）
- **`agentCardRowToDiscoveredAgent`**: データ変換ロジック（Pure Function）
- **型定義**: `DiscoverAgentsInput`, `DiscoverAgentsOutput`, `AgentCacheRow`, etc.
- **設定・契約**: `CONTRACT_ADDRESSES`, `RPC_URL`, `AGENT_IDENTITY_REGISTRY_ABI`, etc.

## 依存関係

- なし（最下層パッケージ）
