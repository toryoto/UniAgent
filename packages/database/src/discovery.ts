/**
 * Agent Discovery (DB)
 *
 * AgentCache テーブルからエージェントを検索する。
 * 行データの変換・フィルタリングは shared パッケージに委譲。
 */

import { prisma } from './client.js';
import {
  discoverAgentsFromCache,
  type DiscoverAgentsInput,
  type DiscoverAgentsOutput,
  type AgentCacheRow,
} from '@agent-marketplace/shared';

/**
 * DB(AgentCache) からエージェントを検索
 */
export async function discoverAgents(
  input: DiscoverAgentsInput
): Promise<DiscoverAgentsOutput> {
  const rows = await prisma.agentCache.findMany({
    where: {
      isActive: true,
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.category ? { category: input.category } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  const cacheRows: AgentCacheRow[] = rows.map((r) => ({
    agentId: r.agentId,
    owner: r.owner,
    category: r.category,
    isActive: r.isActive,
    agentCard: r.agentCard,
  }));

  const agents = discoverAgentsFromCache(cacheRows, input);

  return { agents, total: agents.length, source: 'db' };
}
