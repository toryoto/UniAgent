import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
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

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, totalCost: true, createdAt: true },
      },
    },
  });

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
