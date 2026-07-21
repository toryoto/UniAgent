/**
 * @module lib/agent/sse-client
 * ブラウザ側の Agent SSE ストリーム読み取り（shared の createSseEventBuffer を使用）。
 */

import { createSseEventBuffer } from '@agent-marketplace/shared';
import type { StreamEvent } from '@agent-marketplace/shared';

/** web プロキシが注入する会話 ID メタイベント */
export type MetaStreamEvent = { type: 'meta'; data: { conversationId: string } };

export type ParsedAgentStreamEvent = StreamEvent | MetaStreamEvent;

export type ReadAgentSseCallbacks = {
  onEvent: (event: ParsedAgentStreamEvent) => void;
};

/**
 * Response の SSE ボディを読み取り、イベントごとにコールバックを呼ぶ。
 *
 * @returns interrupt イベントを受信したら true
 */
export async function readAgentSseStream(
  response: Response,
  callbacks: ReadAgentSseCallbacks,
): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  const buffer = createSseEventBuffer();
  let interrupted = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const raw of buffer.push(text)) {
      const event = raw as ParsedAgentStreamEvent;
      callbacks.onEvent(event);
      if ('type' in event && event.type === 'interrupt') {
        interrupted = true;
      }
    }
  }

  for (const raw of buffer.flushTail()) {
    const event = raw as ParsedAgentStreamEvent;
    callbacks.onEvent(event);
    if ('type' in event && event.type === 'interrupt') {
      interrupted = true;
    }
  }

  return interrupted;
}
