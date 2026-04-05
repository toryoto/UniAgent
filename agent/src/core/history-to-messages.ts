import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { AgentMessageHistoryEntry } from '@agent-marketplace/shared';

/**
 * DB / API の会話履歴を LangChain のメッセージ列に展開する。
 * ツール付きアシスタントターンは: AIMessage(tool_calls) → ToolMessage[] → AIMessage(最終テキスト)
 */
export function expandHistoryToLangChainMessages(
  entries: AgentMessageHistoryEntry[] | undefined,
): BaseMessage[] {
  if (!entries?.length) return [];

  const out: BaseMessage[] = [];

  for (const entry of entries) {
    if (entry.role === 'user') {
      out.push(new HumanMessage(entry.content));
      continue;
    }

    const rounds = entry.toolRounds;
    const hasTools = Array.isArray(rounds) && rounds.length > 0;

    if (hasTools) {
      const tool_calls = rounds.map((r) => ({
        id: r.id,
        name: r.name,
        args: r.args,
        type: 'tool_call' as const,
      }));
      out.push(new AIMessage({ content: '', tool_calls }));

      for (const r of rounds) {
        out.push(
          new ToolMessage({
            content: r.result,
            tool_call_id: r.id,
            name: r.name,
          }),
        );
      }
    }

    out.push(new AIMessage(entry.content));
  }

  return out;
}
