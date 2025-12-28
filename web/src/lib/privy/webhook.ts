/**
 * Privy Webhookペイロード型定義
 * https://docs.privy.io/guide/webhooks
 */

// ===== Webhook イベント型定義 =====

export type PrivyWebhookEvent =
  | 'user.created'
  | 'user.authenticated'
  | 'user.linked_account'
  | 'user.wallet_created'
  | 'user.unlinked_account';

export interface PrivyLinkedAccount {
  type: string;
  address?: string;
  verified_at: number;
  first_verified_at?: number;
  latest_verified_at?: number;
  wallet_client?: string;
  wallet_client_type?: string;
  connector_type?: string;
}

export interface PrivyUser {
  id: string;
  created_at: number;
  linked_accounts: PrivyLinkedAccount[];
  has_accepted_terms: boolean;
  is_guest: boolean;
  custom_metadata?: Record<string, unknown>;
}

export interface PrivyWebhookPayload {
  type: PrivyWebhookEvent;
  user: PrivyUser;
  account?: PrivyLinkedAccount;
}

// ===== ウォレットアドレス抽出 =====

/**
 * Privyユーザーからウォレットアドレスを抽出
 */
export function extractWalletAddress(user: PrivyUser): string | null {
  const walletAccount = user.linked_accounts.find(
    (account) =>
      account.type === 'wallet' ||
      account.type === 'smart_wallet' ||
      account.type === 'coinbase_wallet'
  );

  return walletAccount?.address ?? null;
}

/**
 * Privyユーザーからメールアドレスを抽出
 */
export function extractEmail(user: PrivyUser): string | null {
  const emailAccount = user.linked_accounts.find((account) => account.type === 'email');

  return (emailAccount as { address?: string })?.address ?? null;
}
