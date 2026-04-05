import { AssistantTurnCollector, createSseEventBuffer } from '@/lib/agent/assistant-turn-collector';
import { touchConversation } from '@/lib/db/conversations';
import { createMessage } from '@/lib/db/messages';
import type { Prisma } from '@/lib/db/prisma';

export type AgentSsePersistenceOptions = {
  persistAssistantToConversationId: string | null;
  /** 先頭に `meta` の conversationId を流す（stream API のみ） */
  metaConversationId?: string | null;
  logPrefix: string;
};

/**
 * Agent Service からの SSE をそのまま通しつつ、final 後にアシスタントターンを DB に保存する。
 */
export function createAgentSsePersistenceTransform(
  options: AgentSsePersistenceOptions,
): TransformStream<Uint8Array, Uint8Array> {
  const { persistAssistantToConversationId, metaConversationId, logPrefix } = options;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let assistantContent = '';
  let totalCost = 0;
  const sseBuffer = createSseEventBuffer();
  const turnCollector = new AssistantTurnCollector();

  const applyParsedEvent = (event: { type?: string; data?: Record<string, unknown> }) => {
    if (typeof event.type === 'string') {
      turnCollector.applyEvent(event);
    }
    if (event.type === 'final' && event.data?.message) {
      assistantContent = String(event.data.message);
      totalCost = Number(event.data.totalCost) || 0;
    }
  };

  return new TransformStream({
    start(controller) {
      if (metaConversationId) {
        const metaEvent = JSON.stringify({
          type: 'meta',
          data: { conversationId: metaConversationId },
        });
        controller.enqueue(encoder.encode(`data: ${metaEvent}\n\n`));
      }
    },
    transform(chunk, controller) {
      controller.enqueue(chunk);

      const text = decoder.decode(chunk, { stream: true });
      for (const raw of sseBuffer.push(text)) {
        applyParsedEvent(raw as { type?: string; data?: Record<string, unknown> });
      }
    },
    async flush() {
      for (const raw of sseBuffer.flushTail()) {
        applyParsedEvent(raw as { type?: string; data?: Record<string, unknown> });
      }

      if (persistAssistantToConversationId && assistantContent) {
        try {
          const toolRounds = turnCollector.buildToolRounds();
          await createMessage({
            conversationId: persistAssistantToConversationId,
            role: 'assistant',
            content: assistantContent,
            ...(toolRounds != null
              ? { toolRounds: toolRounds as unknown as Prisma.InputJsonValue }
              : {}),
            totalCost: totalCost > 0 ? totalCost : null,
          });
          await touchConversation(persistAssistantToConversationId);
        } catch (err) {
          console.error(`${logPrefix} Failed to save assistant message:`, err);
        }
      }
    },
  });
}
