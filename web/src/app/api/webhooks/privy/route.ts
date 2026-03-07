/**
 * Privy Webhook エンドポイント
 * ユーザー作成・更新・ウォレット連携イベントを受信してDBに同期
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractWalletAddress, type PrivyWebhookPayload } from '@/lib/privy/webhook';
import { createUser, upsertUserWithWallet, updateUserWallet } from '@/lib/db/users';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log('[Privy Webhook] Received request');

    // TODO: Svix署名検証を実装

    const parsed = JSON.parse(rawBody);
    const payload = parsed as PrivyWebhookPayload;

    console.log(`[Privy Webhook] Event: ${payload.type}, User ID: ${payload.user?.id}`);

    switch (payload.type) {
      case 'user.created':
        await handleUserCreated(payload.user.id, payload.user);
        break;

      case 'user.authenticated':
        console.log(`[Privy Webhook] User authenticated: ${payload.user.id}`);
        break;

      case 'user.linked_account':
      case 'user.wallet_created':
        await handleAccountLinked(payload.user.id, payload.user);
        break;

      case 'user.unlinked_account':
        await handleAccountUnlinked(payload.user.id, payload.user);
        break;

      default:
        console.warn(`[Privy Webhook] Unhandled event: ${payload.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Privy Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleUserCreated(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);
  await createUser({ privyUserId, walletAddress });
  console.log(`[Privy Webhook] User created: ${privyUserId}, wallet: ${walletAddress}`);
}

async function handleAccountLinked(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);
  await upsertUserWithWallet({ privyUserId, walletAddress });
  console.log(`[Privy Webhook] Account linked: ${privyUserId}, wallet: ${walletAddress}`);
}

async function handleAccountUnlinked(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);
  await updateUserWallet(privyUserId, walletAddress);
  console.log(
    `[Privy Webhook] Account unlinked: ${privyUserId}, remaining wallet: ${walletAddress}`
  );
}
