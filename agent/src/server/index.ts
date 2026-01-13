/**
 * Agent Service - Express Server
 *
 * UniAgent のエージェントサービスを提供するHTTPサーバー
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { AgentRequest, AgentResponse } from '@agent-marketplace/shared';
import { runAgent, runAgentStream } from '../core/agent.js';
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
 * SSE Streaming endpoint
 *
 * POST /api/agent/stream
 * リアルタイムでエージェントの実行状況をストリーミング
 */
app.post('/api/agent/stream', async (req, res) => {
  // SSEヘッダー設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginxバッファリングを無効化

  try {
    const { message, walletId, walletAddress, maxBudget } = req.body as AgentRequest;

    // Validation
    if (!message || typeof message !== 'string') {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'message is required' })}\n\n`);
      res.end();
      return;
    }

    if (!walletId || typeof walletId !== 'string') {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'walletId is required' })}\n\n`);
      res.end();
      return;
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: 'walletAddress is required' })}\n\n`
      );
      res.end();
      return;
    }

    if (typeof maxBudget !== 'number' || maxBudget <= 0) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: 'maxBudget must be a positive number' })}\n\n`
      );
      res.end();
      return;
    }

    // ストリーミング実行
    const stream = runAgentStream({ message, walletId, walletAddress, maxBudget });

    for await (const event of stream) {
      const data = JSON.stringify(event);
      res.write(`data: ${data}\n\n`);

      // クライアントが切断した場合の処理
      if (res.closed) {
        break;
      }
    }

    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Streaming request failed', { error: errorMessage });
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    res.end();
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logSeparator('UniAgent Agent Service');
  logger.agent.success(`Server running on http://0.0.0.0:${PORT}`);
  logger.agent.info('Endpoints:');
  console.log('  - GET  /health       Health check');
  console.log('  - POST /api/agent    Execute agent');
  console.log('  - POST /api/agent/stream   Execute agent (SSE)');
  logSeparator();
});
