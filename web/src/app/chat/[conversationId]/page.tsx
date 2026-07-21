'use client';

import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { isToolRoundsArray } from '@agent-marketplace/shared';
import { authFetch } from '@/lib/auth/authFetch';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ChatView } from '@/components/chat/ChatView';
import type { AgentStreamMessage, AgentToolCall } from '@/lib/types';

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col">
          {conversationId ? (
            <ConversationChatLoader conversationId={conversationId} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          )}
        </div>
      </AuthGuard>
    </AppLayout>
  );
}

function ConversationChatLoader({ conversationId }: { conversationId: string }) {
  const { getAccessToken } = usePrivy();

  const { data, isLoading, error } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const res = await authFetch(`/api/conversations/${conversationId}`, getAccessToken);
      if (res.status === 404) return { notFound: true as const };
      if (res.status === 403) return { forbidden: true as const };
      if (!res.ok) throw new Error('Failed to load conversation');
      return res.json() as Promise<{
        conversation: {
          id: string;
          messages: Array<{
            id: string;
            role: string;
            content: string;
            toolRounds: unknown;
            totalCost: string | null;
            createdAt: string;
          }>;
        };
      }>;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !data || 'notFound' in data || 'forbidden' in data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-400">
        {data && 'forbidden' in data
          ? 'You do not have access to this conversation.'
          : 'Conversation not found.'}
      </div>
    );
  }

  const initialMessages: AgentStreamMessage[] = data.conversation.messages.map((m) => {
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
      timestamp: new Date(m.createdAt),
      totalCost: m.totalCost ? Number(m.totalCost) : undefined,
      ...(toolCalls ? { toolCalls } : {}),
    };
  });

  return (
    <ChatView
      key={conversationId}
      conversationId={conversationId}
      initialMessages={initialMessages}
    />
  );
}
