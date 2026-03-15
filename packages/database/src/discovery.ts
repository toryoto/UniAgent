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
  stakedAmount: number;
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
      COUNT(ea.id)::int AS "ratingCount",
      COALESCE(ast.staked_amount, 0)::float8 AS "stakedAmount"
    FROM agent_cache ac
    LEFT JOIN eas_attestations ea ON ea.agent_id = ac.agent_id
    LEFT JOIN agent_stakes ast ON ast.agent_id = ac.agent_id
    WHERE ${whereClause}
    GROUP BY ac.agent_id, ac.owner, ac.category, ac.is_active, ac.agent_card, ac.updated_at, ast.staked_amount
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
    stakedAmount: Number(r.stakedAmount),
  }));

  const agents = discoverAgentsFromCache(cacheRows, input);

  return { agents, total: agents.length, source: 'db' };
}

// ============================================================================
// Ranked Discovery (Bayesian ε-Greedy 用の生データ取得)
// ============================================================================

/** ランキング計算に必要な生データ行 */
export interface AgentStatsRow {
  agentId: string;
  owner: string | null;
  category: string | null;
  isActive: boolean | null;
  agentCard: unknown;
  avgQuality: number;
  avgReliability: number;
  ratingCount: number;
  stakedAmount: number;
  createdAt: Date;
}

/**
 * ランキング用の生データを DB から取得。
 * Bayesian スコア・Composite Score の計算はアプリ層 (agent-ranking.ts) で行う。
 */
export async function discoverAgentsWithStats(
  input: DiscoverAgentsInput
): Promise<AgentStatsRow[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`ac.is_active = true`];
  if (input.agentId) {
    conditions.push(Prisma.sql`ac.agent_id = ${input.agentId}`);
  }
  if (input.category) {
    conditions.push(Prisma.sql`ac.category = ${input.category}`);
  }
  const whereClause = Prisma.join(conditions, ' AND ');

  const rows = await prisma.$queryRaw<AgentStatsRow[]>`
    SELECT
      ac.agent_id    AS "agentId",
      ac.owner       AS "owner",
      ac.category    AS "category",
      ac.is_active   AS "isActive",
      ac.agent_card  AS "agentCard",
      COALESCE(AVG(ea.quality), 0)::float8     AS "avgQuality",
      COALESCE(AVG(ea.reliability), 0)::float8 AS "avgReliability",
      COUNT(ea.id)::int                        AS "ratingCount",
      COALESCE(ast.staked_amount, 0)::float8   AS "stakedAmount",
      ac.created_at                            AS "createdAt"
    FROM agent_cache ac
    LEFT JOIN eas_attestations ea ON ea.agent_id = ac.agent_id
    LEFT JOIN agent_stakes ast ON ast.agent_id = ac.agent_id
    WHERE ${whereClause}
    GROUP BY ac.agent_id, ac.owner, ac.category, ac.is_active,
             ac.agent_card, ac.created_at, ast.staked_amount
    ORDER BY ac.created_at DESC
    LIMIT 500
  `;

  return rows.map((r) => ({
    agentId: r.agentId,
    owner: r.owner,
    category: r.category,
    isActive: r.isActive,
    agentCard: r.agentCard,
    avgQuality: Number(r.avgQuality),
    avgReliability: Number(r.avgReliability),
    ratingCount: r.ratingCount,
    stakedAmount: Number(r.stakedAmount),
    createdAt: new Date(r.createdAt),
  }));
}
