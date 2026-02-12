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
// Agent Stream Events (SSE contract: agent → web)
// ============================================================================

export type StreamEvent =
  | { type: 'start'; data: { message: string; maxBudget: number } }
  | { type: 'step'; data: ExecutionLogEntry }
  | { type: 'llm_token'; data: { token: string; step: number } }
  | { type: 'llm_thinking'; data: { content: string; step: number } }
  | { type: 'tool_call'; data: { name: string; args: Record<string, unknown>; step: number } }
  | { type: 'tool_result'; data: { name: string; result: string; step: number } }
  | { type: 'payment'; data: { amount: number; totalCost: number; remainingBudget: number } }
  | {
      type: 'final';
      data: { message: string; totalCost: number; executionLog: ExecutionLogEntry[] };
    }
  | { type: 'error'; data: { error: string; executionLog: ExecutionLogEntry[] } };

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
// ERC-8004 Types (Trustless Agents)
// ============================================================================

export interface ERC8004RegistrationFile {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
  name: string;
  description: string;
  image: string;
  services: ERC8004Service[];
  x402Support?: boolean;
  active?: boolean;
  registrations?: ERC8004RegistrationEntry[];
  supportedTrust?: string[];
  category?: string;
}

export interface ERC8004Service {
  name: string;
  endpoint: string;
  version?: string;
  skills?: A2ASkill[];
  domains?: string[];
}

export interface ERC8004RegistrationEntry {
  agentId: number;
  agentRegistry: string;
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
