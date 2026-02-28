/**
 * Agent Stream API Route
 *
 * Agent ServiceへのSSEプロキシエンドポイント
 * リアルタイムでエージェントの実行状況を取得してフロントに流す
 * + 会話履歴のロード・保存
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/stream
 *
 * Body: {
 *   message: string, walletId: string, walletAddress: string, maxBudget: number,
 *   agentId?: string, conversationId?: string, privyUserId?: string
 * }
 * Response: Server-Sent Events (with conversationId injected in start event)
 */
export async function POST(request: NextRequest) {
  console.log('[Agent Stream API] Request received');

  try {
    const body = await request.json();
    const { message, walletId, walletAddress, maxBudget, agentId, conversationId, privyUserId } = body;

    if (!message || !walletId || !walletAddress || typeof maxBudget !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 会話の解決: 既存 or 新規作成
    let resolvedConversationId: string | null = conversationId || null;
    let messageHistory: Array<{ role: string; content: string }> = [];

    if (privyUserId) {
      const user = await prisma.user.findUnique({
        where: { privyUserId },
        select: { id: true },
      });

      if (user) {
        if (resolvedConversationId) {
          // 既存会話: メッセージ履歴をロード
          const conversation = await prisma.conversation.findUnique({
            where: { id: resolvedConversationId },
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                select: { role: true, content: true },
              },
            },
          });
          if (conversation) {
            messageHistory = conversation.messages.map(m => ({
              role: m.role,
              content: m.content,
            }));
          }
        } else {
          // 新規会話を作成
          const title = message.length > 50 ? message.slice(0, 50) + '...' : message;
          const conversation = await prisma.conversation.create({
            data: { userId: user.id, title },
          });
          resolvedConversationId = conversation.id;
        }

        // ユーザーメッセージをDBに保存
        if (resolvedConversationId) {
          await prisma.message.create({
            data: {
              conversationId: resolvedConversationId,
              role: 'user',
              content: message,
            },
          });
        }
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
      maxBudget,
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

    const transformStream = new TransformStream({
      start(controller) {
        // 最初に conversationId を含む meta イベントを送信
        if (resolvedConversationId) {
          const metaEvent = JSON.stringify({
            type: 'meta',
            data: { conversationId: resolvedConversationId },
          });
          controller.enqueue(encoder.encode(`data: ${metaEvent}\n\n`));
        }
      },
      transform(chunk, controller) {
        // チャンクをそのまま転送
        controller.enqueue(chunk);

        // アシスタントの最終レスポンスを収集
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
        // ストリーム完了後にアシスタントメッセージをDBに保存
        if (resolvedConversationId && assistantContent) {
          try {
            await prisma.message.create({
              data: {
                conversationId: resolvedConversationId,
                role: 'assistant',
                content: assistantContent,
                totalCost: totalCost > 0 ? totalCost : null,
              },
            });
            // 会話のupdatedAtを更新
            await prisma.conversation.update({
              where: { id: resolvedConversationId },
              data: { updatedAt: new Date() },
            });
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
