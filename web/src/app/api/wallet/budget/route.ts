/**
 * Budget Settings API
 *
 * GET  /api/wallet/budget — 現在の予算設定を取得
 * PATCH /api/wallet/budget — 予算設定を更新（upsert）
 *
 * Authorization: Bearer <privy-auth-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';

const DEFAULTS = {
  dailyLimit: 100,
  autoApproveThreshold: 1,
};

/**
 * GET /api/wallet/budget
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { privyUserId: auth.privyUserId },
      select: { id: true, budgetSettings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      dailyLimit: user.budgetSettings
        ? Number(user.budgetSettings.dailyLimit)
        : DEFAULTS.dailyLimit,
      autoApproveThreshold: user.budgetSettings
        ? Number(user.budgetSettings.autoApproveThreshold)
        : DEFAULTS.autoApproveThreshold,
    });
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

    const user = await prisma.user.findUnique({
      where: { privyUserId: auth.privyUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data: Record<string, number> = {};
    if (dailyLimit !== undefined) data.dailyLimit = dailyLimit;
    if (autoApproveThreshold !== undefined) data.autoApproveThreshold = autoApproveThreshold;

    const settings = await prisma.budgetSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        dailyLimit: dailyLimit ?? DEFAULTS.dailyLimit,
        autoApproveThreshold: autoApproveThreshold ?? DEFAULTS.autoApproveThreshold,
      },
      update: data,
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
