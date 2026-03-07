/**
 * Execute Agent Tool - Types
 */

export interface ExecuteAgentInput {
  agentUrl: string;
  task?: string;
  data?: Record<string, unknown>;
  maxPrice: number;
  walletId: string;
  walletAddress: string;
}

export interface ExecuteAgentResult {
  success: boolean;
  result?: unknown;
  paymentAmount?: number;
  transactionHash?: string;
  error?: string;
}

export interface PaymentRequiredData {
  x402Version?: number;
  error?: string;
  resource?: { url?: string; description?: string };
  accepts?: Array<{
    scheme?: string;
    network?: string;
    amount?: string;
    asset?: string;
    payTo?: string;
  }>;
}
