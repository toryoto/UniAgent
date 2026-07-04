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
import { logger } from '@agent-marketplace/shared/logger';
import { runAgentStream, resumeAgentStream } from '../core/index.js';
import { agentStreamRequestSchema, agentResumeRequestSchema } from './schemas.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  logger.http.info(`${req.method} ${req.path}`);
  next();
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

  try {
    await pipeStreamToSse(res, runAgentStream(parsed.data));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Streaming request failed', { error: errorMessage });
    endSseWithError(res, errorMessage);
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

  const { threadId, decisions, autoApproveThreshold } = parsed.data;

  try {
    await pipeStreamToSse(
      res,
      resumeAgentStream(threadId, { decisions }, autoApproveThreshold),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Resume request failed', { error: errorMessage });
    endSseWithError(res, errorMessage);
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
  logger.separator('UniAgent Agent Service');
  logger.agent.success(`Server running on http://0.0.0.0:${PORT}`);
  logger.agent.info('Endpoints:');
  console.log('  - GET  /health       Health check');
  console.log('  - POST /api/agent/stream   Execute agent (SSE)');
  console.log('  - POST /api/agent/resume   Resume agent (HITL)');
  logger.separator();
});
