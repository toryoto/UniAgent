/**
 * Agent Discovery Service
 *
 * DB(AgentCache)からエージェントを検索するための共通ロジック。
 * Prisma には依存せず、行データの変換とフィルタリングのみを提供する。
 */

import { USDC_DECIMALS } from '../config.js';
import type { A2ASkill, DiscoveredAgent, ERC8004Service } from '../types.js';

// ============================================================================
// Input / Output Types
// ============================================================================

export interface DiscoverAgentsInput {
  agentId?: string;
  q?: string;
  category?: string;
  skillName?: string;
  maxPrice?: number;
  minRating?: number;
}

export interface DiscoverAgentsOutput {
  agents: DiscoveredAgent[];
  total: number;
  source: 'db' | 'on-chain';
}

// ============================================================================
// AgentCache Row Type (DB 非依存)
// ============================================================================

/** DB の AgentCache テーブルの行を表す型 */
export interface AgentCacheRow {
  agentId: string;
  owner: string | null;
  category: string | null;
  isActive: boolean | null;
  agentCard: unknown; // Prisma Json type
  rating: number; // EAS 集計スコア (0.0-5.0)
  ratingCount: number; // attestation 件数
}

// ============================================================================
// Payment Type
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

// ============================================================================
// Webhook Utilities
// ============================================================================

/**
 * A2A エンドポイント (.well-known/agent.json) から payment を取得
 * Alchemy Webhook でのキャッシュ同期時に使用
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

// ============================================================================
// AgentCard → DiscoveredAgent Mapping
// ============================================================================

/**
 * AgentCache 行を DiscoveredAgent に変換する純粋関数
 */
export function agentCardRowToDiscoveredAgent(row: AgentCacheRow): DiscoveredAgent | null {
  const card = row.agentCard;
  if (!card || typeof card !== 'object') return null;

  const c = card as Record<string, unknown>;
  if (!c.name) return null;

  const services = c.services as ERC8004Service[] | undefined;
  const a2aService = services?.find((s) => s.name === 'A2A');
  const payment = c.payment as AgentJsonPayment | undefined;

  let price = 0;
  if (payment?.pricePerCall) {
    price = Number(payment.pricePerCall) / Math.pow(10, USDC_DECIMALS);
  }

  const skills: A2ASkill[] =
    a2aService?.skills?.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })) || [];

  return {
    agentId: row.agentId,
    name: c.name as string,
    description: (c.description as string) || '',
    url: a2aService?.endpoint || '',
    endpoint: a2aService?.endpoint,
    version: a2aService?.version || '1.0.0',
    skills,
    price,
    rating: row.rating ?? 0,
    ratingCount: row.ratingCount ?? 0,
    category: (c.category as string) || a2aService?.domains?.[0] || row.category || '',
    owner: row.owner || '',
    isActive: (c.active as boolean) !== false,
    imageUrl: c.image as string | undefined,
    x402Support: (c.x402Support as boolean) || false,
  };
}

// ============================================================================
// Cache-based Discovery (Pure Function)
// ============================================================================

/**
 * AgentCache の行データからエージェントを検索する純粋関数。
 * DB/Prisma には一切依存しない。
 */
export function discoverAgentsFromCache(
  rows: AgentCacheRow[],
  input: DiscoverAgentsInput
): DiscoveredAgent[] {
  const { q, category, skillName, maxPrice, minRating, agentId } = input;

  let agents = rows
    .map(agentCardRowToDiscoveredAgent)
    .filter((a): a is DiscoveredAgent => a !== null);

  if (agentId) {
    agents = agents.filter((a) => a.agentId === agentId);
  }

  // General text search (name, description, category, skill names/descriptions)
  if (q) {
    const lower = q.toLowerCase();
    agents = agents.filter((a) => {
      const hay = [
        a.name,
        a.description,
        a.category,
        ...a.skills.map((s) => s.name),
        ...a.skills.map((s) => s.description),
      ]
        .map((s) => s.toLowerCase())
        .join(' ');
      return hay.includes(lower);
    });
  }

  if (category) {
    const lower = category.toLowerCase();
    agents = agents.filter((a) => a.category.toLowerCase().includes(lower));
  }

  if (skillName) {
    const lower = skillName.toLowerCase();
    agents = agents.filter((a) =>
      a.skills.some(
        (s) =>
          s.name.toLowerCase().includes(lower) || s.description.toLowerCase().includes(lower)
      )
    );
  }

  if (typeof maxPrice === 'number') {
    agents = agents.filter((a) => a.price <= maxPrice);
  }

  if (typeof minRating === 'number') {
    agents = agents.filter((a) => a.rating >= minRating);
  }

  return agents;
}
