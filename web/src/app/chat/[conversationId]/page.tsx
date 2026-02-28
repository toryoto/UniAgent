'use client';

import { use } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ChatView } from '@/components/chat/ChatView';

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col">
          <ChatView key={conversationId} conversationId={conversationId} />
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
