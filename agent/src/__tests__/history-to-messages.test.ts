import { describe, expect, it } from 'vitest';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { expandHistoryToLangChainMessages } from '../core/history-to-messages.js';

describe('expandHistoryToLangChainMessages', () => {
  it('履歴なしは空配列を返す', () => {
    expect(expandHistoryToLangChainMessages(undefined)).toEqual([]);
    expect(expandHistoryToLangChainMessages([])).toEqual([]);
  });

  it('user / assistant を Human / AI メッセージに変換する', () => {
    const out = expandHistoryToLangChainMessages([
      { role: 'user', content: 'こんにちは' },
      { role: 'assistant', content: 'どうしましたか' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeInstanceOf(HumanMessage);
    expect(out[1]).toBeInstanceOf(AIMessage);
    expect(out[1].content).toBe('どうしましたか');
  });

  it('toolRounds 付きターンを AIMessage(tool_calls) → ToolMessage → AIMessage に展開する', () => {
    const out = expandHistoryToLangChainMessages([
      {
        role: 'assistant',
        content: '最終回答',
        toolRounds: [
          {
            id: 'call_1',
            name: 'discover_agents',
            args: { category: 'travel' },
            result: '{"success":true}',
          },
        ],
      },
    ]);

    expect(out).toHaveLength(3);
    const [toolCallMsg, toolMsg, finalMsg] = out;

    expect(toolCallMsg).toBeInstanceOf(AIMessage);
    expect((toolCallMsg as AIMessage).tool_calls).toEqual([
      { id: 'call_1', name: 'discover_agents', args: { category: 'travel' }, type: 'tool_call' },
    ]);

    expect(toolMsg).toBeInstanceOf(ToolMessage);
    expect((toolMsg as ToolMessage).tool_call_id).toBe('call_1');
    expect(toolMsg.content).toBe('{"success":true}');

    expect(finalMsg).toBeInstanceOf(AIMessage);
    expect(finalMsg.content).toBe('最終回答');
  });
});
