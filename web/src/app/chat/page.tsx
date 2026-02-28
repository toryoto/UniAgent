'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ChatView } from '@/components/chat/ChatView';

export default function ChatPage() {
  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col">
          <ChatView />
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
