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
  DEFAULT_PINATA_GATEWAY,
  PINATA_GATEWAY_URL,
  parseUSDC,
  formatUSDCAmount,
} from './config.js';

export {
  AGENT_IDENTITY_REGISTRY_ABI,
  getProvider,
  getAgentIdentityRegistryContract,
} from './contract.js';

export type {
  A2ASkill,
  AgentJson,
  AgentJsonEndpoint,
  DiscoveredAgent,
  AgentRequest,
  AgentResponse,
  ExecutionLogEntry,
  StreamEvent,
  X402PaymentInfo,
  JsonRpcRequest,
  JsonRpcResponse,
  ERC8004RegistrationFile,
  ERC8004Service,
  ERC8004RegistrationEntry,
} from './types.js';

// Services
export {
  discoverAgents,
  type DiscoverAgentsInput,
  type DiscoverAgentsOutput,
} from './services/index.js';

export { uploadAgentMetadata, fetchAgentMetadata } from './services/pinata.js';
