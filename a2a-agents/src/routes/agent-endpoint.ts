import { Router } from 'express';
import { createLogger } from '@agent-marketplace/shared/logger';
import type { AgentRegistry } from '../agents/types.js';

const log = createLogger('a2a-agents');
import { parseRequest } from '../request/parser.js';
import { generateResponse } from '../response/generator.js';
import { parseFlightRequest } from '../request/flight-parser.js';
import { generateFlightResponse } from '../response/flight-generator.js';
import { settleX402IfNeeded } from '../middleware/x402.js';

export function createAgentRoutes(registry: AgentRegistry): Router {
  const router = Router();

  router.post('/:slug', async (req, res) => {
    const agent = registry[req.params.slug];
    if (!agent) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Agent not found' },
      });
      return;
    }

    try {
      const body = req.body as Record<string, unknown>;
      const isFlight = agent.agentType === 'flight';
      const query = isFlight ? parseFlightRequest(body, agent.requestFormat) : parseRequest(body, agent.requestFormat);
      const { result, error } = isFlight
        ? await generateFlightResponse(agent, query as ReturnType<typeof parseFlightRequest>)
        : await generateResponse(agent, query as ReturnType<typeof parseRequest>);

      if (error) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: body.id ?? null,
          error,
        });
        return;
      }

      const id = (body.id ?? null) as string | number | null;
      if (!(await settleX402IfNeeded(req, res, id))) {
        return;
      }

      res.json({
        jsonrpc: '2.0',
        id,
        result,
      });
    } catch (err) {
      log.error(`Error in agent ${agent.slug}`, { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({
        jsonrpc: '2.0',
        id: (req.body as Record<string, unknown>).id ?? null,
        error: { code: -32603, message: 'Internal Server Error' },
      });
    }
  });

  return router;
}
