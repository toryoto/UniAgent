/**
 * @module lib/payment/privy-client
 * Privy SDK クライアントの遅延初期化シングルトン。
 * テスタビリティ向上のため、モジュールレベル副作用を排除し、
 * 初回アクセス時に初期化する。
 */

import { PrivyClient } from '@privy-io/server-auth';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('payment');

let _instance: PrivyClient | null = null;

/**
 * PrivyClient のシングルトンインスタンスを取得する。
 * 初回呼び出し時に環境変数から初期化される。
 *
 * @returns 初期化済みの PrivyClient
 */
export function getPrivyClient(): PrivyClient {
  if (_instance) return _instance;

  const authorizationKey = process.env.PRIVY_AUTHORIZATION_KEY || '';

  _instance = new PrivyClient(
    process.env.PRIVY_APP_ID || '',
    process.env.PRIVY_APP_SECRET || '',
    authorizationKey
      ? {
          walletApi: {
            authorizationPrivateKey: authorizationKey,
          },
        }
      : undefined,
  );

  log.info({ hasAuthorizationKey: !!authorizationKey }, 'Privy client initialized');

  return _instance;
}
