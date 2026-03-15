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
  AGENT_STAKING_ABI,
  getProvider,
  getAgentIdentityRegistryContract,
  getAgentStakingContract,
} from './contract.js';

export type {
  A2ASkill,
  A2ATextPart,
  A2ADataPart,
  A2APart,
  A2AMessage,
  A2AMessageSendParams,
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
  HITLActionRequest,
  HITLReviewConfig,
  HITLDecision,
  AgentResumeRequest,
  SelectionReason,
  ScoredAgent,
  SelectedAgent,
} from './types.js';

// Services
export {
  discoverAgentsFromCache,
  agentCardRowToDiscoveredAgent,
  fetchPaymentFromAgentEndpoint,
  type DiscoverAgentsInput,
  type DiscoverAgentsOutput,
  type AgentCacheRow,
  type AgentJsonPayment,
} from './services/index.js';

export { uploadAgentMetadata, fetchAgentMetadata } from './services/pinata.js';

export {
  computeGlobalMeans,
  scoreAgents,
  selectAgents,
  type AgentWithStats,
} from './services/agent-ranking.js';
