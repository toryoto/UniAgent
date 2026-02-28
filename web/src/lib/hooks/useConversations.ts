import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';
import { authFetch } from '@/lib/auth/authFetch';

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface ConversationsResponse {
  conversations: Conversation[];
}

const QUERY_KEY = ['conversations'] as const;

export function useConversations() {
  const { user, getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const isAuthenticated = !!user;

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await authFetch('/api/conversations', getAccessToken);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data: ConversationsResponse = await res.json();
      return data.conversations;
    },
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await authFetch(
        `/api/conversations/${conversationId}`,
        getAccessToken,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to delete conversation');
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Conversation[]>(QUERY_KEY);
      queryClient.setQueryData<Conversation[]>(QUERY_KEY, (old) =>
        old?.filter((c) => c.id !== conversationId),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    [queryClient],
  );

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    deleteConversation: deleteMutation.mutate,
    invalidate,
  };
}
