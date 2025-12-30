/**
 * Hotel Agent API Route
 *
 * POST /api/agents/hotel - ホテル検索（x402決済対応）
 *
 * Coinbase x402 SDK を使用した標準実装
 */

import { NextRequest, NextResponse } from 'next/server';
import { withX402, type RouteConfig } from 'x402-next';
import { facilitator } from '@coinbase/x402';
import type { Address } from 'viem';
import { hotelAgent } from '@/lib/agents/hotel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ホテル検索ハンドラー
 * x402決済はwithX402ミドルウェアが処理
 */
const handler = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const params = body.params || {};

    // モックレスポンス生成
    const result = hotelAgent.generateMockResponse(params);

    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result,
    });
  } catch (error) {
    console.error('Hotel agent error:', error);
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

/**
 * x402決済でラップされたPOSTハンドラー
 * - 決済なしのリクエスト → 402 Payment Required
 * - 有効な決済付きリクエスト → ハンドラー実行
 */
export const POST = withX402(
  handler,
  hotelAgent.receiverAddress as Address,
  hotelAgent.getX402Config() as RouteConfig,
  facilitator
);
