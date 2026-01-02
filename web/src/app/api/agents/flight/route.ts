import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import type { Address } from 'viem';
import { flightAgent, type FlightSearchResult } from '@/lib/agents/flight';
import type { AgentJsonRpcRouteResponse } from '@/lib/x402/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = async (
  req: NextRequest
): Promise<NextResponse<AgentJsonRpcRouteResponse<FlightSearchResult>>> => {
  try {
    const body = await req.json();
    const params = body.params || {};
    const result = flightAgent.generateMockResponse(params);

    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result,
    });
  } catch (error) {
    console.error('Flight agent error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal Server Error',
        },
      },
      { status: 500 }
    );
  }
};

const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator',
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

export const POST = withX402(
  handler,
  {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.01',
        network: 'eip155:84532',
        payTo: flightAgent.receiverAddress as Address,
      },
    ],
    description: 'Flight search with x402 payment',
    mimeType: 'application/json',
  },
  server
);
