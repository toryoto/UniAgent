/**
 * x402 Protocol Types
 *
 * NOTE: x402決済関連の型はCoinbase x402 SDK が提供するため、
 * ここではエージェント固有の型のみ定義します。
 *
 * x402 SDK の型:
 * - x402-next: withX402, paymentMiddleware など
 * - @coinbase/x402: facilitator など
 */

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
