/**
 * Agent Identity Registry Contract Utilities (Shared)
 *
 * ethers.jsを使用したERC-8004スマートコントラクトとのやり取り
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, RPC_URL } from './config.js';
import AgentIdentityRegistryArtifact from './AgentIdentityRegistry.json' with { type: 'json' };

export const AGENT_IDENTITY_REGISTRY_ABI = AgentIdentityRegistryArtifact.abi;

/**
 * Providerを取得（読み取り専用）
 */
export function getProvider(rpcUrl?: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl || RPC_URL);
}

/**
 * AgentIdentityRegistryコントラクトインスタンスを取得（ERC-8004）
 */
export function getAgentIdentityRegistryContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const providerOrSigner = signerOrProvider || getProvider();
  return new ethers.Contract(
    CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY,
    AGENT_IDENTITY_REGISTRY_ABI,
    providerOrSigner
  );
}
