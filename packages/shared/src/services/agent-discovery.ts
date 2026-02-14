/**
 * Agent Discovery Service (ERC-8004)
 *
 * オンチェーンのAgentIdentityRegistryからエージェントを検索し、
 * IPFSメタデータと.well-known/agent.jsonの情報を併せて返す
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, RPC_URL, USDC_DECIMALS } from '../config.js';
import { AGENT_IDENTITY_REGISTRY_ABI } from '../contract.js';
import type { A2ASkill, AgentJson, DiscoveredAgent, ERC8004RegistrationFile } from '../types.js';
import { fetchAgentMetadata } from './pinata.js';

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
// Utilities
// ============================================================================

/** agent.json の payment オブジェクトの型 */
export interface AgentJsonPayment {
  tokenAddress?: string;
  receiverAddress?: string;
  pricePerCall?: string;
  price?: string;
  network?: string;
  chain?: string;
}

/**
 * A2A エンドポイント (.well-known/agent.json) から payment を取得
 * x402 対応エージェントの価格を取得するために使用
 */
export async function fetchPaymentFromAgentEndpoint(
  endpointUrl: string
): Promise<AgentJsonPayment | null> {
  try {
    const normalizedUrl = endpointUrl.endsWith('/') ? endpointUrl.slice(0, -1) : endpointUrl;
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as Record<string, unknown>;
    const payment = json?.payment;
    if (!payment || typeof payment !== 'object') return null;
    const p = payment as Record<string, unknown>;
    return {
      tokenAddress: typeof p.tokenAddress === 'string' ? p.tokenAddress : undefined,
      receiverAddress: typeof p.receiverAddress === 'string' ? p.receiverAddress : undefined,
      pricePerCall: typeof p.pricePerCall === 'string' ? p.pricePerCall : undefined,
      price: typeof p.price === 'string' ? p.price : undefined,
      network: typeof p.network === 'string' ? p.network : undefined,
      chain: typeof p.chain === 'string' ? p.chain : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * .well-known/agent.jsonを取得
 */
async function fetchAgentJson(baseUrl: string): Promise<{
  endpoint?: string;
  openapi?: string;
  price?: number;
} | null> {
  try {
    const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(
        `[agent-discovery] Failed to fetch agent.json from ${normalizedUrl}: ${response.status}`
      );
      return null;
    }

    const agentJson = (await response.json()) as
      | AgentJson
      | (Record<string, unknown> & { payment?: { pricePerCall?: string } });

    let endpoint: string | undefined;
    let openapi: string | undefined;
    let price: number | undefined;

    if (
      'endpoints' in agentJson &&
      Array.isArray(agentJson.endpoints) &&
      agentJson.endpoints.length > 0
    ) {
      endpoint = agentJson.endpoints[0].url;
      openapi = agentJson.endpoints[0].spec;
    } else if ('endpoint' in agentJson) {
      endpoint = agentJson.endpoint as string;
      openapi = 'openapi' in agentJson ? (agentJson.openapi as string) : undefined;
    }

    if ('payment' in agentJson && agentJson.payment) {
      const payment = agentJson.payment as { pricePerCall?: string };
      if (payment.pricePerCall) {
        price = Number(payment.pricePerCall) / Math.pow(10, USDC_DECIMALS);
      }
    }

    return { endpoint, openapi, price };
  } catch (error) {
    console.warn(`[agent-discovery] Error fetching agent.json from ${baseUrl}:`, error);
    return null;
  }
}

// ============================================================================
// IPFS Metadata Cache
// ============================================================================

const ipfsCache = new Map<string, { data: ERC8004RegistrationFile; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchCachedMetadata(ipfsUri: string): Promise<ERC8004RegistrationFile> {
  const cached = ipfsCache.get(ipfsUri);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await fetchAgentMetadata(ipfsUri);
  ipfsCache.set(ipfsUri, { data, timestamp: Date.now() });
  return data;
}

// ============================================================================
// Discovery
// ============================================================================

async function resolveAgent(
  contract: ethers.Contract,
  agentId: bigint
): Promise<DiscoveredAgent | null> {
  try {
    const [tokenURI, agentOwner] = await Promise.all([
      contract.tokenURI(agentId) as Promise<string>,
      contract.ownerOf(agentId) as Promise<string>,
    ]);

    const metadata = await fetchCachedMetadata(tokenURI);

    if (metadata.active === false) return null;

    const a2aService = metadata.services?.find((s) => s.name === 'A2A');
    const a2aEndpoint = a2aService?.endpoint;

    let endpoint: string | undefined;
    let openapi: string | undefined;
    let price = 0;

    if (a2aEndpoint) {
      const agentJsonInfo = await fetchAgentJson(a2aEndpoint);
      endpoint = agentJsonInfo?.endpoint || a2aEndpoint;
      openapi = agentJsonInfo?.openapi;
      price = agentJsonInfo?.price || 0;
    }

    const skills: A2ASkill[] =
      a2aService?.skills?.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })) || [];

    return {
      agentId: agentId.toString(),
      name: metadata.name,
      description: metadata.description,
      url: a2aEndpoint || '',
      endpoint,
      version: a2aService?.version || '1.0.0',
      skills,
      price,
      rating: 0,
      ratingCount: 0,
      category: metadata.category || a2aService?.domains?.[0] || '',
      owner: agentOwner,
      isActive: true,
      openapi,
      imageUrl: metadata.image,
    };
  } catch (error) {
    console.warn(`[agent-discovery] Error fetching agent ${agentId}:`, error);
    return null;
  }
}

/**
 * エージェント検索（ERC-8004 Identity Registry）
 */
export async function discoverAgents(input: DiscoverAgentsInput): Promise<DiscoverAgentsOutput> {
  const { category, skillName, maxPrice, minRating } = input;

  console.log('[agent-discovery] Input:', JSON.stringify(input));

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY,
      AGENT_IDENTITY_REGISTRY_ABI,
      provider
    );

    const allAgentIds: bigint[] = await contract.getAllAgentIds();

    if (allAgentIds.length === 0) {
      return { agents: [], total: 0, source: 'on-chain' };
    }

    const agentPromises = allAgentIds.map((id) => resolveAgent(contract, id));
    let agents = (await Promise.all(agentPromises)).filter(
      (a): a is DiscoveredAgent => a !== null
    );

    // Apply filters
    if (category) {
      const lower = category.toLowerCase();
      agents = agents.filter((a) => a.category.toLowerCase().includes(lower));
    }

    if (skillName) {
      const lower = skillName.toLowerCase();
      agents = agents.filter((a) =>
        a.skills.some(
          (s) => s.name.toLowerCase().includes(lower) || s.description.toLowerCase().includes(lower)
        )
      );
    }

    if (typeof maxPrice === 'number') {
      agents = agents.filter((a) => a.price <= maxPrice);
    }

    if (typeof minRating === 'number') {
      agents = agents.filter((a) => a.rating >= minRating);
    }

    agents.sort((a, b) => b.rating - a.rating);

    console.log(`[agent-discovery] Found ${agents.length} agents`);

    return { agents, total: agents.length, source: 'on-chain' };
  } catch (error) {
    console.error('[agent-discovery] Error:', error);
    throw new Error(
      `エージェント検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
