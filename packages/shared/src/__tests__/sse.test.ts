import { describe, expect, it } from 'vitest';
import { createSseEventBuffer, encodeSseEvent } from '../sse.js';

describe('encodeSseEvent', () => {
  it('StreamEvent を data: フレームに変換する', () => {
    expect(encodeSseEvent({ type: 'start', data: { message: 'hi' } })).toBe(
      'data: {"type":"start","data":{"message":"hi"}}\n\n',
    );
  });
});

describe('createSseEventBuffer', () => {
  it('encode したイベントをそのまま decode できる（ラウンドトリップ）', () => {
    const buffer = createSseEventBuffer();
    const events = [
      { type: 'start', data: { message: 'hello' } },
      { type: 'llm_token', data: { token: 'a', step: 1 } },
      { type: 'final', data: { message: 'done', totalCost: 0.01 } },
    ];
    const wire = events.map(encodeSseEvent).join('');
    expect(buffer.push(wire)).toEqual(events);
  });

  it('チャンク境界をまたぐイベントを組み立てる', () => {
    const buffer = createSseEventBuffer();
    const wire = encodeSseEvent({ type: 'error', data: { error: 'boom' } });
    const mid = Math.floor(wire.length / 2);

    expect(buffer.push(wire.slice(0, mid))).toEqual([]);
    expect(buffer.push(wire.slice(mid))).toEqual([
      { type: 'error', data: { error: 'boom' } },
    ]);
  });

  it('壊れた JSON / data 行なしブロックは無視する', () => {
    const buffer = createSseEventBuffer();
    const wire = 'data: {broken\n\n: keep-alive\n\ndata: {"type":"end"}\n\n';
    expect(buffer.push(wire)).toEqual([{ type: 'end' }]);
  });

  it('flushTail で終端の未区切りイベントを回収する', () => {
    const buffer = createSseEventBuffer();
    buffer.push('data: {"type":"final","data":{"message":"x","totalCost":0}}');
    expect(buffer.flushTail()).toEqual([
      { type: 'final', data: { message: 'x', totalCost: 0 } },
    ]);
    // flush 後は空
    expect(buffer.flushTail()).toEqual([]);
  });
});
