/**
 * Agent Discovery Service
 *
 * オンチェーンからAgentCardを取得し、.well-known/agent.jsonの情報を併せて返す
 * MCP、Agentパッケージから共通で使用される
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, RPC_URL, USDC_DECIMALS } from '../config.js';
import { AGENT_REGISTRY_ABI } from '../contract.js';
import type { AgentCard, AgentJson, A2ASkill, DiscoveredAgent } from '../types.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface DiscoverAgentsInput {
  category?: string;
  skillName?: string;
  maxPrice?: number;
  minRating?: number;
}

export interface DiscoverAgentsOutput {
  agents: DiscoveredAgent[];
  total: number;
  source: 'on-chain';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * .well-known/agent.jsonを取得
 */
async function fetchAgentJson(baseUrl: string): Promise<{
  endpoint?: string;
  openapi?: string;
} | null> {
  try {
    // URLの正規化
    const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const agentJsonUrl = `${normalizedUrl}/.well-known/agent.json`;

    const response = await fetch(agentJsonUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[agent-discovery] Failed to fetch agent.json from ${agentJsonUrl}: ${response.status}`);
      return null;
    }

    const agentJson = (await response.json()) as
      | AgentJson
      | { endpoint?: string; openapi?: string };

    // agent.json構造に応じてエンドポイント情報を抽出
    if (
      'endpoints' in agentJson &&
      Array.isArray(agentJson.endpoints) &&
      agentJson.endpoints.length > 0
    ) {
      return {
        endpoint: agentJson.endpoints[0].url,
        openapi: agentJson.endpoints[0].spec,
      };
    }

    // 旧形式のフォールバック
    return {
      endpoint: 'endpoint' in agentJson ? agentJson.endpoint : undefined,
      openapi: 'openapi' in agentJson ? agentJson.openapi : undefined,
    };
  } catch (error) {
    console.warn(`[agent-discovery] Error fetching agent.json from ${baseUrl}:`, error);
    return null;
  }
}

/**
 * オンチェーンAgentCardをパースしてDiscoveredAgentに変換
 */
function parseOnChainAgent(onChainData: AgentCard): Omit<DiscoveredAgent, 'endpoint' | 'openapi'> {
  const totalRatings = Number(onChainData.totalRatings || 0);
  const ratingCount = Number(onChainData.ratingCount || 0);
  const averageRating = ratingCount > 0 ? totalRatings / ratingCount : 0;

  // 価格をUSDC単位に変換 (6 decimals)
  const pricePerCall = Number(onChainData.payment?.pricePerCall || 0);
  const priceUsdc = pricePerCall / Math.pow(10, USDC_DECIMALS);

  return {
    agentId: onChainData.agentId,
    name: onChainData.name,
    description: onChainData.description,
    url: onChainData.url,
    version: onChainData.version,
    skills: (onChainData.skills || []).map((skill: A2ASkill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
    })),
    price: priceUsdc,
    rating: Math.round(averageRating * 100) / 100,
    ratingCount,
    category: onChainData.category,
    owner: onChainData.owner,
    isActive: onChainData.isActive,
    imageUrl: onChainData.imageUrl,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * エージェント検索
 *
 * オンチェーンのAgentRegistryからエージェントを検索し、
 * .well-known/agent.jsonからエンドポイント情報を取得して返す
 */
export async function discoverAgents(input: DiscoverAgentsInput): Promise<DiscoverAgentsOutput> {
  try {
    const { category, skillName, maxPrice, minRating } = input;

    console.log('[agent-discovery] Input:', JSON.stringify(input));

    // Providerとコントラクト初期化
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES.AGENT_REGISTRY,
      AGENT_REGISTRY_ABI,
      provider
    );

    // オンチェーンからAgentCard取得
    let agentIds: string[];

    if (category) {
      agentIds = await contract.getActiveAgentsByCategory(category);
    } else {
      agentIds = await contract.getAllAgentIds();
    }

    if (agentIds.length === 0) {
      return { agents: [], total: 0, source: 'on-chain' };
    }

    // 各AgentCardを取得
    const agentCardsPromises = agentIds.map((id) => contract.getAgentCard(id));
    const onChainAgents = await Promise.all(agentCardsPromises);

    // パースとフィルタリング
    let parsedAgents = onChainAgents.map(parseOnChainAgent).filter((agent) => agent.isActive);

    // スキル名フィルタ
    if (skillName) {
      const lowerSkillName = skillName.toLowerCase();
      parsedAgents = parsedAgents.filter((agent) =>
        agent.skills.some(
          (skill) =>
            skill.name.toLowerCase().includes(lowerSkillName) ||
            skill.description.toLowerCase().includes(lowerSkillName)
        )
      );
    }

    // 価格フィルタ
    if (typeof maxPrice === 'number') {
      parsedAgents = parsedAgents.filter((agent) => agent.price <= maxPrice);
    }

    // 評価フィルタ
    if (typeof minRating === 'number') {
      parsedAgents = parsedAgents.filter((agent) => agent.rating >= minRating);
    }

    // .well-known/agent.jsonから追加情報を取得（並列処理）
    const enrichedAgentsPromises = parsedAgents.map(async (agent): Promise<DiscoveredAgent> => {
      const agentJsonInfo = await fetchAgentJson(agent.url);

      return {
        ...agent,
        endpoint: agentJsonInfo?.endpoint || `${agent.url}/api/v1/agent`,
        openapi: agentJsonInfo?.openapi,
      };
    });

    const enrichedAgents = await Promise.all(enrichedAgentsPromises);

    // 評価順でソート
    enrichedAgents.sort((a, b) => b.rating - a.rating);

    console.log(`[agent-discovery] Found ${enrichedAgents.length} agents`);

    return {
      agents: enrichedAgents,
      total: enrichedAgents.length,
      source: 'on-chain',
    };
  } catch (error) {
    console.error('[agent-discovery] Error:', error);
    throw new Error(
      `エージェント検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
