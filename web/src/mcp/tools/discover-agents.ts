/**
 * discover_agents ツール実装
 *
 * オンチェーンからAgentCardを取得し、.well-known/agent.jsonの情報を併せて返す
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, RPC_URL, USDC_DECIMALS } from '../../lib/blockchain/config';
import { AGENT_REGISTRY_ABI } from '../../lib/blockchain/contract';

// 入力パラメータ
export interface DiscoverAgentsInput {
  category?: string;
  skillName?: string;
  maxPrice?: number;
  minRating?: number;
}

// スキル情報
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

// agent.jsonから取得するエンドポイント情報
export interface AgentEndpointInfo {
  url: string;
  spec?: string;
}

// 統合されたエージェント情報
export interface DiscoveredAgent {
  agentId: string;
  name: string;
  description: string;
  url: string; // Base URL (オンチェーン)
  endpoint?: string; // A2Aエンドポイント (agent.jsonから)
  version: string;
  skills: SkillInfo[];
  price: number; // USDC
  rating: number;
  ratingCount: number;
  category: string;
  owner: string;
  isActive: boolean;
  openapi?: string; // OpenAPI仕様URL (agent.jsonから)
  imageUrl?: string;
}

// 出力形式
export interface DiscoverAgentsOutput {
  agents: DiscoveredAgent[];
  total: number;
  source: 'on-chain';
}

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
      // タイムアウト設定
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`Failed to fetch agent.json from ${agentJsonUrl}: ${response.status}`);
      return null;
    }

    const agentJson = await response.json();

    // agent.json構造に応じてエンドポイント情報を抽出
    // 仕様書に基づく形式: { agent_id, endpoints: [{ url, spec }] }
    if (agentJson.endpoints && Array.isArray(agentJson.endpoints) && agentJson.endpoints.length > 0) {
      return {
        endpoint: agentJson.endpoints[0].url,
        openapi: agentJson.endpoints[0].spec,
      };
    }

    // 旧形式のフォールバック: { endpoint, openapi }
    return {
      endpoint: agentJson.endpoint,
      openapi: agentJson.openapi,
    };
  } catch (error) {
    console.warn(`Error fetching agent.json from ${baseUrl}:`, error);
    return null;
  }
}

/**
 * オンチェーンAgentCardをパースしてDiscoveredAgentに変換
 */
function parseOnChainAgent(onChainData: any): Omit<DiscoveredAgent, 'endpoint' | 'openapi'> {
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
    skills: (onChainData.skills || []).map((skill: any) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
    })),
    price: priceUsdc,
    rating: Math.round(averageRating * 100) / 100, // 小数点2桁
    ratingCount,
    category: onChainData.category,
    owner: onChainData.owner,
    isActive: onChainData.isActive,
    imageUrl: onChainData.imageUrl,
  };
}

/**
 * メイン: エージェント検索
 */
export async function discoverAgents(input: DiscoverAgentsInput): Promise<DiscoverAgentsOutput> {
  const { category, skillName, maxPrice, minRating } = input;

  // Providerとコントラクト初期化
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESSES.AGENT_REGISTRY, AGENT_REGISTRY_ABI, provider);

  // オンチェーンからAgentCard取得
  let agentIds: string[];

  if (category) {
    // カテゴリ指定時はアクティブなエージェントのみ取得
    agentIds = await contract.getActiveAgentsByCategory(category);
  } else {
    // カテゴリ指定なしは全エージェントを取得
    agentIds = await contract.getAllAgentIds();
  }

  if (agentIds.length === 0) {
    return { agents: [], total: 0, source: 'on-chain' };
  }

  // 各AgentCardを取得
  const agentCardsPromises = agentIds.map((id) => contract.getAgentCard(id));
  const onChainAgents = await Promise.all(agentCardsPromises);

  // パースとフィルタリング
  let parsedAgents = onChainAgents
    .map(parseOnChainAgent)
    .filter((agent) => agent.isActive);

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
      endpoint: agentJsonInfo?.endpoint || `${agent.url}/api/v1/agent`, // フォールバック
      openapi: agentJsonInfo?.openapi,
    };
  });

  const enrichedAgents = await Promise.all(enrichedAgentsPromises);

  // 評価順でソート
  enrichedAgents.sort((a, b) => b.rating - a.rating);

  return {
    agents: enrichedAgents,
    total: enrichedAgents.length,
    source: 'on-chain',
  };
}
