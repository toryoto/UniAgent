import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLogger } from '@agent-marketplace/shared/logger';
import { handleA2ARequest } from './a2a-handler.js';
import { buildAgentCard, buildOpenApiSpec } from './wellknown.js';
import { createFlightX402HttpServer, createX402Middleware, settleX402IfNeeded } from './x402.js';

const log = createLogger('flight-agent');
const PORT = parseInt(process.env.PORT ?? '3005', 10);

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agent: 'flight-agent', port: PORT });
  });

  app.get('/flight-agent/.well-known/agent.json', (req, res) => {
    res.json(buildAgentCard(req));
  });

  app.get('/flight-agent/openapi.json', (req, res) => {
    res.json(buildOpenApiSpec(req));
  });

  const x402HttpServer = await createFlightX402HttpServer();
  if (process.env.X402_DISABLED !== 'true') {
    try {
      await x402HttpServer.initialize();
    } catch (err) {
      log.error({ err }, 'x402 initialize failed');
      process.exit(1);
    }
  }

  app.use('/flight-agent', createX402Middleware(x402HttpServer));

  app.post('/flight-agent', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const id = (body.id ?? null) as string | number | null;
    const method = body.method ?? '(none)';
    const start = Date.now();

    log.info({ id, method }, 'request');

    try {
      const response = await handleA2ARequest(body);
      const ms = Date.now() - start;

      if (response.error) {
        log.warn({ id, code: response.error.code, message: response.error.message, ms }, 'response error');
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
      log.info({ id, parts: parts.length, hasData, ms }, 'response ok');

      res.json({
        jsonrpc: '2.0',
        id: response.id,
        result: response.result,
      });
    } catch (err) {
      const ms = Date.now() - start;
      log.error({ err, id, ms }, 'unhandled error');
      res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: 'Internal Server Error' },
      });
    }
  });

  app.listen(PORT, () => {
    log.info(
      {
        a2aEndpoint: `http://localhost:${PORT}/flight-agent`,
        agentCard: `http://localhost:${PORT}/flight-agent/.well-known/agent.json`,
        x402: process.env.X402_DISABLED === 'true' ? 'disabled' : 'enabled ($0.15 USDC)',
      },
      `Flight Search Agent running on port ${PORT}`,
    );
    if (process.env.X402_DISABLED === 'true') {
      log.warn('x402 payment verification is DISABLED (dev mode)');
    }
  });
}

main().catch((err) => {
  log.error({ err }, 'Failed to start server');
  process.exit(1);
});
