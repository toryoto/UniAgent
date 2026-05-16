/**
 * @module types
 * agent パッケージ内で使用する全ての型定義を集約する。
 */

// ── Execute Agent ─────────────────────────────────────────────────────────

export interface ExecuteAgentInput {
  agentId: string;
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

// ── Payment (x402) ───────────────────────────────────────────────────────

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

export interface VerifyX402TxInput {
  txHash: string;
  agentId: string;
  amount: number;
  walletId: string;
}

// ── EAS Attestation ──────────────────────────────────────────────────────

export interface AttestationInput {
  agentId: string;
  paymentTx?: string;
  quality: number;
  reliability: number;
  latency: number;
  tags: string[];
  reasoning?: string;
}

export interface CreateAttestationInput {
  agentId: string;
  schemaUid: string;
  attestation: import('@agent-marketplace/database').Prisma.InputJsonValue;
  attester: string;
  paymentTx?: string;
  chainId: number;
  quality: number;
  reliability: number;
  latency: number;
  tags: string[];
  reasoning?: string;
}

// ── Evaluation ───────────────────────────────────────────────────────────

export type AgentCategory = 'research' | 'travel' | 'general';

export interface EvaluationResult {
  reasoning: string;
  qualityRaw: number;
  reliabilityRaw: number;
  quality: number;
  reliability: number;
  tags: string[];
}

export interface EvaluationScores {
  quality: number;
  reliability: number;
  qualityUint8: number;
  reliabilityUint8: number;
  tags: string[];
  reasoning: string;
}

export interface EvaluationWithAttestation {
  evaluation: EvaluationScores;
  attestation: {
    id: string;
    schemaUid: string;
    signed: boolean;
    attester: string;
  };
}

// ── Streaming ────────────────────────────────────────────────────────────

export interface StreamProcessingContext {
  stepCounter: number;
  totalCost: number;
  autoApproveThreshold: number;
  finalResponse: string;
}
