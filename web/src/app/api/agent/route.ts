/**
 * Agent API Route
 *
 * Agent Serviceへのプロキシエンドポイント
 * Next.jsからAgent Serviceにリクエストを転送
 */

import { NextRequest, NextResponse } from 'next/server';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent
 *
 * Body: { message: string, walletId: string, walletAddress: string, maxBudget: number }
 */
export async function POST(request: NextRequest) {
  console.log('[Agent API] Request received');

  try {
    const body = await request.json();

    const { message, walletId, walletAddress, maxBudget, agentId } = body;

    // Validation
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
    }

    if (!walletId || typeof walletId !== 'string') {
      return NextResponse.json({ success: false, error: 'walletId is required' }, { status: 400 });
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (typeof maxBudget !== 'number' || maxBudget <= 0) {
      return NextResponse.json(
        { success: false, error: 'maxBudget must be a positive number' },
        { status: 400 }
      );
    }

    console.log('[Agent API] Forwarding to Agent Service', {
      message,
      walletId,
      walletAddress,
      maxBudget,
      agentId,
    });

    // Forward to Agent Service
    const response = await fetch(`${AGENT_SERVICE_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, walletId, walletAddress, maxBudget, agentId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Agent API] Agent Service error:', errorText);
      return NextResponse.json(
        { success: false, error: `Agent Service error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[Agent API] Response received', { success: result.success });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Agent API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
