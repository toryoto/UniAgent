import { notFound } from 'next/navigation';
import { findConversationWithMessages } from '@/lib/db/conversations';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ChatView } from '@/components/chat/ChatView';
import type { AgentStreamMessage } from '@/lib/types';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const conversation = await findConversationWithMessages(conversationId);

  if (!conversation) notFound();

  const initialMessages: AgentStreamMessage[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: m.createdAt,
    totalCost: m.totalCost ? Number(m.totalCost) : undefined,
  }));

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
