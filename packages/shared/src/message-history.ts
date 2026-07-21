/**
 * @module message-history
 * DB 会話メッセージ行と Agent Service 向け履歴形式の変換（純関数）。
 */

import { isToolRoundsArray, type AgentMessageHistoryEntry } from './types.js';

export type ConversationMessageRow = {
  role: string;
  content: string;
  toolRounds: unknown;
};

/** DB の会話メッセージ行を Agent Service へ渡す履歴形式に変換する */
export function toAgentMessageHistory(
  messages: ConversationMessageRow[],
): AgentMessageHistoryEntry[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && isToolRoundsArray(m.toolRounds)) {
      return { role: 'assistant' as const, content: m.content, toolRounds: m.toolRounds };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });
}
