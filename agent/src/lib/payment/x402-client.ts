/**
 * @module lib/payment/x402-client
 * x402 対応 fetch クライアントのファクトリ。
 * wrapFetchWithPayment が 402 レスポンスを自動処理し、
 * PAYMENT-SIGNATURE ヘッダー付きで再送する。
 */

import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { PrivyClient } from '@privy-io/server-auth';
import { PrivyEIP712Signer } from './privy-signer.js';
import { NETWORK_ID } from '../../config/constants.js';
import { logger } from '@agent-marketplace/shared/logger';

/**
 * x402 対応 fetch クライアントを作成する。
 * 返却される fetch 関数は 402 レスポンスを受信した際に:
 * 1. PAYMENT-REQUIRED ヘッダーをパース
 * 2. PrivyEIP712Signer で署名を作成
 * 3. PAYMENT-SIGNATURE ヘッダーを追加してリクエストを再送
 *
 * @param privyClient - Privy SDK クライアント
 * @param walletId - Privy ウォレット ID
 * @param walletAddress - ウォレットアドレス (0x...)
 * @returns x402 決済対応の fetch 関数
 */
export function createX402FetchClient(
  privyClient: PrivyClient,
  walletId: string,
  walletAddress: string,
): ReturnType<typeof wrapFetchWithPayment> {
  logger.payment.info('Creating x402 v2 client with Privy signer', {
    walletId,
    walletAddress,
    network: NETWORK_ID,
  });

  const signer = new PrivyEIP712Signer(privyClient, walletId, walletAddress);
  const client = new x402Client();

  registerExactEvmScheme(client, {
    signer: signer as any,
    networks: [NETWORK_ID],
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  logger.payment.success('x402 v2 client created successfully');

  return fetchWithPayment;
}
