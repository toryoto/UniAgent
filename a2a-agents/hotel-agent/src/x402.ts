import type { Request, Response, NextFunction } from 'express';
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type RouteConfig,
  type HTTPProcessResult,
  type HTTPResponseInstructions,
} from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('x402');

const PRICE = '$0.15';
const DEFAULT_RECEIVER = '0x25b61126EED206F6470533C073DDC3B4157bb6d1' as const;
const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';
const RESOURCE_PATH = '/hotel-agent';

type X402RequestContext = {
  httpServer: x402HTTPResourceServer;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  declaredExtensions?: Record<string, unknown>;
};

declare module 'express-serve-static-core' {
  interface Request {
    x402?: X402RequestContext;
  }
}

function isLocalHost(host: string): boolean {
  const h = host.split(':')[0].toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

class ExpressHttpAdapter {
  constructor(private readonly req: Request) {}

  getHeader(name: string): string | undefined {
    const v = this.req.headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  }

  getMethod(): string { return this.req.method; }
  getPath(): string { return RESOURCE_PATH; }

  getUrl(): string {
    const host = this.req.get('host') ?? `localhost:${process.env.PORT ?? '3004'}`;
    const proto = isLocalHost(host) ? 'http' : 'https';
    return `${proto}://${host}${RESOURCE_PATH}`;
  }

  getAcceptHeader(): string { return this.req.get('accept') ?? ''; }
  getUserAgent(): string { return this.req.get('user-agent') ?? ''; }
  getBody(): unknown { return this.req.body; }
}

function sendPaymentInstructions(res: Response, instructions: HTTPResponseInstructions): void {
  for (const [key, value] of Object.entries(instructions.headers)) {
    res.setHeader(key, value);
  }
  const { status, body } = instructions;
  if (instructions.isHtml) {
    res.status(status).send(typeof body === 'string' ? body : String(body ?? ''));
    return;
  }
  res.status(status).json(body ?? {});
}

export async function createHotelX402HttpServer(): Promise<x402HTTPResourceServer> {
  const receiver = (process.env.AGENT_RECEIVER_ADDRESS as `0x${string}` | undefined) ?? DEFAULT_RECEIVER;
  const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL;

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const server = new x402ResourceServer(facilitatorClient);
  registerExactEvmScheme(server);

  const routeConfig: RouteConfig = {
    accepts: {
      scheme: 'exact',
      network: 'eip155:84532',
      payTo: receiver,
      price: PRICE,
    },
    description: 'Hotel Search Agent execution (x402)',
    mimeType: 'application/json',
  };

  return new x402HTTPResourceServer(server, { 'POST /*': routeConfig });
}

export function createX402Middleware(httpServer: x402HTTPResourceServer) {
  const disabled = process.env.X402_DISABLED === 'true';

  return (req: Request, res: Response, next: NextFunction): void => {
    if (disabled || req.method !== 'POST') {
      next();
      return;
    }

    void (async () => {
      try {
        const adapter = new ExpressHttpAdapter(req);
        const context = {
          adapter,
          path: RESOURCE_PATH,
          method: req.method,
          paymentHeader: adapter.getHeader('payment-signature') ?? adapter.getHeader('x-payment'),
        };

        const result: HTTPProcessResult = await httpServer.processHTTPRequest(context, undefined);

        switch (result.type) {
          case 'no-payment-required':
            next();
            return;
          case 'payment-error':
            sendPaymentInstructions(res, result.response);
            return;
          case 'payment-verified':
            req.x402 = {
              httpServer,
              paymentPayload: result.paymentPayload,
              paymentRequirements: result.paymentRequirements,
              declaredExtensions: result.declaredExtensions,
            };
            next();
            return;
        }
      } catch (err) {
        log.error({ err }, 'processHTTPRequest failed');
        next(err);
      }
    })();
  };
}

export async function settleX402IfNeeded(
  req: Request,
  res: Response,
  jsonRpcId: string | number | null,
): Promise<boolean> {
  const ctx = req.x402;
  if (!ctx) return true;

  let result;
  try {
    result = await ctx.httpServer.processSettlement(
      ctx.paymentPayload,
      ctx.paymentRequirements,
      ctx.declaredExtensions,
    );
  } catch (err) {
    log.error({ err }, 'processSettlement failed');
    res.status(500).json({
      jsonrpc: '2.0',
      id: jsonRpcId,
      error: { code: -32603, message: err instanceof Error ? err.message : 'Settlement error' },
    });
    return false;
  }

  if (!result.success) {
    res.status(402).json({
      jsonrpc: '2.0',
      id: jsonRpcId,
      error: { code: -32603, message: result.errorMessage ?? result.errorReason ?? 'Settlement failed' },
    });
    return false;
  }

  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }
  return true;
}
