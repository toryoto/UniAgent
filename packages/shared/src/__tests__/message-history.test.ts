import { describe, expect, it } from 'vitest';
import { toAgentMessageHistory } from '../message-history.js';

describe('toAgentMessageHistory', () => {
  it('converts user and plain assistant messages', () => {
    const result = toAgentMessageHistory([
      { role: 'user', content: 'hello', toolRounds: null },
      { role: 'assistant', content: 'hi', toolRounds: null },
    ]);
    expect(result).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
  });

  it('preserves valid assistant toolRounds', () => {
    const toolRounds = [
      { id: 'c1', name: 'discover_agents', args: { q: 'hotel' }, result: '{}' },
    ];
    const result = toAgentMessageHistory([
      { role: 'assistant', content: 'done', toolRounds },
    ]);
    expect(result).toEqual([{ role: 'assistant', content: 'done', toolRounds }]);
  });

  it('drops invalid toolRounds on assistant messages', () => {
    const result = toAgentMessageHistory([
      { role: 'assistant', content: 'done', toolRounds: 'not-an-array' },
    ]);
    expect(result).toEqual([{ role: 'assistant', content: 'done' }]);
  });
});
