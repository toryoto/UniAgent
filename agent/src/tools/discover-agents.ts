/**
 * Discover Agents Tool
 *
 * DB(AgentCache)からエージェントを検索し、
 * Bayesian ε-Greedy アルゴリズムでランキング済み Top 3 を返す LangChain ツール
 */

import { tool } from 'langchain';
import { z } from 'zod';
import { discoverAgentsWithStats, type AgentStatsRow } from '@agent-marketplace/database';
import {
  agentCardRowToDiscoveredAgent,
  computeGlobalMeans,
  discoverAgentsFromCache,
  scoreAgents,
  selectAgents,
  type AgentCacheRow,
  type AgentWithStats,
  type DiscoverAgentsInput,
} from '@agent-marketplace/shared';
import { logger } from '../utils/logger.js';

/**
 * AgentStatsRow → AgentCacheRow 変換
 * shared の汎用フィルタロジックを再利用するために使用
 */
function toAgentCacheRow(row: AgentStatsRow): AgentCacheRow {
  return {
    agentId: row.agentId,
    owner: row.owner,
    category: row.category,
    isActive: row.isActive,
    agentCard: row.agentCard,
    rating: 0,
    ratingCount: row.ratingCount,
    stakedAmount: row.stakedAmount,
  };
}

/**
 * AgentStatsRow → AgentWithStats 変換
 * DB 行を DiscoveredAgent に変換し、ランキング用の統計データを付与
 */
function toAgentWithStats(row: AgentStatsRow): AgentWithStats | null {
  const cacheRow = toAgentCacheRow(row);
  const agent = agentCardRowToDiscoveredAgent(cacheRow);
  if (!agent) return null;

  return {
    ...agent,
    avgQuality: row.avgQuality,
    avgReliability: row.avgReliability,
    createdAt: row.createdAt,
  };
}

/**
 * discover_agents ツール定義
 */
const discoverAgentsSchema = z.object({
  agentId: z.string().optional().describe('特定のエージェントID (16進数文字列)'),
  q: z
    .string()
    .optional()
    .describe('自由検索キーワード。名前検索に推奨 (例: "FlightFinderPro")'),
  category: z
    .string()
    .optional()
    .describe('検索するカテゴリ (例: "travel", "finance", "utility")'),
  skillName: z.string().optional().describe('検索するスキル名 (部分一致)'),
  maxPrice: z.number().optional().describe('最大価格 (USDC)'),
});

export const discoverAgentsTool = tool(
  async (input: z.infer<typeof discoverAgentsSchema>) => {
    try {
      logger.logic.info('Searching agents in DB', {
        agentId: input.agentId,
        q: input.q,
        category: input.category,
        skillName: input.skillName,
        maxPrice: input.maxPrice,
      });

      // 1. DB から生データ取得
      const dbInput: DiscoverAgentsInput = {
        agentId: input.agentId,
        q: input.q,
        category: input.category,
        skillName: input.skillName,
        maxPrice: input.maxPrice,
      };
      const rows = await discoverAgentsWithStats(dbInput);

      // 2. shared の discovery フィルタを流用し、検索条件を一元化する
      const cacheRows = rows.map(toAgentCacheRow);
      const filteredAgentIds = new Set(
        discoverAgentsFromCache(cacheRows, dbInput).map((agent) => agent.agentId)
      );
      const agents = rows
        .filter((row) => filteredAgentIds.has(row.agentId))
        .map(toAgentWithStats)
        .filter((a): a is AgentWithStats => a !== null);

      // 3. Bayesian ε-Greedy ランキング
      const means = computeGlobalMeans(agents);
      const scored = scoreAgents(agents, means);
      const selected = selectAgents(scored);

      // 4. LLM が理解しやすい形式に変換
      const summary = selected.map((agent) => ({
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        url: agent.url,
        endpoint: agent.endpoint,
        price: agent.price,
        compositeScore: Math.round(agent.compositeScore * 1000) / 1000,
        selectionReason: agent.selectionReason,
        category: agent.category,
        skills: agent.skills.map((s) => s.name),
      }));

      logger.logic.success(
        `Ranked ${selected.length} agents from ${agents.length} candidates`
      );

      return JSON.stringify({
        success: true,
        total: selected.length,
        agents: summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.logic.error('discover_agents failed', { error: message });
      return JSON.stringify({
        success: false,
        error: message,
        agents: [],
      });
    }
  },
  {
    name: 'discover_agents',
    description: `AgentCache(DB)からエージェントを検索し、Bayesian ε-Greedy ランキングで最適な最大3体を選出します。
カテゴリやスキル名に加え、名前や説明の自由検索にも対応。価格でのフィルタリングもサポート。
結果にはエージェントのID、名前、説明、URL、価格（USDC）、composite score、選出理由が含まれます。
注意: 1回の呼び出しで返るのは最大3体のみ。フライト+ホテルなど複数の異なる能力が必要な場合は、skillNameやqを変えて役割ごとに検索を分けると、各役割で複数候補を得やすい。`,
    schema: discoverAgentsSchema,
  }
);
