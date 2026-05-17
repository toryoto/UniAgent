import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

  try {
    const response = await handleA2ARequest(body);
    res.json({
      jsonrpc: '2.0',
      id: response.id,
      ...(response.result ? { result: response.result } : {}),
      ...(response.error ? { error: response.error } : {}),
    });
  } catch (err) {
    console.error('[hotel-agent] Unhandled error:', err);
    res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Internal Server Error' },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Hotel Search Agent running on port ${PORT}`);
  console.log(`  A2A endpoint:   http://localhost:${PORT}/hotel-agent`);
  console.log(`  Agent card:     http://localhost:${PORT}/hotel-agent/.well-known/agent.json`);
  console.log(`  Hotelbeds URL:  ${process.env.HOTELBEDS_BASE_URL ?? 'https://api.test.hotelbeds.com'}`);
});
