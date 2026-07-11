/**
 * @module lib/api/with-api-logging
 * Next.js API Route 向けの HTTP ログアダプター。
 * requestId 解決とアクセスログ本体は @agent-marketplace/shared/logger に委譲する。
 */

import { NextRequest } from 'next/server';
import {
  logHttpRequestCompleted,
  logHttpRequestFailed,
  logHttpRequestReceived,
  resolveRequestId,
  runWithLogContext,
} from '@agent-marketplace/shared/logger';

export type ApiLoggingOptions = {
  /** ログに載せるパス。省略時は request.nextUrl.pathname */
  path?: string;
};

/**
 * API Route ハンドラを requestId 付きログコンテキストで実行し、
 * HTTP アクセスログ（received / completed）を記録する。
 */
export async function withApiLogging(
  request: NextRequest,
  handler: () => Promise<Response>,
  options?: ApiLoggingOptions,
): Promise<Response> {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));
  const meta = { method: request.method, path: options?.path ?? request.nextUrl.pathname };

  return runWithLogContext({ requestId }, async () => {
    const startedAt = Date.now();
    logHttpRequestReceived(meta);

    try {
      const response = await handler();
      logHttpRequestCompleted({
        ...meta,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      logHttpRequestFailed({ ...meta, err: error, durationMs: Date.now() - startedAt });
      throw error;
    }
  });
}
