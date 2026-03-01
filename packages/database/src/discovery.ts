/**
 * Agent Discovery (DB)
 *
 * AgentCache テーブルからエージェントを検索する。
 * EasAttestation を LEFT JOIN して集計スコアを付与。
 * 行データの変換・フィルタリングは shared パッケージに委譲。
 */

import { Prisma } from '@prisma/client';
import { prisma } from './client.js';
import {
  discoverAgentsFromCache,
  type DiscoverAgentsInput,
  type DiscoverAgentsOutput,
  type AgentCacheRow,
} from '@agent-marketplace/shared';

interface AgentCacheWithRatingRow {
  agentId: string;
  owner: string | null;
  category: string | null;
  isActive: boolean | null;
  agentCard: unknown;
  rating: number;
  ratingCount: number;
}

/**
 * DB(AgentCache) からエージェントを検索（EAS 評価スコア付き）
 */
export async function discoverAgents(
  input: DiscoverAgentsInput
): Promise<DiscoverAgentsOutput> {
  const conditions: Prisma.Sql[] = [Prisma.sql`ac.is_active = true`];
  if (input.agentId) {
    conditions.push(Prisma.sql`ac.agent_id = ${input.agentId}`);
  }
  if (input.category) {
    conditions.push(Prisma.sql`ac.category = ${input.category}`);
  }
  const whereClause = Prisma.join(conditions, ' AND ');

  const rows = await prisma.$queryRaw<AgentCacheWithRatingRow[]>`
    SELECT
      ac.agent_id   AS "agentId",
      ac.owner       AS "owner",
      ac.category    AS "category",
      ac.is_active   AS "isActive",
      ac.agent_card  AS "agentCard",
      COALESCE(AVG((ea.quality + ea.reliability) / 2.0) / 51.0, 0)::float8 AS "rating",
      COUNT(ea.id)::int AS "ratingCount"
    FROM agent_cache ac
    LEFT JOIN eas_attestations ea ON ea.agent_id = ac.agent_id
    WHERE ${whereClause}
    GROUP BY ac.agent_id, ac.owner, ac.category, ac.is_active, ac.agent_card, ac.updated_at
    ORDER BY ac.updated_at DESC
    LIMIT 500
  `;

  const cacheRows: AgentCacheRow[] = rows.map((r) => ({
    agentId: r.agentId,
    owner: r.owner,
    category: r.category,
    isActive: r.isActive,
    agentCard: r.agentCard,
    rating: Number(r.rating),
    ratingCount: r.ratingCount,
  }));

  const agents = discoverAgentsFromCache(cacheRows, input);

  return { agents, total: agents.length, source: 'db' };
}
