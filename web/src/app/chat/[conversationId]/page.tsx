import { notFound } from 'next/navigation';
import { findConversationWithMessages } from '@/lib/db/conversations';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ChatView } from '@/components/chat/ChatView';
import { isToolRoundsArray } from '@agent-marketplace/shared';
import type { AgentStreamMessage, AgentToolCall } from '@/lib/types';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const conversation = await findConversationWithMessages(conversationId);

  if (!conversation) notFound();

  const initialMessages: AgentStreamMessage[] = conversation.messages.map((m) => {
    let toolCalls: AgentToolCall[] | undefined;
    if (m.role === 'assistant' && isToolRoundsArray(m.toolRounds)) {
      toolCalls = m.toolRounds.map((r, i) => ({
        toolCallId: r.id,
        name: r.name,
        args: r.args,
        result: r.result,
        status: 'completed' as const,
        step: i + 1,
      }));
    }
    return {
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.createdAt,
      totalCost: m.totalCost ? Number(m.totalCost) : undefined,
      ...(toolCalls ? { toolCalls } : {}),
    };
  });

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col">
          <ChatView
            key={conversationId}
            conversationId={conversationId}
            initialMessages={initialMessages}
          />
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
