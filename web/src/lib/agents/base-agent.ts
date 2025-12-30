/**
 * BaseAgent - Dummy Agent基底クラス
 *
 * x402決済はwithX402ミドルウェアで処理するため、
 * このクラスはエージェントメタデータとモックレスポンス生成のみを担当
 */

import { USDC_BASE_SEPOLIA_ADDRESS, BASE_SEPOLIA_NETWORK_ID } from '@/lib/x402/constants';

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

  /** 1回あたりの価格（ドル表記: "$0.01"） */
  abstract readonly price: string;

  /** 1回あたりの価格（USDC 6 decimals: "10000"） */
  abstract readonly pricePerCall: string;

  /** 受取アドレス */
  abstract readonly receiverAddress: string;

  /** カテゴリ */
  abstract readonly category: string;

  /** ネットワーク（x402形式） */
  readonly network: string = 'base-sepolia';

  /**
   * モックレスポンスを生成（各エージェントで実装）
   * withX402でラップされたハンドラーから呼び出される
   */
  abstract generateMockResponse(params: Record<string, unknown>): unknown;

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
        tokenAddress: USDC_BASE_SEPOLIA_ADDRESS,
        receiverAddress: this.receiverAddress,
        pricePerCall: this.pricePerCall,
        price: this.price,
        network: this.network,
        chain: BASE_SEPOLIA_NETWORK_ID,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
    };
  }

  /**
   * x402 Route Config を取得
   */
  getX402Config(): {
    price: string;
    network: 'base-sepolia';
    config: { description: string };
  } {
    return {
      price: this.price,
      network: 'base-sepolia' as const,
      config: { description: this.description },
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
