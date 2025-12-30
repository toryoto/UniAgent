/**
 * BaseAgent - Dummy Agent基底クラス
 *
 * x402決済とA2A JSON-RPC 2.0プロトコルを実装
 */

import {
  USDC_SEPOLIA_ADDRESS,
  SEPOLIA_NETWORK_ID,
  X402_VERSION,
  verifyX402Payment,
  executePayment,
  decodePaymentHeader,
} from '@/lib/x402';
import type {
  X402PaymentInfo,
  X402PaymentResponse,
  AgentJsonRpcRequest,
  AgentJsonRpcResponse,
} from '@/lib/x402/types';

export interface AgentRequestContext {
  body: AgentJsonRpcRequest;
  headers: {
    'x-payment'?: string;
  };
}

export interface AgentResponseContext {
  status: number;
  body: X402PaymentInfo | AgentJsonRpcResponse;
  headers?: Record<string, string>;
}

/**
 * Dummy Agent基底クラス
 *
 * 継承して各エージェント（Flight, Hotel, Tourism）を実装
 */
export abstract class BaseAgent {
  /** エージェントID (bytes32 hex) */
  abstract readonly agentId: string;

  /** エージェント名 */
  abstract readonly name: string;

  /** エージェント説明 */
  abstract readonly description: string;

  /** 1回あたりの価格（USDC 6 decimals） */
  abstract readonly pricePerCall: string;

  /** 受取アドレス */
  abstract readonly receiverAddress: string;

  /** カテゴリ */
  abstract readonly category: string;

  /**
   * モックレスポンスを生成（各エージェントで実装）
   */
  protected abstract generateMockResponse(params: Record<string, unknown>): unknown;

  /**
   * リクエストを処理
   */
  async handleRequest(req: AgentRequestContext): Promise<AgentResponseContext> {
    const body = req.body;

    // JSON-RPC 2.0 検証
    if (body.jsonrpc !== '2.0' || body.method !== 'message/send') {
      return {
        status: 400,
        body: {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request: Expected JSON-RPC 2.0 with method "message/send"',
          },
        },
      };
    }

    // x402 決済チェック
    const paymentHeader = req.headers['x-payment'];
    if (!paymentHeader) {
      return this.requirePayment();
    }

    // 署名検証
    const verification = await verifyX402Payment(
      paymentHeader,
      this.receiverAddress,
      this.pricePerCall
    );

    if (!verification.success) {
      return {
        status: 403,
        body: {
          jsonrpc: '2.0',
          error: {
            code: 403,
            message: `Payment verification failed: ${verification.error}`,
          },
        },
      };
    }

    // 決済実行（PoC: モック）
    const payment = decodePaymentHeader(paymentHeader);
    const paymentResult = await executePayment(payment);

    if (!paymentResult.success) {
      return {
        status: 500,
        body: {
          jsonrpc: '2.0',
          error: {
            code: 500,
            message: 'Payment execution failed',
          },
        },
      };
    }

    // モックレスポンス生成
    const params = body.params || {};
    const result = this.generateMockResponse(params);

    // レスポンス返却（X-PAYMENT-RESPONSE付き）
    const paymentResponse: X402PaymentResponse = {
      version: '2',
      txHash: paymentResult.txHash || null,
      amount: this.pricePerCall,
      timestamp: Math.floor(Date.now() / 1000),
      network: SEPOLIA_NETWORK_ID,
    };

    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: body.id,
        result,
      },
      headers: {
        'X-PAYMENT-RESPONSE': Buffer.from(JSON.stringify(paymentResponse)).toString('base64'),
      },
    };
  }

  /**
   * HTTP 402 Payment Required レスポンスを生成
   */
  private requirePayment(): AgentResponseContext {
    const paymentInfo: X402PaymentInfo = {
      version: '2',
      paymentRequired: true,
      amount: this.pricePerCall,
      receiver: this.receiverAddress,
      tokenAddress: USDC_SEPOLIA_ADDRESS,
      network: SEPOLIA_NETWORK_ID,
    };

    return {
      status: 402,
      body: paymentInfo,
    };
  }

  /**
   * agent.json を生成
   */
  getAgentJson(baseUrl: string): Record<string, unknown> {
    const agentPath = this.getAgentPath();
    return {
      agent_id: this.agentId,
      name: this.name,
      description: this.description,
      version: '1.0.0',
      category: this.category,
      endpoints: [
        {
          url: `${baseUrl}/api/agents/${agentPath}`,
          spec: `${baseUrl}/api/agents/${agentPath}/openapi.json`,
        },
      ],
      payment: {
        tokenAddress: USDC_SEPOLIA_ADDRESS,
        receiverAddress: this.receiverAddress,
        pricePerCall: this.pricePerCall,
        chain: SEPOLIA_NETWORK_ID,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
    };
  }

  /**
   * OpenAPI仕様を生成（各エージェントでオーバーライド可能）
   */
  abstract getOpenApiSpec(baseUrl: string): Record<string, unknown>;

  /**
   * エージェントのパス（flight, hotel, tourism）
   */
  protected abstract getAgentPath(): string;
}
