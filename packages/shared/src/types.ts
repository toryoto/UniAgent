/**
 * Shared Type Definitions
 *
 * agent, web, mcpパッケージで共有する型定義
 */

// ============================================================================
// A2A Protocol Types
// ============================================================================

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface A2APaymentInfo {
  tokenAddress: string;
  receiverAddress: string;
  pricePerCall: bigint;
  chain: string;
}

export interface AgentCard {
  agentId: string;
  name: string;
  description: string;
  url: string;
  version: string;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2ASkill[];
  owner: string;
  isActive: boolean;
  createdAt: bigint;
  totalRatings: bigint;
  ratingCount: bigint;
  averageRating: number;
  payment: A2APaymentInfo;
  category: string;
  imageUrl?: string;
}

// ============================================================================
// Agent JSON Types (.well-known/agent.json)
// ============================================================================

export interface AgentJsonEndpoint {
  url: string;
  spec?: string;
}

export interface AgentJson {
  agent_id: string;
  name: string;
  description?: string;
  version?: string;
  endpoints: AgentJsonEndpoint[];
  skills?: A2ASkill[];
}

// ============================================================================
// Discovered Agent (MCP Response)
// ============================================================================

export interface DiscoveredAgent {
  agentId: string;
  name: string;
  description: string;
  url: string;
  endpoint?: string;
  version: string;
  skills: A2ASkill[];
  price: number;
  rating: number;
  ratingCount: number;
  category: string;
  owner: string;
  isActive: boolean;
  openapi?: string;
  imageUrl?: string;
}

// ============================================================================
// Agent Request Types
// ============================================================================

export interface AgentRequest {
  message: string;
  walletId: string;
  walletAddress: string;
  maxBudget: number;
  agentId?: string;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  executionLog: ExecutionLogEntry[];
  totalCost: number;
  error?: string;
}

export interface ExecutionLogEntry {
  step: number;
  type: 'llm' | 'logic' | 'payment' | 'error';
  action: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// x402 Payment Types
// ============================================================================

export interface X402PaymentInfo {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  facilitator?: string;
}

// ============================================================================
// JSON-RPC Types (A2A Protocol)
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id?: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
