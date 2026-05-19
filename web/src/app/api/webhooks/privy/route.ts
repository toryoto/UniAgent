/**
 * Privy Webhook エンドポイント
 * ユーザー作成・更新・ウォレット連携イベントを受信してDBに同期
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@agent-marketplace/shared/logger';
import { extractWalletAddress, type PrivyWebhookPayload } from '@/lib/privy/webhook';

const log = createLogger('Privy Webhook');
import { createUser, upsertUserWithWallet, updateUserWallet } from '@/lib/db/users';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    log.info('Received request');

    // TODO: Svix署名検証を実装

    const parsed = JSON.parse(rawBody);
    const payload = parsed as PrivyWebhookPayload;

    log.info(`Event: ${payload.type}`, { userId: payload.user?.id });

    switch (payload.type) {
      case 'user.created':
        await handleUserCreated(payload.user.id, payload.user);
        break;

      case 'user.authenticated':
        log.info(`User authenticated`, { userId: payload.user.id });
        break;

      case 'user.linked_account':
      case 'user.wallet_created':
        await handleAccountLinked(payload.user.id, payload.user);
        break;

      case 'user.unlinked_account':
        await handleAccountUnlinked(payload.user.id, payload.user);
        break;

      default:
        log.warn(`Unhandled event: ${payload.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleUserCreated(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);
  await createUser({ privyUserId, walletAddress });
  log.success('User created', { privyUserId, walletAddress });
}

async function handleAccountLinked(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);
  await upsertUserWithWallet({ privyUserId, walletAddress });
  log.info('Account linked', { privyUserId, walletAddress });
}

async function handleAccountUnlinked(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);
  await updateUserWallet(privyUserId, walletAddress);
  log.info('Account unlinked', { privyUserId, remainingWallet: walletAddress });
}
