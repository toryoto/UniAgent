/**
 * @module lib/agent/agent-service-client
 * Agent Service (Express, port 3002) への SSE プロキシ用 HTTP クライアント。
 * Route からの直接 fetch を禁止し、接続設定をここに集約する。
 */

import { SSE_RESPONSE_HEADERS as SHARED_SSE_HEADERS } from '@agent-marketplace/shared';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

/** クライアントへ SSE を返すときの共通レスポンスヘッダー */
export const SSE_RESPONSE_HEADERS = SHARED_SSE_HEADERS;

/**
 * Agent Service の SSE エンドポイントに POST し、ストリーミングレスポンスを返す。
 *
 * @param path - `/api/agent/stream` または `/api/agent/resume`
 * @param body - Agent Service へ転送するリクエストボディ
 */
export async function postAgentServiceSse(
  path: '/api/agent/stream' | '/api/agent/resume',
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${AGENT_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    // @ts-expect-error -- Node.js undici option to disable response buffering
    duplex: 'half',
  });
}
