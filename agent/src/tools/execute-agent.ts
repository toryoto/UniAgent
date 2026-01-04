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
import type { JsonRpcRequest, JsonRpcResponse } from '@agent-marketplace/shared';
import { logger } from '../utils/logger.js';
import type { ExecuteAgentInput, ExecuteAgentResult } from './types.js';
import { REQUEST_TIMEOUT_MS } from './constants.js';
import { createX402FetchClient } from './x402-client.js';
import { fetchAgentJson } from './agent-utils.js';
import {
  decodePaymentRequiredHeader,
  convertAmountToUSDC,
  getPaymentSettleResponse,
} from './payment-utils.js';
import { handle402Error, handlePaymentSettlementError } from './error-handlers.js';

// Privy client initialization with authorization key
const authorizationKey = process.env.PRIVY_AUTHORIZATION_KEY || '';
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID || '',
  process.env.PRIVY_APP_SECRET || '',
  authorizationKey
    ? {
        walletApi: {
          authorizationPrivateKey: authorizationKey,
        },
      }
    : undefined
);

logger.payment.info('Privy client initialized', {
  hasAuthorizationKey: !!authorizationKey,
});

/**
 * A2Aリクエストを作成
 */
function createJsonRpcRequest(task: string): JsonRpcRequest {
  return {
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
}

/**
 * レスポンスをログに記録
 */
function logResponse(
  response: Response,
  paymentRequiredDecoded: ReturnType<typeof decodePaymentRequiredHeader>
): void {
  logger.payment.info('Response received from Agent', {
    status: response.status,
    statusText: response.statusText,
    hasPaymentResponse: response.headers.has('PAYMENT-RESPONSE'),
    paymentResponse: response.headers.get('PAYMENT-RESPONSE'),
    hasPaymentRequired: response.headers.has('PAYMENT-REQUIRED'),
    paymentRequiredDecoded,
    allHeaders: Object.fromEntries(response.headers.entries()),
  });
}

/**
 * 決済情報を処理
 */
async function processPaymentResponse(
  response: Response,
  paymentRequiredDecoded: ReturnType<typeof decodePaymentRequiredHeader>,
  maxPrice: number
): Promise<{ transactionHash?: string; paymentAmount?: number }> {
  const paymentResponse = getPaymentSettleResponse((name) => response.headers.get(name));

  if (!paymentResponse) {
    logger.logic.info('Request completed without payment', {
      note: 'This endpoint may not require payment, or payment was already processed in a previous request.',
    });
    return {};
  }

  if (!paymentResponse.success) {
    const { errorMessage } = handlePaymentSettlementError(
      paymentResponse.errorReason || 'Unknown error',
      paymentResponse.payer,
      paymentResponse.network
    );
    throw new Error(errorMessage);
  }

  const transactionHash = paymentResponse.transaction;
  const paymentAmountUSDC = paymentRequiredDecoded?.accepts?.[0]?.amount
    ? convertAmountToUSDC(paymentRequiredDecoded.accepts[0].amount)
    : undefined;

  logger.payment.success('Payment completed', {
    txHash: transactionHash,
    network: paymentResponse.network,
    payer: paymentResponse.payer,
    amount: paymentAmountUSDC ? `${paymentAmountUSDC} USDC` : 'unknown',
    amountRaw: paymentRequiredDecoded?.accepts?.[0]?.amount,
  });

  // 決済金額の検証ログ
  if (paymentAmountUSDC && maxPrice) {
    const amount = parseFloat(paymentAmountUSDC);
    if (amount > maxPrice) {
      logger.payment.warn('Payment amount exceeds maxPrice', {
        amount,
        maxPrice,
        note: 'Payment was processed but exceeded the specified maxPrice limit.',
      });
    } else {
      logger.payment.info('Payment amount within maxPrice limit', {
        amount,
        maxPrice,
      });
    }
  }

  return {
    transactionHash,
    paymentAmount: paymentAmountUSDC ? parseFloat(paymentAmountUSDC) : undefined,
  };
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
    const endpoint = agentJson?.endpoints?.[0]?.url;

    logger.logic.info('Using agent endpoint', { endpoint });

    // 3. A2Aリクエストを準備
    const request = createJsonRpcRequest(task);

    // 4. リクエスト送信
    // wrapFetchWithPaymentは以下のフローを自動的に処理:
    // 1. 初回リクエスト送信
    // 2. 402 Payment Required + PAYMENT-REQUIREDヘッダーを受信
    // 3. 署名を作成（PrivyEIP712Signerを使用）
    // 4. PAYMENT-SIGNATUREヘッダーを追加して再送信
    logger.logic.info('Sending request (402 will be handled automatically)', {
      endpoint,
      note: 'wrapFetchWithPayment will automatically retry with PAYMENT-SIGNATURE if 402 is received',
    });

    const response = await fetchWithPayment(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // 5. PAYMENT-REQUIREDヘッダーをデコード
    const paymentRequiredHeader = response.headers.get('PAYMENT-REQUIRED');
    const paymentRequiredDecoded = decodePaymentRequiredHeader(paymentRequiredHeader);

    // 6. レスポンスをログに記録
    logResponse(response, paymentRequiredDecoded);

    // 7. エラーレスポンスを処理(x402の自動再リクエストでもエラーが起きた時に原因をログ出力する)
    if (!response.ok) {
      if (response.status === 402) {
        const { errorMessage } = handle402Error(response, paymentRequiredDecoded, maxPrice);
        return {
          success: false,
          error: errorMessage,
        };
      }

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

    // 8. 決済情報を処理
    const { transactionHash, paymentAmount } = await processPaymentResponse(
      response,
      paymentRequiredDecoded,
      maxPrice
    );

    // 9. レスポンスを解析
    const result = (await response.json()) as JsonRpcResponse;

    logger.agent.success('Agent execution completed', {
      hasPayment: transactionHash !== undefined,
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
// @ts-ignore - Type instantiation is excessively deep (TS2589)
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
