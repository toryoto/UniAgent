/**
 * Execute Agent Tool
 *
 * x402 v2決済を使用して外部エージェントを実行するLangChainツール
 *
 * Privy delegated walletを使用してユーザーのウォレットで署名を行う
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrivyClient } from '@privy-io/server-auth';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import type { Hex, TypedDataDefinition } from 'viem';
import type { AgentJson, JsonRpcRequest, JsonRpcResponse } from '@agent-marketplace/shared';
import { logger } from '../utils/logger.js';

// Privy client initialization with authorization key
const authorizationKey = process.env.PRIVY_AUTHORIZATION_KEY || '';
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID || '',
  process.env.PRIVY_APP_SECRET || '',
  authorizationKey
    ? {
        authorizationPrivateKey: authorizationKey,
      }
    : undefined
);

logger.payment.info('Privy client initialized', {
  hasAuthorizationKey: !!authorizationKey,
});

const CHAIN_ID = 84532; // Base Sepolia

interface ExecuteAgentInput {
  agentUrl: string;
  task: string;
  maxPrice: number;
  walletId: string;
  walletAddress: string;
}

interface ExecuteAgentResult {
  success: boolean;
  result?: unknown;
  paymentAmount?: number;
  transactionHash?: string;
  error?: string;
}

/**
 * PrivyベースのEIP-712署名アダプター
 * @x402/evmが期待するClientEvmSigner型に適合
 *
 * Privy delegated walletを使用して、ユーザーのembedded walletで
 * サーバー側から署名を行う。
 *
 * 前提条件:
 * 1. ユーザーがクライアント側でウォレットを委譲している (delegateWallet)
 * 2. サーバーにauthorization keyが設定されている
 */
class PrivyEIP712Signer {
  public address: `0x${string}`;

  constructor(
    private privyClient: PrivyClient,
    private walletId: string,
    walletAddress: string
  ) {
    this.address = walletAddress as `0x${string}`;
  }

  /**
   * EIP-712署名（x402で使用）
   * @x402/evmはこのメソッドを呼び出して決済署名を作成
   *
   * Privy walletApi.ethereum.signTypedDataを使用して
   * delegated walletで署名を行う
   */
  async signTypedData(typedData: TypedDataDefinition): Promise<Hex> {
    logger.payment.info('Signing EIP-712 typed data via Privy delegated wallet', {
      walletId: this.walletId,
      walletAddress: this.address,
      primaryType: typedData.primaryType,
      hasAuthorizationKey: !!authorizationKey,
    });

    try {
      // Privy wallet APIを使用してdelegated walletで署名
      // authorization keyが設定されている場合、自動的にリクエストに署名される
      const result = await this.privyClient.walletApi.ethereum.signTypedData({
        walletId: this.walletId,
        typedData: typedData as any,
      });

      logger.payment.success('EIP-712 signature created via delegated wallet', {
        signature: `${result.signature.slice(0, 10)}...`,
        walletId: this.walletId,
      });

      return result.signature as Hex;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown';

      // より詳細なエラーメッセージを提供
      if (errorMessage.includes('authorization')) {
        logger.payment.error(
          'Authorization key error - check if PRIVY_AUTHORIZATION_KEY is set correctly',
          {
            error: errorMessage,
            walletId: this.walletId,
          }
        );
      } else if (errorMessage.includes('delegated') || errorMessage.includes('permission')) {
        logger.payment.error('Wallet not delegated - user must delegate wallet from client first', {
          error: errorMessage,
          walletId: this.walletId,
        });
      } else {
        logger.payment.error('Failed to sign EIP-712 typed data', {
          error: errorMessage,
          walletId: this.walletId,
        });
      }

      throw error;
    }
  }
}

/**
 * .well-known/agent.json を取得
 */
async function fetchAgentJson(baseUrl: string): Promise<AgentJson | null> {
  try {
    const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const agentJsonUrl = `${normalizedUrl}`;

    logger.logic.info('Fetching agent.json', { url: agentJsonUrl });

    const response = await fetch(agentJsonUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.logic.warn('agent.json not found', { status: response.status });
      return null;
    }

    const agentJson = (await response.json()) as AgentJson;
    logger.logic.success('Got agent.json', { endpoint: agentJson.endpoints?.[0]?.url });
    return agentJson;
  } catch (error) {
    logger.logic.warn('Failed to fetch agent.json', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * x402対応fetchクライアントを作成 (v2)
 */
function createX402FetchClient(
  privyClient: PrivyClient,
  walletId: string,
  walletAddress: string
): ReturnType<typeof wrapFetchWithPayment> {
  logger.payment.info('Creating x402 v2 client with Privy signer', {
    walletId,
    walletAddress,
    network: `eip155:${CHAIN_ID}`,
  });

  // 1. Privy署名アダプターを作成
  const signer = new PrivyEIP712Signer(privyClient, walletId, walletAddress);

  // 2. x402クライアントを初期化
  const client = new x402Client();

  // 3. EVM exact schemeを登録 (v2対応)
  // registerExactEvmScheme は内部で ExactEvmScheme を使用
  registerExactEvmScheme(client, {
    signer: signer as any, // PrivyEIP712Signer を ClientEvmSigner として扱う
    networks: [`eip155:${CHAIN_ID}`], // Base Sepolia (CAIP-2形式)
  });

  // 4. 決済対応fetchを作成
  // wrapFetchWithPayment は 402レスポンスを自動的に処理:
  // - PAYMENT-REQUIRED ヘッダーをパース
  // - 署名を作成
  // - PAYMENT-SIGNATURE ヘッダーで再送
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  logger.payment.success('x402 v2 client created successfully');

  return fetchWithPayment;
}

/**
 * execute_agent ツール実装 (v2対応)
 */
async function executeAgentImpl(input: ExecuteAgentInput): Promise<ExecuteAgentResult> {
  const { agentUrl, task, maxPrice, walletId, walletAddress } = input;

  logger.agent.info('Executing agent with x402 v2', {
    agentUrl,
    task,
    maxPrice,
    protocol: 'x402 v2',
  });

  try {
    // 1. x402対応fetchクライアントを作成
    const fetchWithPayment = createX402FetchClient(privyClient, walletId, walletAddress);

    // 2. agent.jsonを取得してエンドポイントを特定
    const agentJson = await fetchAgentJson(agentUrl);
    const endpoint = agentJson?.endpoints?.[0]?.url || `${agentUrl}/api/v1/agent`;

    logger.logic.info('Using agent endpoint', { endpoint });

    // 3. A2Aリクエストを準備
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ type: 'text', text: task }],
        },
      },
    };

    // 4. リクエスト送信
    logger.logic.info('Sending request (402 will be handled automatically)');

    const response = await fetchWithPayment(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000),
    });

    // 5. レスポンス処理
    if (!response.ok) {
      const errorText = await response.text();
      logger.agent.error('Agent request failed', {
        status: response.status,
        error: errorText,
      });

      return {
        success: false,
        error: `Agent request failed: ${response.status} - ${errorText}`,
      };
    }

    // 6. x402HTTPClientを使用して決済情報を取得
    const client = new x402Client();
    const httpClient = new x402HTTPClient(client);

    // PAYMENT-RESPONSE ヘッダーから決済情報を抽出
    const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
      response.headers.get(name)
    );

    let paymentAmount: number | undefined;
    let transactionHash: string | undefined;

    if (paymentResponse) {
      if (!paymentResponse.success) {
        logger.payment.error('Payment settlement failed', {
          errorReason: paymentResponse.errorReason,
          payer: paymentResponse.payer,
        });

        return {
          success: false,
          error: `Payment failed: ${paymentResponse.errorReason || 'Unknown error'}`,
        };
      }

      transactionHash = paymentResponse.transaction;

      logger.payment.success('Payment completed', {
        txHash: transactionHash,
        network: paymentResponse.network,
        payer: paymentResponse.payer,
      });

      // 注意: SettleResponseにはamountフィールドがないため、
      // 決済金額の検証は事前のPAYMENT-REQUIREDレスポンスから取得する必要がある
      // wrapFetchWithPaymentが自動的に処理するため、ここでは取得できない
      logger.payment.info('Payment amount verification', {
        note: 'Amount is verified by wrapFetchWithPayment before settlement',
        maxPrice,
      });
    } else {
      logger.logic.info('Request completed without payment');
    }

    // 7. レスポンスを解析
    const result = (await response.json()) as JsonRpcResponse;

    logger.agent.success('Agent execution completed', {
      hasPayment: paymentResponse !== null,
      transactionHash,
    });

    return {
      success: true,
      result: result.result,
      paymentAmount,
      transactionHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('execute_agent failed', { error: message });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * execute_agent ツール定義
 */
export const executeAgentTool = tool(
  async (input) => {
    try {
      const result = await executeAgentImpl(input);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.agent.error('execute_agent tool error', { error: message });
      return JSON.stringify({
        success: false,
        error: message,
      });
    }
  },
  {
    name: 'execute_agent',
    description: `外部エージェントをx402 v2決済付きで実行します。

【機能】
- discover_agentsで取得したエージェントURLを指定してタスクを依頼
- HTTP 402 Payment Requiredが返された場合、自動的にx402決済を実行
- EIP-3009 TransferWithAuthorizationによるガスレス決済
- Base Sepolia (eip155:84532) 対応

【注意】
- 決済は自動的に実行されます（maxPriceは参考値）
- USDC残高が不足している場合はエラーになります
- 決済はオンチェーンで確定するため、取り消しできません

【レスポンス】
- success: 実行成功可否
- result: 外部エージェントからのレスポンス
- paymentAmount: 決済額 (USDC)
- transactionHash: オンチェーントランザクションハッシュ
- error: エラーメッセージ（失敗時のみ）

使用例:
{
  "agentUrl": "https://example.com/agent",
  "task": "東京の天気を教えて",
  "maxPrice": 0.1,
  "walletId": "privy-wallet-id",
  "walletAddress": "0x..."
}`,
    schema: z.object({
      agentUrl: z.string().describe('エージェントのBase URL'),
      task: z.string().describe('エージェントに依頼するタスク'),
      maxPrice: z.number().describe('許容する最大価格 (USDC) - 参考値'),
      walletId: z.string().describe('Privyウォレット ID'),
      walletAddress: z.string().describe('ウォレットアドレス (0x...)'),
    }),
  }
);
