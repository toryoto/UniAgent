import { describe, expect, it } from 'vitest';
import { getThreadCost, setThreadCost } from '../core/thread-cost-store.js';

describe('thread-cost-store', () => {
  it('未登録の thread は 0 を返す', () => {
    expect(getThreadCost('unknown-thread')).toBe(0);
  });

  it('記録したコストを thread 単位で取得できる', () => {
    setThreadCost('thread-a', 0.25);
    setThreadCost('thread-b', 0.5);
    expect(getThreadCost('thread-a')).toBe(0.25);
    expect(getThreadCost('thread-b')).toBe(0.5);

    // 上書き（resume 完了後の累積更新）
    setThreadCost('thread-a', 0.75);
    expect(getThreadCost('thread-a')).toBe(0.75);
  });
});
