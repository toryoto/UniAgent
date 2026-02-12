/**
 * Agent Discovery Service
 *
 * 共有パッケージのdiscoverAgentsをラップし、agentId指定検索を追加
 */

import { ethers } from 'ethers';
import {
  CONTRACT_ADDRESSES,
  RPC_URL,
  AGENT_IDENTITY_REGISTRY_ABI,
  type A2ASkill,
  type DiscoveredAgent,
  discoverAgents as sharedDiscoverAgents,
  type DiscoverAgentsInput as SharedDiscoverAgentsInput,
  type DiscoverAgentsOutput,
  fetchAgentMetadata,
} from '@agent-marketplace/shared';

export type { DiscoverAgentsOutput };

export interface DiscoverAgentsInput extends SharedDiscoverAgentsInput {
  agentId?: string;
}

/**
 * エージェント検索
 *
 * agentIdが指定されている場合は直接取得、
 * それ以外は共有サービスのdiscoverAgentsに委譲
 */
export async function discoverAgents(input: DiscoverAgentsInput): Promise<DiscoverAgentsOutput> {
  if (!input.agentId) {
    return sharedDiscoverAgents(input);
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY,
      AGENT_IDENTITY_REGISTRY_ABI,
      provider
    );

    const [tokenURI, agentOwner] = await Promise.all([
      contract.tokenURI(input.agentId) as Promise<string>,
      contract.ownerOf(input.agentId) as Promise<string>,
    ]);

    const metadata = await fetchAgentMetadata(tokenURI);
    const a2aService = metadata.services?.find((s) => s.name === 'A2A');

    const agent: DiscoveredAgent = {
      agentId: input.agentId,
      name: metadata.name,
      description: metadata.description,
      url: a2aService?.endpoint || '',
      endpoint: a2aService?.endpoint,
      version: a2aService?.version || '1.0.0',
      skills:
        a2aService?.skills?.map((s: A2ASkill) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })) || [],
      price: 0,
      rating: 0,
      ratingCount: 0,
      category: metadata.category || a2aService?.domains?.[0] || '',
      owner: agentOwner,
      isActive: metadata.active !== false,
      imageUrl: metadata.image,
    };

    return { agents: [agent], total: 1, source: 'on-chain' };
  } catch (error) {
    console.error('[agent-discovery] Error:', error);
    throw new Error(
      `エージェント検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
