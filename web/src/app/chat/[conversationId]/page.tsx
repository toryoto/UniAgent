'use client';

import { use } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ChatView } from '@/components/chat/ChatView';
import { ConversationList } from '@/components/chat/ConversationList';

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-screen bg-slate-950">
          {/* Conversation List Sidebar */}
          <div className="hidden w-64 shrink-0 md:block">
            <ConversationList />
          </div>

          {/* Chat Area */}
          <div className="flex min-w-0 flex-1 flex-col">
            <ChatView key={conversationId} conversationId={conversationId} />
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
