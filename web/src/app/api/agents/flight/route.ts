/**
 * Flight Agent API Route
 *
 * POST /api/agents/flight - フライト検索（x402決済対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { flightAgent } from '@/lib/agents/flight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentHeader = req.headers.get('x-payment');

    const response = await flightAgent.handleRequest({
      body,
      headers: { 'x-payment': paymentHeader || undefined },
    });

    const nextResponse = NextResponse.json(response.body, {
      status: response.status,
    });

    // X-PAYMENT-RESPONSEヘッダーを設定
    if (response.headers?.['X-PAYMENT-RESPONSE']) {
      nextResponse.headers.set('X-PAYMENT-RESPONSE', response.headers['X-PAYMENT-RESPONSE']);
    }

    return nextResponse;
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
}
