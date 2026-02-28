/**
 * useAgentStream - Agent Service ストリーミング用フック
 *
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  AgentStreamMessage,
  AgentToolCall,
  StreamEvent,
} from '@/lib/types';

type MetaEvent = { type: 'meta'; data: { conversationId: string } };
type ParsedEvent = StreamEvent | MetaEvent;

export interface UseAgentStreamOptions {
  walletId: string;
  walletAddress: string;
  maxBudget: number;
  agentId?: string;
  conversationId?: string;
  privyUserId?: string;
  initialMessages?: AgentStreamMessage[];
}

export interface UseAgentStreamReturn {
  messages: AgentStreamMessage[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: (content?: string, agentId?: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
  reset: () => void;
  conversationId: string | null;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const { walletId, walletAddress, maxBudget, privyUserId, initialMessages } = options;

  const [messages, setMessages] = useState<AgentStreamMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (content?: string, targetAgentId?: string) => {
      const text = (content ?? input).trim();
      if (!text) return;

      // 既存のストリームを中断
      abort();

      setError(null);
      setInput('');

      const userMessage: AgentStreamMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      const assistantId = generateId();
      const assistantMessage: AgentStreamMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        toolCalls: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const requestBody: Record<string, unknown> = {
          message: text,
          walletId,
          walletAddress,
          maxBudget,
        };
        if (targetAgentId) {
          requestBody.agentId = targetAgentId;
        }
        if (conversationId) {
          requestBody.conversationId = conversationId;
        }
        if (privyUserId) {
          requestBody.privyUserId = privyUserId;
        }

        const response = await fetch('/api/agent/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(
            (errorJson as { error?: string }).error ?? `HTTP ${response.status}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const chunk of lines) {
            if (!chunk.startsWith('data: ')) continue;
            const data = chunk.slice(6).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data) as ParsedEvent;
              if (event.type === 'meta') {
                // サーバーから返された conversationId を保存
                if (event.data.conversationId) {
                  setConversationId(event.data.conversationId);
                }
              } else {
                applyEvent(assistantId, event);
              }
            } catch (parseError) {
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }

        // 残りのバッファを処理
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data) {
            try {
              const event = JSON.parse(data) as ParsedEvent;
              if (event.type === 'meta') {
                if (event.data.conversationId) {
                  setConversationId(event.data.conversationId);
                }
              } else {
                applyEvent(assistantId, event);
              }
            } catch {}
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 中断時はストリーミングフラグだけ解除
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);

        // エラー時はローディングメッセージを削除
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [input, walletId, walletAddress, maxBudget, conversationId, privyUserId, abort],
  );

  /**
   * SSE イベントを受信してアシスタントメッセージを更新
   */
  function applyEvent(assistantId: string, event: StreamEvent) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m;

        switch (event.type) {
          case 'llm_token':
            return { ...m, content: m.content + event.data.token };

          case 'llm_thinking':
            return { ...m, content: event.data.content };

          case 'tool_call': {
            const newToolCall: AgentToolCall = {
              name: event.data.name,
              args: event.data.args,
              status: 'calling',
              step: event.data.step,
            };
            return {
              ...m,
              toolCalls: [...(m.toolCalls ?? []), newToolCall],
            };
          }

          case 'tool_result': {
            const updatedToolCalls = (m.toolCalls ?? []).map((tc) =>
              tc.name === event.data.name && tc.status === 'calling'
                ? { ...tc, result: event.data.result, status: 'completed' as const }
                : tc,
            );
            return { ...m, toolCalls: updatedToolCalls };
          }

          case 'payment':
            return { ...m, payment: event.data };

          case 'final':
            return {
              ...m,
              content: event.data.message,
              executionLog: event.data.executionLog,
              totalCost: event.data.totalCost,
              isStreaming: false,
            };

          case 'error':
            return {
              ...m,
              content: m.content || `Error: ${event.data.error}`,
              executionLog: event.data.executionLog,
              isStreaming: false,
            };

          case 'start':
          case 'step':
            // step イベントは executionLog と重複するため final で一括取得
            return m;

          default:
            return m;
        }
      }),
    );
  }

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setInput('');
    setError(null);
    setConversationId(null);
  }, [abort]);

  return useMemo(
    () => ({
      messages,
      input,
      setInput,
      sendMessage,
      abort,
      isStreaming,
      error,
      clearError,
      reset,
      conversationId,
    }),
    [messages, input, sendMessage, abort, isStreaming, error, clearError, reset, conversationId],
  );
}
