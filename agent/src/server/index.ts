/**
 * @module server
 * Agent Service の Express HTTP サーバー入口。
 * 責務は「入力検証 → core 呼び出し → SSE 応答」のみで、
 * 実行ロジックは core/、SSE イベント契約は packages/shared に従う。
 */

import 'dotenv/config';
import express, { type Response } from 'express';
import cors from 'cors';
import { encodeSseEvent, SSE_RESPONSE_HEADERS, type StreamEvent } from '@agent-marketplace/shared';
import { bindLogContext, createLogger, runWithLogContext } from '@agent-marketplace/shared/logger';
import { runAgentStream, resumeAgentStream } from '../core/index.js';
import { agentStreamRequestSchema, agentResumeRequestSchema } from './schemas.js';

const log = createLogger('agent');
const httpLog = createLogger('http');

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json());

/**
 * x-request-id は上流（web プロキシ）との相関用。信用しない入力なので
 * 形式検証を通ったものだけ採用し、それ以外は新規発行する。
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function resolveRequestId(incoming: string | undefined): string {
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
}

/**
 * リクエストごとに requestId をログコンテキストに載せる。
 * これ以降（SSE ストリーミング中を含む）の全ログに requestId が自動付与され、
 * web から x-request-id が渡された場合は web 側のログと相関できる。
 */
app.use((req, res, next) => {
  const requestId = resolveRequestId(req.header('x-request-id'));
  runWithLogContext({ requestId }, () => {
    const startedAt = Date.now();
    // ヘルスチェックはログノイズになるため記録しない
    if (req.path !== '/health') {
      httpLog.info({ method: req.method, path: req.path }, 'request received');
      res.on('finish', () => {
        httpLog.info(
          { method: req.method, path: req.path, statusCode: res.statusCode, durationMs: Date.now() - startedAt },
          'request completed',
        );
      });
    }
    next();
  });
});

// ── Routes ────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agent' });
});

/**
 * POST /api/agent/stream
 * エージェント実行を SSE でストリーミングする。
 */
app.post('/api/agent/stream', async (req, res) => {
  beginSseResponse(res);

  const parsed = agentStreamRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    endSseWithError(res, parsed.error.issues[0]?.message ?? 'Invalid request body');
    return;
  }

  // web の会話とログを相関させる（threadId は runAgentStream 側でバインドされる）
  if (parsed.data.conversationId) bindLogContext({ conversationId: parsed.data.conversationId });

  try {
    await pipeStreamToSse(res, runAgentStream(parsed.data));
  } catch (error) {
    log.error({ err: error }, 'Streaming request failed');
    endSseWithError(res, error instanceof Error ? error.message : 'Unknown error');
  }
});

/**
 * POST /api/agent/resume
 * HITL の承認 / 編集 / 拒否後に、中断されたエージェント実行を再開する。
 */
app.post('/api/agent/resume', async (req, res) => {
  beginSseResponse(res);

  const parsed = agentResumeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    endSseWithError(res, parsed.error.issues[0]?.message ?? 'Invalid request body');
    return;
  }

  const { threadId, decisions, autoApproveThreshold, conversationId } = parsed.data;
  if (conversationId) bindLogContext({ conversationId });

  try {
    await pipeStreamToSse(
      res,
      resumeAgentStream(threadId, { decisions }, autoApproveThreshold),
    );
  } catch (error) {
    log.error({ err: error }, 'Resume request failed');
    endSseWithError(res, error instanceof Error ? error.message : 'Unknown error');
  }
});

// ── Private: SSE helpers ──────────────────────────────────────────────────

function beginSseResponse(res: Response): void {
  res.setHeader('Content-Type', SSE_RESPONSE_HEADERS['Content-Type']);
  res.setHeader('Cache-Control', SSE_RESPONSE_HEADERS['Cache-Control']);
  res.setHeader('Connection', SSE_RESPONSE_HEADERS.Connection);
  res.setHeader('X-Accel-Buffering', SSE_RESPONSE_HEADERS['X-Accel-Buffering']);
  res.flushHeaders();
}

/** StreamEvent（shared 契約）を SSE フレームとして書き込む */
function writeSseEvent(res: Response, event: StreamEvent): void {
  res.write(encodeSseEvent(event));
}

/** core のイベントストリームを SSE として送り切る（クライアント切断で中断） */
async function pipeStreamToSse(
  res: Response,
  stream: AsyncGenerator<StreamEvent>,
): Promise<void> {
  for await (const event of stream) {
    writeSseEvent(res, event);
    if (res.closed) break;
  }
  res.end();
}

function endSseWithError(res: Response, error: string): void {
  writeSseEvent(res, { type: 'error', data: { error } });
  res.end();
}

// ── Startup ───────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  log.info(
    { port: PORT, endpoints: ['GET /health', 'POST /api/agent/stream', 'POST /api/agent/resume'] },
    `Agent Service running on http://0.0.0.0:${PORT}`,
  );
});
