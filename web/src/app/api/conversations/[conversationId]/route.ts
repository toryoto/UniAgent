/**
 * Conversation API
 *
 * GET    /api/conversations/[conversationId]  → 会話取得（所有者のみ）
 * DELETE /api/conversations/[conversationId]  → 会話削除（所有者のみ）
 *
 * Authorization: Bearer <privy-auth-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@agent-marketplace/shared/logger';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';

const log = createLogger('conversations-api');
import { findUserIdByPrivyId } from '@/lib/db/users';
import {
  findConversationOwner,
  findConversationWithMessages,
  deleteConversation,
} from '@/lib/db/conversations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  return withApiLogging(request, async () => {
    try {
      const { conversationId } = await params;
      const owned = await resolveOwnedConversation(request, conversationId);
      if (!owned.ok) return owned.response;

      const conversation = await findConversationWithMessages(conversationId);
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      return NextResponse.json({
        conversation: {
          id: conversation.id,
          title: conversation.title,
          messages: conversation.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolRounds: m.toolRounds,
            totalCost: m.totalCost?.toString() ?? null,
            createdAt: m.createdAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      log.error({ err: error }, 'GET error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  return withApiLogging(request, async () => {
    try {
      const { conversationId } = await params;
      const owned = await resolveOwnedConversation(request, conversationId);
      if (!owned.ok) return owned.response;

      await deleteConversation(conversationId);

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error({ err: error }, 'DELETE error');

      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2025') {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

async function resolveOwnedConversation(
  request: NextRequest,
  conversationId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await verifyPrivyToken(request);
  if (!auth) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const userId = await findUserIdByPrivyId(auth.privyUserId);
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  const conversation = await findConversationOwner(conversationId);
  if (!conversation) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }),
    };
  }
  if (conversation.userId !== userId) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId };
}
