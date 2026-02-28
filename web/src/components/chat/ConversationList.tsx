'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ConversationList() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = usePrivy();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const privyUserId = user?.id;

  const fetchConversations = useCallback(async () => {
    if (!privyUserId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/conversations?privyUserId=${encodeURIComponent(privyUserId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [privyUserId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // pathname が変わったらリストを更新（新規会話作成後など）
  useEffect(() => {
    if (pathname?.startsWith('/chat')) {
      fetchConversations();
    }
  }, [pathname, fetchConversations]);

  const handleNewChat = () => {
    router.push('/chat');
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      // 削除した会話を表示中の場合は新規チャットに遷移
      if (pathname === `/chat/${conversationId}`) {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const activeConversationId = pathname?.startsWith('/chat/')
    ? pathname.replace('/chat/', '')
    : null;

  return (
    <div className="flex h-full flex-col border-r border-slate-800 bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
        <h3 className="text-sm font-medium text-slate-300">Chats</h3>
        <button
          onClick={handleNewChat}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-slate-500">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-0.5 p-1.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/chat/${conv.id}`)}
                className={cn(
                  'group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  activeConversationId === conv.id
                    ? 'bg-purple-600/20 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                )}
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {conv.title || 'New Chat'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
