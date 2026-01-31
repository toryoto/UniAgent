/**
 * Agent Service - Express Server
 *
 * UniAgent のエージェントサービスを提供するHTTPサーバー
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { AgentRequest, AgentResponse } from '@agent-marketplace/shared';
import { runAgent } from '../core/agent.js';
import { runAgentStream, type StreamEvent } from '../core/agent-streaming.js';
import { logger, logSeparator } from '../utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.http.info(`${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agent' });
});

/**
 * Agent execution endpoint
 *
 * POST /api/agent
 * Body: { message: string, walletId: string, walletAddress: string, maxBudget: number }
 */
app.post('/api/agent', async (req, res) => {
  try {
    const { message, walletId, walletAddress, maxBudget, agentId } = req.body as AgentRequest;

    // Validation
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      });
      return;
    }

    if (!walletId || typeof walletId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'walletId is required and must be a string',
      });
      return;
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({
        success: false,
        error: 'walletAddress is required and must be a string',
      });
      return;
    }

    if (typeof maxBudget !== 'number' || maxBudget <= 0) {
      res.status(400).json({
        success: false,
        error: 'maxBudget must be a positive number',
      });
      return;
    }

    // Run agent
    const result: AgentResponse = await runAgent({
      message,
      walletId,
      walletAddress,
      maxBudget,
      agentId,
    });

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Request failed', { error: errorMessage });

    res.status(500).json({
      success: false,
      message: '',
      executionLog: [],
      totalCost: 0,
      error: errorMessage,
    });
  }
});

/**
 * Agent execution endpoint (Streaming)
 *
 * POST /api/agent/stream
 * Body: { message: string, walletId: string, walletAddress: string, maxBudget: number }
 * Response: Server-Sent Events (SSE) stream
 */
app.post('/api/agent/stream', async (req, res) => {
  try {
    const { message, walletId, walletAddress, maxBudget, agentId } = req.body as AgentRequest;

    // Validation
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      });
      return;
    }

    if (!walletId || typeof walletId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'walletId is required and must be a string',
      });
      return;
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.status(400).json({
        success: false,
        error: 'walletAddress is required and must be a string',
      });
      return;
    }

    if (typeof maxBudget !== 'number' || maxBudget <= 0) {
      res.status(400).json({
        success: false,
        error: 'maxBudget must be a positive number',
      });
      return;
    }

    // SSEヘッダーを設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginxのバッファリングを無効化

    // クライアント切断時の処理
    req.on('close', () => {
      logger.http.info('Client disconnected from stream');
    });

    // ストリーミング実行
    const stream = runAgentStream({
      message,
      walletId,
      walletAddress,
      maxBudget,
      agentId,
    });

    for await (const event of stream) {
      // SSE形式でイベントを送信
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);

      // バッファをフラッシュ
      if ('flush' in res && typeof res.flush === 'function') {
        res.flush();
      }
    }

    // ストリーム終了
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Streaming request failed', { error: errorMessage });

    // エラーイベントを送信（まだレスポンスが開始されていない場合）
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: '',
        executionLog: [],
        totalCost: 0,
        error: errorMessage,
      });
    } else {
      // ストリーム中にエラーが発生した場合
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logSeparator('UniAgent Agent Service');
  logger.agent.success(`Server running on http://0.0.0.0:${PORT}`);
  logger.agent.info('Endpoints:');
  console.log('  - GET  /health            Health check');
  console.log('  - POST /api/agent         Execute agent');
  console.log('  - POST /api/agent/stream  Execute agent (SSE streaming)');
  logSeparator();
});
