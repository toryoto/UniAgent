/**
 * x402 Protocol Types
 *
 * x402 v2 決済プロトコル用の型定義
 */

/**
 * HTTP 402 Payment Required レスポンスボディ
 */
export interface X402PaymentInfo {
  version: '2';
  paymentRequired: true;
  amount: string; // USDC base units (6 decimals)
  receiver: string; // Receiver address
  tokenAddress: string; // USDC contract address
  network: string; // CAIP-2 identifier (e.g., "eip155:11155111")
}

/**
 * X-PAYMENT ヘッダーの内容（Base64エンコード前）
 */
export interface X402PaymentHeader {
  version: '2';
  from: string; // Payer address
  to: string; // Receiver address
  value: string; // Amount in USDC base units
  validAfter: number; // Unix timestamp
  validBefore: number; // Unix timestamp
  nonce: string; // Random bytes32
  signature: string; // EIP-3009 signature
  v: number;
  r: string;
  s: string;
  network: string; // CAIP-2 identifier
}

/**
 * X-PAYMENT-RESPONSE ヘッダーの内容（Base64エンコード前）
 */
export interface X402PaymentResponse {
  version: '2';
  txHash: string | null; // PoC: モックなのでnull
  amount: string;
  timestamp: number;
  network: string;
}

/**
 * 署名検証結果
 */
export interface PaymentVerificationResult {
  success: boolean;
  signer?: string;
  error?: string;
}

/**
 * 決済実行結果
 */
export interface PaymentExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Agent Request (JSON-RPC 2.0)
 */
export interface AgentJsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: 'message/send';
  params: Record<string, unknown>;
}

/**
 * Agent Response (JSON-RPC 2.0)
 */
export interface AgentJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id?: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
