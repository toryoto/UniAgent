import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loadAgentRegistry } from './agents/registry.js';
import { createAgentRoutes } from './routes/agent-endpoint.js';
import { createWellKnownRoutes } from './routes/wellknown.js';
import { createOpenApiRoutes } from './routes/openapi.js';
import { createX402Middleware } from './middleware/x402.js';
import { getPublicBaseUrl } from './lib/public-base-url.js';

const PORT = parseInt(process.env.PORT || '3003', 10);

async function main() {
  const registry = loadAgentRegistry();
  const slugs = Object.keys(registry);

  console.log(`Loaded ${slugs.length} agents: ${slugs.join(', ')}`);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agents: slugs.length });
  });

  app.get('/', (req, res) => {
    const baseUrl = getPublicBaseUrl(req);
    res.json({
      name: 'A2A Agents Server',
      agents: slugs.length,
      endpoints: slugs.map((slug) => {
        const agent = registry[slug];
        return {
          slug,
          name: agent.name,
          qualityLevel: agent.qualityLevel,
          responseFormat: agent.responseFormat,
          requestFormat: agent.requestFormat,
          price: agent.price,
          urls: {
            execute: `${baseUrl}/${slug}`,
            agentJson: `${baseUrl}/${slug}/.well-known/agent.json`,
            openapi: `${baseUrl}/${slug}/openapi.json`,
          },
        };
      }),
    });
  });

  app.use(createWellKnownRoutes(registry));
  app.use(createOpenApiRoutes(registry));

  const x402 = createX402Middleware(registry);
  app.use('/:slug', x402);

  app.use(createAgentRoutes(registry));

  app.listen(PORT, () => {
    console.log(`A2A Agents Server running on http://localhost:${PORT}`);
    console.log(`Serving ${slugs.length} hotel agents`);
    if (process.env.X402_DISABLED === 'true') {
      console.log('x402 payment verification is DISABLED (dev mode)');
    }
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
