import type { Request, Response, NextFunction } from 'express';
import type { AgentRegistry } from '../agents/types.js';

const RECEIVER_ADDRESS = process.env.AGENT_RECEIVER_ADDRESS || '0x25b61126EED206F6470533C073DDC3B4157bb6d1';

/**
 * Express middleware that enforces x402 payment for agent POST endpoints.
 *
 * - X402_DISABLED=true  → skip payment (dev mode)
 * - Otherwise → require X-Payment header and return 402 with payment info if missing
 *
 * Full x402 verification (signature + facilitator) is handled by the
 * production gateway or can be added via @x402/core when deploying.
 * This middleware focuses on the 402 handshake (returning accepts info).
 */
export function createX402Middleware(registry: AgentRegistry) {
  const isDisabled = process.env.X402_DISABLED === 'true';

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    const slug = req.params.slug as string;
    if (!slug) {
      next();
      return;
    }
    const agent = registry[slug];
    if (!agent) {
      next();
      return;
    }

    if (isDisabled) {
      next();
      return;
    }

    const paymentHeader = req.headers['x-payment'] as string | undefined;
    if (!paymentHeader) {
      res.status(402).json({
        error: 'Payment Required',
        accepts: [
          {
            scheme: 'exact',
            price: agent.price,
            network: 'eip155:84532',
            payTo: RECEIVER_ADDRESS,
          },
        ],
        description: `${agent.name} - ${agent.description}`,
        mimeType: 'application/json',
      });
      return;
    }

    // When X-Payment header is present, proceed to the handler.
    // In production, add @x402/core server verification here.
    next();
  };
}
