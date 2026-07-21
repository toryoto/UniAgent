/**
 * Agent Marketplace - Type Definitions
 *
 * A2Aプロトコル、ブロックチェーン、x402決済に関する型定義
 */

// ============================================================================
// A2A Protocol Types
// ============================================================================

import type { DiscoveredAgent, HITLActionRequest, HITLReviewConfig } from '@agent-marketplace/shared';

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
// UI State Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
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
  agents: DiscoveredAgent[];
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
  /** LangChain / SSE の tool_call_id（並列ツールや同一ツール複数回の区別用） */
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'calling' | 'completed';
  step: number;
}

export interface AgentApproval {
  threadId: string;
  actionRequests: HITLActionRequest[];
  reviewConfigs: HITLReviewConfig[];
  resolved?: boolean;
}

export interface AgentStreamMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: AgentToolCall[];
  totalCost?: number;
  payment?: { amount: number; totalCost: number; remainingBudget: number };
  approval?: AgentApproval;
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
