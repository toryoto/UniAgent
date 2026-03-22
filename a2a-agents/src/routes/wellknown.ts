import { Router } from 'express';
import { CONTRACT_ADDRESSES } from '@agent-marketplace/shared/config';
import type { AgentRegistry } from '../agents/types.js';

const BASE_SEPOLIA_NETWORK_ID = 'eip155:84532';

export function createWellKnownRoutes(registry: AgentRegistry): Router {
  const router = Router();

  router.get('/:slug/.well-known/agent.json', (req, res) => {
    const agent = registry[req.params.slug];
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const receiverAddress = process.env.AGENT_RECEIVER_ADDRESS || '0x25b61126EED206F6470533C073DDC3B4157bb6d1';

    res.json({
      name: agent.name,
      description: agent.description,
      version: '1.0.0',
      category: agent.category,
      endpoints: [
        {
          url: `${baseUrl}/${agent.slug}`,
          spec: `${baseUrl}/${agent.slug}/openapi.json`,
        },
      ],
      skills: agent.skills,
      payment: {
        tokenAddress: CONTRACT_ADDRESSES.USDC,
        receiverAddress,
        pricePerCall: agent.pricePerCall,
        price: agent.price,
        network: 'base-sepolia',
        chain: BASE_SEPOLIA_NETWORK_ID,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
    });
  });

  return router;
}
