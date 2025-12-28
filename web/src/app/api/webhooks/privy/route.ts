/**
 * Privy Webhook エンドポイント
 * ユーザー作成・更新・ウォレット連携イベントを受信してDBに同期
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { extractWalletAddress, type PrivyWebhookPayload } from '@/lib/privy/webhook';

export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディを取得
    const rawBody = await request.text();
    console.log('[Privy Webhook] Received request');

    // TODO: Svix署名検証を実装
    // - svix-signature, svix-timestamp, svix-id ヘッダーを取得
    // - PRIVY_WEBHOOK_SECRET を使用して署名を検証
    // - 署名が一致しない場合は 401 を返す
    // - 本番環境では必須、開発環境ではスキップ可能にする

    // 2. ペイロードをパース
    const parsed = JSON.parse(rawBody);
    const payload = parsed as PrivyWebhookPayload;

    console.log(`[Privy Webhook] Event: ${payload.type}, User ID: ${payload.user?.id}`);

    // 3. イベントに応じた処理
    switch (payload.type) {
      case 'user.created':
        await handleUserCreated(payload.user.id, payload.user);
        break;

      case 'user.authenticated':
        // 認証時は特に処理不要（必要に応じて最終ログイン時刻を更新など）
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

// ===== イベントハンドラー =====

/**
 * ユーザー作成
 */
async function handleUserCreated(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);

  await prisma.user.create({
    data: {
      privyUserId,
      walletAddress,
      // デフォルトの予算設定も作成
      budgetSettings: {
        create: {
          dailyLimit: 100, // 100 USDC
          autoApproveThreshold: 1, // 1 USDC
        },
      },
    },
  });

  console.log(`[Privy Webhook] User created: ${privyUserId}, wallet: ${walletAddress}`);
}

/**
 * アカウント・ウォレット連携
 */
async function handleAccountLinked(privyUserId: string, user: PrivyWebhookPayload['user']) {
  const walletAddress = extractWalletAddress(user);

  // ユーザーが存在しない場合は作成、存在する場合はウォレットアドレスを更新
  await prisma.user.upsert({
    where: { privyUserId },
    create: {
      privyUserId,
      walletAddress,
      budgetSettings: {
        create: {
          dailyLimit: 100,
          autoApproveThreshold: 1,
        },
      },
    },
    update: {
      walletAddress,
    },
  });

  console.log(`[Privy Webhook] Account linked: ${privyUserId}, wallet: ${walletAddress}`);
}

/**
 * アカウント連携解除
 */
async function handleAccountUnlinked(privyUserId: string, user: PrivyWebhookPayload['user']) {
  // 残っているウォレットアドレスを取得（複数アカウントの場合を考慮）
  const walletAddress = extractWalletAddress(user);

  await prisma.user.update({
    where: { privyUserId },
    data: { walletAddress },
  });

  console.log(
    `[Privy Webhook] Account unlinked: ${privyUserId}, remaining wallet: ${walletAddress}`
  );
}
