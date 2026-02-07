/**
 * x402 Client Factory
 *
 * x402対応fetchクライアントの作成
 */

import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { PrivyClient } from '@privy-io/server-auth';
import { PrivyEIP712Signer } from './privy-signer.js';
import { NETWORK_ID } from './constants.js';
import { logger } from '../utils/logger.js';

/**
 * x402対応fetchクライアントを作成 (v2)
 */
export function createX402FetchClient(
  privyClient: PrivyClient,
  walletId: string,
  walletAddress: string
): ReturnType<typeof wrapFetchWithPayment> {
  logger.payment.info('Creating x402 v2 client with Privy signer', {
    walletId,
    walletAddress,
    network: NETWORK_ID,
  });

  // 1. Privy署名アダプターを作成()
  const signer = new PrivyEIP712Signer(privyClient, walletId, walletAddress);

  // 2. x402クライアントを初期化
  const client = new x402Client();

  // 3. EVM exact schemeを登録 (v2対応)
  registerExactEvmScheme(client, {
    signer: signer as any,
    networks: [NETWORK_ID],
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
