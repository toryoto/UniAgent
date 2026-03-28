import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPRequestContext,
  type RouteConfig,
} from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import type { AgentRegistry } from '../agents/types.js';

const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

function slugFromContext(context: HTTPRequestContext): string {
  const p = context.path.replace(/^\/+/, '');
  return p.split('/')[0] ?? '';
}

/**
 * web の hotel / flight ルートと同じ構成（HTTPFacilitator + exact EVM + x402HTTPResourceServer）。
 * エージェントごとの価格は DynamicPrice で slug から解決する。
 */
export function createX402HttpServer(registry: AgentRegistry): x402HTTPResourceServer {
  const receiver =
    (process.env.AGENT_RECEIVER_ADDRESS as `0x${string}` | undefined) ||
    ('0x25b61126EED206F6470533C073DDC3B4157bb6d1' as const);

  const facilitatorUrl = process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL;
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const server = new x402ResourceServer(facilitatorClient);
  registerExactEvmScheme(server);

  const routeConfig: RouteConfig = {
    accepts: {
      scheme: 'exact',
      network: 'eip155:84532',
      payTo: receiver,
      price: async (context: HTTPRequestContext) => {
        const slug = slugFromContext(context);
        const agent = registry[slug];
        if (!agent) {
          throw new Error(`Unknown agent slug: ${slug}`);
        }
        return agent.price;
      },
    },
    description: 'A2A agent execution (x402)',
    mimeType: 'application/json',
  };

  return new x402HTTPResourceServer(server, { 'POST /*': routeConfig });
}
