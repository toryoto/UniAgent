/**
 * @module services/agent-execution
 * 外部 A2A エージェントの実行本体（x402 v2 決済付き）。
 * tools 層（execute_and_evaluate_agent）から直接呼び出されるビジネス実行ロジックで、
 * URL 解決 → A2A リクエスト送信 → 決済リトライ → 決済結果検証までを担う。
 */

import type { JsonRpcResponse } from '@agent-marketplace/shared';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('agent');
const paymentLog = createLogger('payment');
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

/**
 * 外部エージェントを x402 v2 決済付きで実行する（A2A Protocol 準拠）。
 * agentId は AgentCache から Base URL に解決されるため、URL の直接指定は受け付けない。
 * 失敗しても throw せず `success: false` の結果を返す。
 *
 * @param input - agentId / task / data / maxPrice / Privy ウォレット情報
 * @returns 実行結果（応答本体・決済額・トランザクションハッシュ）
 */
export async function executeAgent(input: ExecuteAgentInput): Promise<ExecuteAgentResult> {
  const { agentId, task, data, maxPrice, walletId, walletAddress } = input;

  log.info(
    { agentId, hasTask: !!task, hasData: !!data, maxPrice, protocol: 'x402 v2' },
    'Executing agent with x402 v2',
  );

  try {
    const agentUrl = await resolveAgentUrlFromAgentId(agentId);
    if (!agentUrl) {
      return {
        success: false,
        error: `agentId に対応するエージェントURLを取得できませんでした: ${agentId}`,
      };
    }

    log.info({ agentId, agentUrl }, 'Resolved agent base URL from registry');

    const privyClient = getPrivyClient();
    const fetchWithPayment = createX402FetchClient(privyClient, walletId, walletAddress);

    const agentJson = await fetchAgentJson(agentUrl);
    const endpoint = agentJson?.endpoints?.[0]?.url;
    log.info({ endpoint }, 'Using agent endpoint');

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
      log.error({ status: response.status, error: errorText }, 'Agent request failed');
      return { success: false, error: `Agent request failed: ${response.status} - ${errorText}` };
    }

    const { transactionHash, paymentAmount } = await processPaymentResponse(
      response,
      paymentRequiredDecoded,
      maxPrice,
    );

    const result = (await response.json()) as JsonRpcResponse;

    log.info({ hasPayment: transactionHash !== undefined, transactionHash }, 'Agent execution completed');

    return {
      success: true,
      result: result.result,
      paymentAmount,
      transactionHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ err: error }, 'executeAgent failed');
    return { success: false, error: message };
  }
}

// ── Private ───────────────────────────────────────────────────────────────

/**
 * facilitator 競合（PAYMENT-REQUIRED ヘッダなしの 402）時に、
 * 新しい署名クライアントで最大 MAX_PAYMENT_RETRIES 回まで再送する。
 */
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
      paymentLog.info({ attempt: attempt + 1, endpoint }, 'Retrying payment request (facilitator conflict)');
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
      paymentLog.warn(
        { attempt: attempt + 1, status: response.status },
        'Payment settlement failed (facilitator conflict), will retry',
      );
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
  paymentLog.debug(
    {
      status: response.status,
      statusText: response.statusText,
      hasPaymentResponse: response.headers.has('PAYMENT-RESPONSE'),
      paymentResponse: response.headers.get('PAYMENT-RESPONSE'),
      hasPaymentRequired: response.headers.has('PAYMENT-REQUIRED'),
      paymentRequiredDecoded,
    },
    'Response received from Agent',
  );
}

/**
 * PAYMENT-RESPONSE ヘッダから決済結果を検証し、決済額 (USDC) と tx hash を抽出する。
 * 決済失敗時は throw して呼び出し元でエラー結果に変換させる。
 */
async function processPaymentResponse(
  response: Response,
  paymentRequiredDecoded: PaymentRequiredData | null,
  maxPrice: number,
): Promise<{ transactionHash?: string; paymentAmount?: number }> {
  const paymentResponse = getPaymentSettleResponse((name) => response.headers.get(name));

  if (!paymentResponse) {
    log.info('Request completed without payment (endpoint may be free, or payment already processed)');
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

  paymentLog.info(
    {
      txHash: transactionHash,
      network: paymentResponse.network,
      payer: paymentResponse.payer,
      amountUsdc: paymentAmountUSDC,
      amountRaw: paymentRequiredDecoded?.accepts?.[0]?.amount,
    },
    'Payment completed',
  );

  if (paymentAmountUSDC && maxPrice) {
    const amount = parseFloat(paymentAmountUSDC);
    if (amount > maxPrice) {
      paymentLog.warn(
        { amount, maxPrice },
        'Payment amount exceeds maxPrice (payment was processed but exceeded the limit)',
      );
    } else {
      paymentLog.info({ amount, maxPrice }, 'Payment amount within maxPrice limit');
    }
  }

  return {
    transactionHash,
    paymentAmount: paymentAmountUSDC ? parseFloat(paymentAmountUSDC) : undefined,
  };
}
