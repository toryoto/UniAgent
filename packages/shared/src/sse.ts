/**
 * @module sse
 * agent → web の SSE (Server-Sent Events) フレーミングの encode / decode。
 * `StreamEvent`（types.ts）の契約と対で使い、agent 側の書き込みと
 * web 側（プロキシ Route / ブラウザ）の読み取りを同一実装に揃える。
 */

/** SSE ストリーミングレスポンスの共通 HTTP ヘッダー（agent server / web プロキシ） */
export const SSE_RESPONSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

/**
 * JSON payload（StreamEvent 等）を SSE の `data:` フレーム 1 件に変換する。
 */
export function encodeSseEvent(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * チャンク境界をまたぐ SSE ストリームから `data: {...}` イベントを取り出すバッファ。
 * JSON として parse できないフレーム（コメント行・keep-alive 等）は黙って捨てる。
 */
export interface SseEventBuffer {
  /** 受信チャンクを追加し、完結したイベントの JSON を返す */
  push(chunk: string): Array<Record<string, unknown>>;
  /** ストリーム終端で `\n\n` 区切りが来ていない末尾イベントを回収する */
  flushTail(): Array<Record<string, unknown>>;
}

/** SSE フレーム 1 ブロックから `data:` 行の JSON を parse する（失敗時 null） */
function parseSseBlock(block: string): Record<string, unknown> | null {
  const dataLine = block.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) return null;
  const json = dataLine.replace(/^data:\s*/, '').trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createSseEventBuffer(): SseEventBuffer {
  let buf = '';
  return {
    push(chunk: string): Array<Record<string, unknown>> {
      buf += chunk;
      const events: Array<Record<string, unknown>> = [];
      // イベントは空行（\n\n）区切り。完結したブロックだけを取り出す。
      while (true) {
        const idx = buf.indexOf('\n\n');
        if (idx === -1) break;
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const parsed = parseSseBlock(block);
        if (parsed) events.push(parsed);
      }
      return events;
    },
    flushTail(): Array<Record<string, unknown>> {
      const tail = buf.trim();
      buf = '';
      if (!tail) return [];
      const parsed = parseSseBlock(tail);
      return parsed ? [parsed] : [];
    },
  };
}
