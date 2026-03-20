/**
 * Contract Utilities (Web)
 *
 * ERC-8004 / AgentStaking コントラクトとのやり取り
 * 共通機能は @agent-marketplace/shared から取得
 */

export {
  AGENT_IDENTITY_REGISTRY_ABI,
  AGENT_STAKING_ABI,
  getProvider,
  getAgentIdentityRegistryContract,
  getAgentStakingContract,
} from '@agent-marketplace/shared/contract';
