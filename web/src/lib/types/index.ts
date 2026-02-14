/**
 * Agent Marketplace - Type Definitions
 *
 * A2Aプロトコル、ブロックチェーン、x402決済に関する型定義
 */

// ============================================================================
// A2A Protocol Types
// ============================================================================

import type {
  ExecutionLogEntry,
  ERC8004RegistrationFile,
  AgentJsonPayment,
} from '@agent-marketplace/shared';

// ============================================================================
// API DTO Types (ERC-8004 ベース)
// ============================================================================

/** DB の AgentCache から返す ERC-8004 ベースのカード */
export interface ERC8004AgentCard extends ERC8004RegistrationFile {
  agentId: string;
  owner?: string;
  payment?: AgentJsonPayment;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface Transaction {
  txId: string; // bytes32 -> hex string
  agentId: string;
  caller: string; // address
  rating: number; // 1-5（0は未評価）
  amount: bigint;
  timestamp: bigint;
}

// ============================================================================
// x402 Payment Types
// ============================================================================

export interface X402PaymentRequest {
  receiver: string;
  amount: string;
  token: string;
  chain: string;
  nonce: string;
  validAfter?: number;
  validBefore?: number;
}

export interface X402PaymentAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v: number;
  r: string;
  s: string;
}

export interface X402PaymentResponse {
  txHash: string;
  status: 'success' | 'failed';
}

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPToolDiscoverAgentsInput {
  category?: string;
  maxPrice?: number;
  minReputation?: number;
}

export interface MCPToolDiscoverAgentsOutput {
  agents: ERC8004AgentCard[];
}

export interface MCPToolExecuteAgentInput {
  agentUrl: string;
  message: string;
  userId: string;
}

export interface MCPToolExecuteAgentOutput {
  status: 'success' | 'failed';
  result: unknown;
  txHash?: string;
}

export interface MCPToolRecordTransactionInput {
  agentId: string;
  amount: number;
  userId: string;
}

export interface MCPToolRecordTransactionOutput {
  status: 'success';
  txHash: string;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: ToolCallLog[];
    cost?: number;
  };
}

// ============================================================================
// Structured Message Types (for Agent Chat with Commands)
// ============================================================================

/**
 * Structured message with optional agent ID reference
 */
export interface StructuredChatMessage {
  text: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallLog {
  id: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'success' | 'failed';
  timestamp: Date;
  duration?: number;
}

// ============================================================================
// Chat API Types (SSE / Claude API)
// ============================================================================

export interface ChatApiRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** 将来のMCP統合時に使う設定 */
  mcpConfig?: MCPConfig;
}

/** MCP Connector 設定（将来拡張用） */
export interface MCPConfig {
  enabled: boolean;
  servers?: MCPServerDefinition[];
  tools?: MCPToolDefinition[];
}

export interface MCPServerDefinition {
  type: 'url';
  url: string;
  name: string;
  authorization_token?: string;
}

export interface MCPToolDefinition {
  type: 'mcp';
  server_label: string;
  tool_name: string;
}

export type ChatSSEEvent =
  | { type: 'start'; messageId: string }
  | { type: 'delta'; content: string }
  | { type: 'tool_use_start'; toolCall: ToolCallLog }
  | { type: 'tool_use_delta'; toolCallId: string; partialInput: string }
  | { type: 'tool_use_end'; toolCallId: string; output: unknown }
  | { type: 'end'; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: string };

export interface UserBudgetSettings {
  dailyLimit: number; // USDC
  autoApproveThreshold: number; // USDC
  spentToday: number; // USDC
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DiscoveryApiResponse {
  agents: ERC8004AgentCard[];
  total: number;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  total: number;
  totalSpent: string;
}

// ============================================================================
// Form Types
// ============================================================================

export interface RatingFormData {
  txId: string;
  agentId: string;
  rating: number; // 1-5
}

export interface BudgetSettingsFormData {
  dailyLimit: number;
  autoApproveThreshold: number;
}

// ============================================================================
// Agent Streaming Types (SSE from /api/agent/stream)
// ============================================================================

export type { StreamEvent } from '@agent-marketplace/shared';

export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'calling' | 'completed';
  step: number;
}

export interface AgentStreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: AgentToolCall[];
  executionLog?: ExecutionLogEntry[];
  totalCost?: number;
  payment?: { amount: number; totalCost: number; remainingBudget: number };
}

// ============================================================================
// Filter Types
// ============================================================================

export interface MarketplaceFilters {
  category?: string;
  maxPrice?: number;
  searchQuery?: string;
  sortBy?: 'price' | 'newest';
  sortOrder?: 'asc' | 'desc';
}
