/**
 * Conversation API
 *
 * DELETE /api/conversations/[conversationId]  → 会話削除（所有者のみ）
 *
 * Authorization: Bearer <privy-auth-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { findUserIdByPrivyId } from '@/lib/db/users';
import { findConversationOwner, deleteConversation } from '@/lib/db/conversations';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;

    const userId = await findUserIdByPrivyId(auth.privyUserId);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversation = await findConversationOwner(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (conversation.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteConversation(conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Conversation Detail API] DELETE error:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
