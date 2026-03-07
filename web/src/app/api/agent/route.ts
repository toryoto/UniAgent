/**
 * Agent API Route
 *
 * Agent Serviceへのプロキシエンドポイント
 * Next.jsからAgent Serviceにリクエストを転送
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { getBudgetSettings } from '@/lib/db/getBudgetSettings';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent
 *
 * Body: { message: string, walletId: string, walletAddress: string, agentId?: string }
 */
export async function POST(request: NextRequest) {
  console.log('[Agent API] Request received');

  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, walletId, walletAddress, agentId } = body;

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

    const budgetSettings = await getBudgetSettings(auth.privyUserId);
    if (!budgetSettings) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const { autoApproveThreshold } = budgetSettings;

    console.log('[Agent API] Forwarding to Agent Service', {
      message,
      walletId,
      walletAddress,
      autoApproveThreshold,
      agentId,
    });

    // Forward to Agent Service
    const response = await fetch(`${AGENT_SERVICE_URL}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, walletId, walletAddress, autoApproveThreshold, agentId }),
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
