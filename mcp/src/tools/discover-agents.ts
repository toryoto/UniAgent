/**
 * discover_agents ツール実装
 *
 * DB(AgentCache) 経由でエージェントを検索
 */

import { discoverAgents } from '@agent-marketplace/database';
import type { DiscoverAgentsInput, DiscoverAgentsOutput } from '@agent-marketplace/shared';

// 型を再エクスポート（互換性のため）
export type { DiscoverAgentsInput, DiscoverAgentsOutput };

// DB ベースの検索を再エクスポート
export { discoverAgents };
