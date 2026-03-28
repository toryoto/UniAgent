import { Router } from 'express';
import type { AgentRegistry } from '../agents/types.js';
import { parseRequest } from '../request/parser.js';
import { generateResponse } from '../response/generator.js';
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
      const query = parseRequest(body, agent.requestFormat);
      const { result, error } = await generateResponse(agent, query);

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
      console.error(`Error in agent ${agent.slug}:`, err);
      res.status(500).json({
        jsonrpc: '2.0',
        id: (req.body as Record<string, unknown>).id ?? null,
        error: { code: -32603, message: 'Internal Server Error' },
      });
    }
  });

  return router;
}
