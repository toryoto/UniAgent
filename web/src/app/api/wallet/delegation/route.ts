/**
 * Wallet Delegation API
 *
 * Authorization: Bearer <privy-auth-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { findUserByPrivyId, updateUserDelegation } from '@/lib/db/users';

/**
 * GET /api/wallet/delegation
 * 現在の委託状態を取得
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await findUserByPrivyId(auth.privyUserId);
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
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isDelegated } = body;

    if (typeof isDelegated !== 'boolean') {
      return NextResponse.json(
        { error: 'isDelegated (boolean) is required' },
        { status: 400 }
      );
    }

    const user = await updateUserDelegation(auth.privyUserId, isDelegated);

    return NextResponse.json({
      isDelegated: user.isDelegated,
      walletAddress: user.walletAddress,
    });
  } catch (error) {
    console.error('[Wallet Delegation API] PATCH error:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
