/**
 * Agent Registry Contract Utilities (Shared)
 *
 * ethers.jsを使用したスマートコントラクトとのやり取り
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, RPC_URL } from './config.js';
import AgentRegistryArtifact from './AgentRegistry.json' with { type: 'json' };

// ABIの取得
export const AGENT_REGISTRY_ABI = AgentRegistryArtifact.abi;

/**
 * Providerを取得（読み取り専用）
 */
export function getProvider(rpcUrl?: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl || RPC_URL);
}

/**
 * AgentRegistryコントラクトインスタンスを取得
 */
export function getAgentRegistryContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const providerOrSigner = signerOrProvider || getProvider();
  return new ethers.Contract(
    CONTRACT_ADDRESSES.AGENT_REGISTRY,
    AGENT_REGISTRY_ABI,
    providerOrSigner
  );
}
