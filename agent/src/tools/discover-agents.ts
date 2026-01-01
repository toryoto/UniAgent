/**
 * Discover Agents Tool
 *
 * 共有サービスを使用してエージェントを検索するLangChainツール
 * MCPサーバー経由ではなく、直接オンチェーンから検索
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { discoverAgents, type A2ASkill } from '@agent-marketplace/shared';
import { logger } from '../utils/logger.js';

/**
 * discover_agents ツール定義
 */
export const discoverAgentsTool = tool(
  async (input) => {
    try {
      logger.logic.info('Searching agents on-chain', {
        category: input.category,
        skillName: input.skillName,
        maxPrice: input.maxPrice,
      });

      // 共有サービスを直接呼び出し
      const result = await discoverAgents({
        category: input.category,
        skillName: input.skillName,
        maxPrice: input.maxPrice,
        minRating: input.minRating,
      });

      // LLMが理解しやすい形式に変換
      const summary = result.agents.map((agent) => ({
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        url: agent.url,
        endpoint: agent.endpoint,
        price: agent.price,
        rating: agent.rating,
        category: agent.category,
        skills: agent.skills.map((s: A2ASkill) => s.name),
      }));

      logger.logic.success(`Found ${result.total} agents`);

      return JSON.stringify({
        success: true,
        total: result.total,
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
    description: `ブロックチェーン上のAgentRegistryからエージェントを検索します。
カテゴリやスキル名で検索可能で、価格・評価でのフィルタリングもサポートしています。
結果にはエージェントのID、名前、説明、URL、価格（USDC）、評価が含まれます。`,
    schema: z.object({
      category: z
        .string()
        .optional()
        .describe('検索するカテゴリ (例: "travel", "finance", "utility")'),
      skillName: z.string().optional().describe('検索するスキル名 (部分一致)'),
      maxPrice: z.number().optional().describe('最大価格 (USDC)'),
      minRating: z.number().min(0).max(5).optional().describe('最小評価 (0-5)'),
    }),
  }
);
