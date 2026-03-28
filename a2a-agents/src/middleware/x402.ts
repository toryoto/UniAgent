import type { Request, Response, NextFunction } from 'express';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import type { HTTPProcessResult, HTTPResponseInstructions, x402HTTPResourceServer } from '@x402/core/server';
import type { AgentRegistry } from '../agents/types.js';
import { getPublicBaseUrl } from '../lib/public-base-url.js';

/** payment-verified 後に settlement するためのコンテキスト */
export type X402RequestContext = {
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

/**
 * Express 用 HTTPAdapter（@x402/core の processHTTPRequest と同契約）
 */
class ExpressHttpAdapter {
  constructor(private readonly req: Request) {}

  getHeader(name: string): string | undefined {
    const v = this.req.headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0];
    return v;
  }

  getMethod(): string {
    return this.req.method;
  }

  getPath(): string {
    return this.req.path;
  }

  getUrl(): string {
    return `${getPublicBaseUrl(this.req)}${this.req.originalUrl.split(/[?#]/)[0]}`;
  }

  getAcceptHeader(): string {
    return this.req.get('accept') ?? '';
  }

  getUserAgent(): string {
    return this.req.get('user-agent') ?? '';
  }

  getBody(): unknown {
    return this.req.body;
  }
}

function sendPaymentInstructions(res: Response, instructions: HTTPResponseInstructions): void {
  for (const [key, value] of Object.entries(instructions.headers)) {
    res.setHeader(key, value);
  }
  const status = instructions.status;
  const body = instructions.body;
  if (instructions.isHtml) {
    res.status(status).send(typeof body === 'string' ? body : String(body ?? ''));
    return;
  }
  res.status(status).json(body ?? {});
}

/**
 * ハンドラが 200 で返す直前に呼ぶ。web の withX402 → handleSettlement と同じタイミング。
 * @returns false のときは res 送信済み（402 等）
 */
export async function settleX402IfNeeded(
  req: Request,
  res: Response,
  jsonRpcId: string | number | null
): Promise<boolean> {
  const ctx = req.x402;
  if (!ctx) return true;

  const result = await ctx.httpServer.processSettlement(
    ctx.paymentPayload,
    ctx.paymentRequirements,
    ctx.declaredExtensions
  );

  if (!result.success) {
    res.status(402).json({
      jsonrpc: '2.0',
      id: jsonRpcId,
      error: {
        code: -32603,
        message: result.errorMessage ?? result.errorReason ?? 'Settlement failed',
      },
    });
    return false;
  }

  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }
  return true;
}

/**
 * web の withX402 と同等: 402 / 検証 / payment-verified で次ハンドラへ（settlement は成功レスポンス時）
 */
export function createX402Middleware(registry: AgentRegistry, httpServer: x402HTTPResourceServer) {
  const disabled = process.env.X402_DISABLED === 'true';

  return (req: Request, res: Response, next: NextFunction): void => {
    if (disabled) {
      next();
      return;
    }

    if (req.method !== 'POST') {
      next();
      return;
    }

    const slug = req.params.slug as string | undefined;
    if (!slug || !registry[slug]) {
      next();
      return;
    }

    void (async () => {
      try {
        const adapter = new ExpressHttpAdapter(req);
        const context = {
          adapter,
          path: req.path,
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
          case 'payment-verified': {
            req.x402 = {
              httpServer,
              paymentPayload: result.paymentPayload,
              paymentRequirements: result.paymentRequirements,
              declaredExtensions: result.declaredExtensions,
            };
            next();
            return;
          }
        }
      } catch (err) {
        next(err);
      }
    })();
  };
}
