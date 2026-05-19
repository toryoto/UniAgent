import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('hotel-agent');
import { handleA2ARequest } from './a2a-handler.js';
import { buildAgentCard, buildOpenApiSpec } from './wellknown.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3004', 10);

app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'hotel-agent', port: PORT });
});

// .well-known/agent.json — A2A agent card
app.get('/hotel-agent/.well-known/agent.json', (req, res) => {
  res.json(buildAgentCard(req));
});

// OpenAPI spec
app.get('/hotel-agent/openapi.json', (req, res) => {
  res.json(buildOpenApiSpec(req));
});

// A2A endpoint — accepts JSON-RPC 2.0 message/send
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
    } else {
      const parts = response.result?.parts ?? [];
      const hasData = parts.some((p) => p.kind === 'data');
      log.success(`response ok`, { id, parts: parts.length, hasData, ms });
    }

    res.json({
      jsonrpc: '2.0',
      id: response.id,
      ...(response.result ? { result: response.result } : {}),
      ...(response.error ? { error: response.error } : {}),
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
    hotelbedsUrl: process.env.HOTELBEDS_BASE_URL ?? 'https://api.test.hotelbeds.com',
  });
});
