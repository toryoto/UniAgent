/**
 * discover_agents ツール実装
 *
 * 共有サービスを使用してエージェントを検索
 */

import {
  discoverAgents,
  type DiscoverAgentsInput,
  type DiscoverAgentsOutput,
} from '@agent-marketplace/shared';

// 型を再エクスポート（互換性のため）
export type { DiscoverAgentsInput, DiscoverAgentsOutput };

// 共有サービスを再エクスポート
export { discoverAgents };
