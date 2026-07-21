/**
 * @module lib/agent/conversation-resolver
 * Agent stream / resume で使う会話の解決・所有者チェック・履歴変換。
 * conversationId はクライアント入力なので、必ず認証ユーザーの所有チェックを通す。
 */

import {
  toAgentMessageHistory,
  type AgentMessageHistoryEntry,
} from '@agent-marketplace/shared';
import {
  createConversation,
  findConversationHistory,
  findConversationOwner,
} from '@/lib/db/conversations';
import { createMessage } from '@/lib/db/messages';

export { toAgentMessageHistory };

const CONVERSATION_TITLE_MAX_LENGTH = 50;

export type ConversationAccessError = 'not_found' | 'forbidden';

export type ResolveConversationResult =
  | {
      ok: true;
      conversationId: string;
      messageHistory: AgentMessageHistoryEntry[];
    }
  | { ok: false; error: ConversationAccessError };

/**
 * stream 用に会話を解決し、ユーザーメッセージを永続化する。
 *
 * - conversationId 指定あり: 所有者チェックのうえ履歴をロード（他人の会話は forbidden）
 * - 指定なし: メッセージ先頭から新規会話を作成
 *
 * @param userId - 認証済みユーザーの内部 ID
 * @param conversationId - クライアント指定の会話 ID（信用しない入力）
 * @param message - 永続化するユーザーメッセージ
 */
export async function resolveConversationForStream(
  userId: string,
  conversationId: string | undefined,
  message: string,
): Promise<ResolveConversationResult> {
  let resolvedConversationId: string;
  let messageHistory: AgentMessageHistoryEntry[] = [];

  if (conversationId) {
    const access = await checkConversationOwnership(userId, conversationId);
    if (access) return { ok: false, error: access };

    const conversation = await findConversationHistory(conversationId, userId);
    if (!conversation) return { ok: false, error: 'not_found' };

    resolvedConversationId = conversationId;
    messageHistory = toAgentMessageHistory(conversation.messages);
  } else {
    const title =
      message.length > CONVERSATION_TITLE_MAX_LENGTH
        ? message.slice(0, CONVERSATION_TITLE_MAX_LENGTH) + '...'
        : message;
    const conversation = await createConversation(userId, title);
    resolvedConversationId = conversation.id;
  }

  await createMessage({
    conversationId: resolvedConversationId,
    role: 'user',
    content: message,
  });

  return { ok: true, conversationId: resolvedConversationId, messageHistory };
}

/**
 * resume 用の所有者チェック。
 *
 * @returns 問題なければ null、エラー種別があればその値
 */
export async function checkConversationOwnership(
  userId: string,
  conversationId: string,
): Promise<ConversationAccessError | null> {
  const conversation = await findConversationOwner(conversationId);
  if (!conversation) return 'not_found';
  if (conversation.userId !== userId) return 'forbidden';
  return null;
}
