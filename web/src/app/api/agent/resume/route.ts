/**
 * Agent Resume API Route (HITL)
 *
 * Agent Serviceの/api/agent/resumeへのSSEプロキシ
 * Human-in-the-Loopの承認/編集/拒否後にエージェント実行を再開
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { getBudgetSettings } from '@/lib/db/getBudgetSettings';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/resume
 *
 * Headers: Authorization: Bearer <privy-auth-token>
 * Body: { threadId: string, decisions: HITLDecision[], conversationId?: string }
 * Response: Server-Sent Events
 */
export async function POST(request: NextRequest) {
  console.log('[Agent Resume API] Request received');

  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { threadId, decisions, conversationId } = body;

    if (!threadId || !Array.isArray(decisions)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: threadId and decisions are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // サーバーサイドで autoApproveThreshold を取得（クライアント値は信頼しない）
    const budgetSettings = await getBudgetSettings(auth.privyUserId);
    if (!budgetSettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { autoApproveThreshold } = budgetSettings;

    console.log('[Agent Resume API] Forwarding to Agent Service (resume)', {
      threadId,
      decisionsCount: decisions.length,
      conversationId,
    });

    const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ threadId, decisions, autoApproveThreshold }),
      // @ts-expect-error -- Node.js undici option to disable response buffering
      duplex: 'half',
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error('[Agent Resume API] Agent Service error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Agent Service error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // SSEストリームをインターセプトしてアシスタントメッセージの更新を保存
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let assistantContent = '';
    let totalCost = 0;

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);

        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'final' && event.data?.message) {
              assistantContent = event.data.message;
              totalCost = event.data.totalCost || 0;
            }
          } catch {
            // パース失敗は無視
          }
        }
      },
      async flush() {
        // resume完了後にアシスタントメッセージをDBに保存（conversationIdがある場合のみ）
        if (conversationId && assistantContent) {
          try {
            await prisma.message.create({
              data: {
                conversationId,
                role: 'assistant',
                content: assistantContent,
                totalCost: totalCost > 0 ? totalCost : null,
              },
            });
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });
          } catch (err) {
            console.error('[Agent Resume API] Failed to save assistant message:', err);
          }
        }
      },
    });

    response.body.pipeThrough(transformStream);

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Agent Resume API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
