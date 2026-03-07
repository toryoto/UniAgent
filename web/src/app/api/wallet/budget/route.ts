/**
 * Budget Settings API
 *
 * GET  /api/wallet/budget — 現在の予算設定を取得
 * PATCH /api/wallet/budget — 予算設定を更新（upsert）
 *
 * Authorization: Bearer <privy-auth-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { findUserIdByPrivyId } from '@/lib/db/users';
import { getBudgetSettings, upsertBudgetSettings } from '@/lib/db/budget-settings';

/**
 * GET /api/wallet/budget
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getBudgetSettings(auth.privyUserId);
    if (!settings) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Budget API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/wallet/budget
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { dailyLimit, autoApproveThreshold } = body;

    if (
      (dailyLimit !== undefined && (typeof dailyLimit !== 'number' || dailyLimit <= 0)) ||
      (autoApproveThreshold !== undefined &&
        (typeof autoApproveThreshold !== 'number' || autoApproveThreshold <= 0))
    ) {
      return NextResponse.json(
        { error: 'dailyLimit and autoApproveThreshold must be positive numbers' },
        { status: 400 },
      );
    }

    const userId = await findUserIdByPrivyId(auth.privyUserId);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = await upsertBudgetSettings(userId, {
      dailyLimit,
      autoApproveThreshold,
    });

    return NextResponse.json({
      dailyLimit: Number(settings.dailyLimit),
      autoApproveThreshold: Number(settings.autoApproveThreshold),
    });
  } catch (error) {
    console.error('[Budget API] PATCH error:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
