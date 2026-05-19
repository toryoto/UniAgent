import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLogger } from '@agent-marketplace/shared/logger';
import { handleA2ARequest } from './a2a-handler.js';
import { buildAgentCard, buildOpenApiSpec } from './wellknown.js';
import { createHotelX402HttpServer, createX402Middleware, settleX402IfNeeded } from './x402.js';

const log = createLogger('hotel-agent');
const PORT = parseInt(process.env.PORT ?? '3004', 10);

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agent: 'hotel-agent', port: PORT });
  });

  app.get('/hotel-agent/.well-known/agent.json', (req, res) => {
    res.json(buildAgentCard(req));
  });

  app.get('/hotel-agent/openapi.json', (req, res) => {
    res.json(buildOpenApiSpec(req));
  });

  const x402HttpServer = await createHotelX402HttpServer();
  if (process.env.X402_DISABLED !== 'true') {
    try {
      await x402HttpServer.initialize();
    } catch (err) {
      log.error('x402 initialize failed', { error: err instanceof Error ? err.message : String(err) });
      process.exit(1);
    }
  }

  app.use('/hotel-agent', createX402Middleware(x402HttpServer));

  app.post('/hotel-agent', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const id = (body.id ?? null) as string | number | null;
    const method = body.method ?? '(none)';
    const start = Date.now();

    log.info(`request`, { id, method });

    try {
      const response = await handleA2ARequest(body);
      const ms = Date.now() - start;

      if (response.error) {
        log.warn(`response error`, { id, code: response.error.code, msg: response.error.message, ms });
        res.json({
          jsonrpc: '2.0',
          id: response.id,
          error: response.error,
        });
        return;
      }

      if (!(await settleX402IfNeeded(req, res, id))) {
        return;
      }

      const parts = response.result?.parts ?? [];
      const hasData = parts.some((p) => p.kind === 'data');
      log.success(`response ok`, { id, parts: parts.length, hasData, ms });

      res.json({
        jsonrpc: '2.0',
        id: response.id,
        result: response.result,
      });
    } catch (err) {
      const ms = Date.now() - start;
      log.error(`unhandled error`, { id, ms, error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: 'Internal Server Error' },
      });
    }
  });

  app.listen(PORT, () => {
    log.success(`Hotel Search Agent running on port ${PORT}`, {
      a2aEndpoint: `http://localhost:${PORT}/hotel-agent`,
      agentCard: `http://localhost:${PORT}/hotel-agent/.well-known/agent.json`,
      x402: process.env.X402_DISABLED === 'true' ? 'disabled' : 'enabled ($0.15 USDC)',
    });
    if (process.env.X402_DISABLED === 'true') {
      log.warn('x402 payment verification is DISABLED (dev mode)');
    }
  });
}

main().catch((err) => {
  log.error('Failed to start server', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
