/**
 * Wallet Delegation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/wallet/delegation
 * 現在の委託状態を取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const privyUserId = searchParams.get('privyUserId');

    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { privyUserId },
      select: {
        id: true,
        walletAddress: true,
        isDelegated: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      isDelegated: user.isDelegated,
      walletAddress: user.walletAddress,
    });
  } catch (error) {
    console.error('[Wallet Delegation API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/wallet/delegation
 * 委託状態を更新
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyUserId, isDelegated } = body;

    if (!privyUserId || typeof isDelegated !== 'boolean') {
      return NextResponse.json(
        { error: 'privyUserId and isDelegated (boolean) are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { privyUserId },
      data: { isDelegated },
      select: {
        id: true,
        walletAddress: true,
        isDelegated: true,
      },
    });

    return NextResponse.json({
      isDelegated: user.isDelegated,
      walletAddress: user.walletAddress,
    });
  } catch (error) {
    console.error('[Wallet Delegation API] PATCH error:', error);

    // Prismaのエラーを処理
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        // Record not found
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
