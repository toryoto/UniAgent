/**
 * Agent Discovery Service
 *
 * DB(AgentCache) 経由でエージェントを検索する。
 * packages/database の discoverAgents を使用。
 */

import { discoverAgents as dbDiscoverAgents } from '@agent-marketplace/database';
import type { DiscoverAgentsInput, DiscoverAgentsOutput } from '@agent-marketplace/shared';

export type { DiscoverAgentsInput, DiscoverAgentsOutput };

/**
 * エージェント検索（DB ベース）
 */
export async function discoverAgents(input: DiscoverAgentsInput): Promise<DiscoverAgentsOutput> {
  return dbDiscoverAgents(input);
}
