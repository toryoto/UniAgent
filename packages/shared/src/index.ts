/**
 * @agent-marketplace/shared
 *
 * web、mcp、agentパッケージで使用する共通コード
 */

export {
  CONTRACT_ADDRESSES,
  RPC_URL,
  USDC_DECIMALS,
  USDC_UNIT,
  parseUSDC,
  formatUSDCAmount,
} from './config.js';

export { AGENT_REGISTRY_ABI, getProvider, getAgentRegistryContract } from './contract.js';

export type {
  A2ASkill,
  A2APaymentInfo,
  AgentCard,
  AgentJson,
  AgentJsonEndpoint,
  DiscoveredAgent,
  AgentRequest,
  AgentResponse,
  ExecutionLogEntry,
  X402PaymentInfo,
  JsonRpcRequest,
  JsonRpcResponse,
} from './types.js';

// Services
export {
  discoverAgents,
  type DiscoverAgentsInput,
  type DiscoverAgentsOutput,
} from './services/index.js';
