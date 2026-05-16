/**
 * @module tools/execute-agent
 * LangChain execute_agent ツール定義。
 * x402 v2 決済を使用して外部エージェントを実行する。
 * Privy delegated wallet でユーザーのウォレット署名を行う。
 */

import { tool } from 'langchain';
import { z } from 'zod';
import type { JsonRpcResponse } from '@agent-marketplace/shared';
import { logger } from '../utils/logger.js';
import type { ExecuteAgentInput, ExecuteAgentResult, PaymentRequiredData } from '../types/index.js';
import { REQUEST_TIMEOUT_MS, MAX_PAYMENT_RETRIES } from '../config/constants.js';
import { getPrivyClient } from '../lib/payment/privy-client.js';
import { createX402FetchClient } from '../lib/payment/x402-client.js';
import { fetchAgentJson } from '../lib/a2a/agent-json.js';
import { createJsonRpcRequest } from '../lib/a2a/message.js';
import { resolveAgentUrlFromAgentId } from '../lib/a2a/resolve-url.js';
import {
  decodePaymentRequiredHeader,
  convertAmountToUSDC,
  getPaymentSettleResponse,
} from '../lib/payment/decode.js';
import { handle402Error, handlePaymentSettlementError } from '../lib/payment/error-handlers.js';

// ── Public ────────────────────────────────────────────────────────────────

const executeAgentSchema = z
  .object({
    agentId: z.string().describe('エージェントID（discover_agents の結果の agentId。Base URL はサーバーが解決）'),
    task: z
      .string()
      .optional()
      .describe('自然言語テキスト（A2A TextPart）。テキスト入力を受け付けるエージェント向け。'),
    data: z
      .record(z.unknown())
      .optional()
      .describe(
        '構造化パラメータ（A2A DataPart）。fetch_agent_spec の inputSchema / OpenAPI に基づいて構築。',
      ),
    maxPrice: z.number().describe('許容する最大価格 (USDC) - 参考値'),
    walletId: z.string().describe('Privyウォレット ID'),
    walletAddress: z.string().describe('ウォレットアドレス (0x...)'),
  })
  .refine((d) => d.task || (d.data && Object.keys(d.data).length > 0), {
    message: 'task または data の少なくとも一方が必要です',
  });

/**
 * execute_agent ツール。
 * x402 v2 決済付きで外部エージェントを実行する（A2A Protocol 準拠）。
 */
export const executeAgentTool = tool(
  async (input: z.infer<typeof executeAgentSchema>) => {
    try {
      const result = await executeAgentImpl(input);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.agent.error('execute_agent tool error', { error: message });
      return JSON.stringify({ success: false, error: message });
    }
  },
  {
    name: 'execute_agent',
    description: `外部エージェントをx402 v2決済付きで実行します（A2A Protocol準拠）。
agentId は discover_agents で得た値のみを指定すること。Base URL は AgentCache から自動解決される。

【A2Aリクエスト構築 — task / data の使い分け】
fetch_agent_spec で取得した仕様に基づき、エージェントが必要とする Part だけを送る:
- task (TextPart): 自然言語テキスト入力を受け付けるエージェント向け
- data (DataPart): inputSchema / OpenAPI でスキーマが定義されているエージェント向け
- 両方指定も可。ただし少なくとも一方は必須。

【判断基準】
1. inputSchema / OpenAPI がある → data にスキーマ準拠のオブジェクトを渡す。task は省略可。
2. スキーマがなくテキスト入力のみ → task だけを渡す。
3. スキーマ＋テキスト補足が有効 → 両方渡す。

【使用例1: テキストのみ（スキーマなし）】
{ "task": "東京の天気を教えて", ... }

【使用例2: 構造化データのみ（inputSchemaあり）】
{ "data": { "origin": "TYO", "destination": "OKA", "date": "2026-03-15" }, ... }

【使用例3: 両方】
{ "task": "東京から沖縄へのフライトを検索", "data": { "origin": "TYO", "destination": "OKA" }, ... }`,
    schema: executeAgentSchema,
  },
);

// ── Private ───────────────────────────────────────────────────────────────

async function executeAgentImpl(input: ExecuteAgentInput): Promise<ExecuteAgentResult> {
  const { agentId, task, data, maxPrice, walletId, walletAddress } = input;

  logger.agent.info('Executing agent with x402 v2', {
    agentId,
    hasTask: !!task,
    hasData: !!data,
    maxPrice,
    protocol: 'x402 v2',
  });

  try {
    const agentUrl = await resolveAgentUrlFromAgentId(agentId);
    if (!agentUrl) {
      return {
        success: false,
        error: `agentId に対応するエージェントURLを取得できませんでした: ${agentId}`,
      };
    }

    logger.agent.info('Resolved agent base URL from registry', { agentId, agentUrl });

    const privyClient = getPrivyClient();
    const fetchWithPayment = createX402FetchClient(privyClient, walletId, walletAddress);

    const agentJson = await fetchAgentJson(agentUrl);
    const endpoint = agentJson?.endpoints?.[0]?.url;
    logger.logic.info('Using agent endpoint', { endpoint });

    const request = createJsonRpcRequest(task, data);

    const response = await sendWithRetry(fetchWithPayment, endpoint, request, walletId, walletAddress);

    const paymentRequiredHeader = response.headers.get('PAYMENT-REQUIRED');
    const paymentRequiredDecoded = decodePaymentRequiredHeader(paymentRequiredHeader);

    logResponse(response, paymentRequiredDecoded);

    if (!response.ok) {
      if (response.status === 402) {
        const { errorMessage } = handle402Error(response, paymentRequiredDecoded, maxPrice);
        return { success: false, error: errorMessage };
      }

      const errorText = await response.text();
      logger.agent.error('Agent request failed', { status: response.status, error: errorText });
      return { success: false, error: `Agent request failed: ${response.status} - ${errorText}` };
    }

    const { transactionHash, paymentAmount } = await processPaymentResponse(
      response,
      paymentRequiredDecoded,
      maxPrice,
    );

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
    return { success: false, error: message };
  }
}

async function sendWithRetry(
  fetchWithPayment: ReturnType<typeof createX402FetchClient>,
  endpoint: string | undefined,
  request: unknown,
  walletId: string,
  walletAddress: string,
): Promise<Response> {
  const privyClient = getPrivyClient();
  let response!: Response;
  let lastFetchClient = fetchWithPayment;

  for (let attempt = 0; attempt <= MAX_PAYMENT_RETRIES; attempt++) {
    if (attempt > 0) {
      logger.payment.info('Retrying payment request (facilitator conflict)', {
        attempt: attempt + 1,
        endpoint,
      });
      lastFetchClient = createX402FetchClient(privyClient, walletId, walletAddress);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    response = await lastFetchClient(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (
      response.status === 402 &&
      !response.headers.has('PAYMENT-REQUIRED') &&
      attempt < MAX_PAYMENT_RETRIES
    ) {
      logger.payment.warn('Payment settlement failed (facilitator conflict), will retry', {
        attempt: attempt + 1,
        status: response.status,
      });
      continue;
    }
    break;
  }

  return response;
}

function logResponse(
  response: Response,
  paymentRequiredDecoded: PaymentRequiredData | null,
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

async function processPaymentResponse(
  response: Response,
  paymentRequiredDecoded: PaymentRequiredData | null,
  maxPrice: number,
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
      paymentResponse.network,
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

  if (paymentAmountUSDC && maxPrice) {
    const amount = parseFloat(paymentAmountUSDC);
    if (amount > maxPrice) {
      logger.payment.warn('Payment amount exceeds maxPrice', {
        amount,
        maxPrice,
        note: 'Payment was processed but exceeded the specified maxPrice limit.',
      });
    } else {
      logger.payment.info('Payment amount within maxPrice limit', { amount, maxPrice });
    }
  }

  return {
    transactionHash,
    paymentAmount: paymentAmountUSDC ? parseFloat(paymentAmountUSDC) : undefined,
  };
}
