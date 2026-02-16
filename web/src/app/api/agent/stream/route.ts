/**
 * Agent Stream API Route
 *
 * Agent ServiceへのSSEプロキシエンドポイント
 * リアルタイムでエージェントの実行状況を取得してフロントに流す
 */

import { NextRequest } from 'next/server';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/stream
 *
 * Body: { message: string, walletId: string, walletAddress: string, maxBudget: number, agentId?: string }
 * - agentId: /use-agent コマンドで指定された場合はエージェントID（discover_agents で検索）
 * Response: Server-Sent Events
 */
export async function POST(request: NextRequest) {
  console.log('[Agent Stream API] Request received');

  try {
    const body = await request.json();
    const { message, walletId, walletAddress, maxBudget, agentId } = body;

    if (!message || !walletId || !walletAddress || typeof maxBudget !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Agent Stream API] Forwarding to Agent Service (stream)', agentId ? { agentId } : {});

    // Forward to Agent Service（agentId は /use-agent コマンドで指定された場合に含まれる）
    const requestBody: Record<string, unknown> = {
      message,
      walletId,
      walletAddress,
      maxBudget,
    };
    if (agentId && typeof agentId === 'string') {
      requestBody.agentId = agentId;
    }

    const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      // @ts-expect-error -- Node.js undici option to disable response buffering
      duplex: 'half',
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error('[Agent Stream API] Agent Service error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Agent Service error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Agent Stream API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
