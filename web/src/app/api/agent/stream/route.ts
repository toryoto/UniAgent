/**
 * Agent Stream API Route
 *
 * Agent ServiceへのSSEプロキシエンドポイント
 * リアルタイムでエージェントの実行状況を取得してフロントに流す
 * + 会話履歴のロード・保存
 */

import { NextRequest } from 'next/server';
import { isToolRoundsArray, type AgentMessageHistoryEntry } from '@agent-marketplace/shared';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { getBudgetSettings } from '@/lib/db/budget-settings';
import { findUserIdByPrivyId } from '@/lib/db/users';
import { findConversationHistory, createConversation, touchConversation } from '@/lib/db/conversations';
import { createMessage } from '@/lib/db/messages';
import type { Prisma } from '@/lib/db/prisma';
import { AssistantTurnCollector, createSseEventBuffer } from '@/lib/agent/assistant-turn-collector';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/stream
 *
 * Headers: Authorization: Bearer <privy-auth-token>
 * Body: {
 *   message: string, walletId: string, walletAddress: string,
 *   agentId?: string, conversationId?: string
 * }
 * Response: Server-Sent Events (with conversationId injected in start event)
 */
export async function POST(request: NextRequest) {
  console.log('[Agent Stream API] Request received');

  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { message, walletId, walletAddress, agentId, conversationId } = body;

    if (!message || !walletId || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const budgetSettings = await getBudgetSettings(auth.privyUserId);
    if (!budgetSettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { autoApproveThreshold } = budgetSettings;

    // 会話の解決: 既存 or 新規作成
    let resolvedConversationId: string | null = conversationId || null;
    let messageHistory: AgentMessageHistoryEntry[] = [];

    const userId = await findUserIdByPrivyId(auth.privyUserId);

    if (userId) {
      if (resolvedConversationId) {
        const conversation = await findConversationHistory(resolvedConversationId, userId);
        if (conversation) {
          messageHistory = conversation.messages.map((m) => {
            if (m.role === 'assistant' && isToolRoundsArray(m.toolRounds)) {
              return {
                role: 'assistant' as const,
                content: m.content,
                toolRounds: m.toolRounds,
              };
            }
            return { role: m.role as 'user' | 'assistant', content: m.content };
          });
        }
      } else {
        const title = message.length > 50 ? message.slice(0, 50) + '...' : message;
        const conversation = await createConversation(userId, title);
        resolvedConversationId = conversation.id;
      }

      if (resolvedConversationId) {
        await createMessage({
          conversationId: resolvedConversationId,
          role: 'user',
          content: message,
        });
      }
    }

    console.log('[Agent Stream API] Forwarding to Agent Service (stream)', {
      ...(agentId ? { agentId } : {}),
      conversationId: resolvedConversationId,
      historyLength: messageHistory.length,
    });

    // Forward to Agent Service
    const requestBody: Record<string, unknown> = {
      message,
      walletId,
      walletAddress,
      autoApproveThreshold,
    };
    if (agentId && typeof agentId === 'string') {
      requestBody.agentId = agentId;
    }
    if (messageHistory.length > 0) {
      requestBody.messageHistory = messageHistory;
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

    // SSEストリームをインターセプトして conversationId を注入 & アシスタントメッセージを保存
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let assistantContent = '';
    let totalCost = 0;
    const sseBuffer = createSseEventBuffer();
    const turnCollector = new AssistantTurnCollector();

    const transformStream = new TransformStream({
      start(controller) {
        if (resolvedConversationId) {
          const metaEvent = JSON.stringify({
            type: 'meta',
            data: { conversationId: resolvedConversationId },
          });
          controller.enqueue(encoder.encode(`data: ${metaEvent}\n\n`));
        }
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);

        const text = decoder.decode(chunk, { stream: true });
        for (const raw of sseBuffer.push(text)) {
          const event = raw as { type?: string; data?: Record<string, unknown> };
          if (typeof event.type === 'string') {
            turnCollector.applyEvent(event);
          }
          if (event.type === 'final' && event.data?.message) {
            assistantContent = String(event.data.message);
            totalCost = Number(event.data.totalCost) || 0;
          }
        }
      },
      async flush() {
        for (const raw of sseBuffer.flushTail()) {
          const event = raw as { type?: string; data?: Record<string, unknown> };
          if (typeof event.type === 'string') {
            turnCollector.applyEvent(event);
          }
          if (event.type === 'final' && event.data?.message) {
            assistantContent = String(event.data.message);
            totalCost = Number(event.data.totalCost) || 0;
          }
        }

        if (resolvedConversationId && assistantContent) {
          try {
            const toolRounds = turnCollector.buildToolRounds();
            await createMessage({
              conversationId: resolvedConversationId,
              role: 'assistant',
              content: assistantContent,
              ...(toolRounds != null
                ? { toolRounds: toolRounds as unknown as Prisma.InputJsonValue }
                : {}),
              totalCost: totalCost > 0 ? totalCost : null,
            });
            await touchConversation(resolvedConversationId);
          } catch (err) {
            console.error('[Agent Stream API] Failed to save assistant message:', err);
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
    console.error('[Agent Stream API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
