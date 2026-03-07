/**
 * Conversations API
 *
 * GET  /api/conversations  → 認証ユーザーの会話一覧
 * POST /api/conversations  → 新規会話作成
 *
 * Authorization: Bearer <privy-auth-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { findUserIdByPrivyId } from '@/lib/db/users';
import { listConversationsByUser, createConversation } from '@/lib/db/conversations';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await findUserIdByPrivyId(auth.privyUserId);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversations = await listConversationsByUser(userId);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[Conversations API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title } = body;

    const userId = await findUserIdByPrivyId(auth.privyUserId);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversation = await createConversation(userId, title || null);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('[Conversations API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
