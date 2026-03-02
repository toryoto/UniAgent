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
import type { HITLDecision } from '@agent-marketplace/shared';
import { authFetch } from '@/lib/auth/authFetch';

type MetaEvent = { type: 'meta'; data: { conversationId: string } };
type ParsedEvent = StreamEvent | MetaEvent;

export interface UseAgentStreamOptions {
  walletId: string;
  walletAddress: string;
  autoApproveThreshold: number;
  agentId?: string;
  conversationId?: string;
  getAccessToken: () => Promise<string | null>;
  initialMessages?: AgentStreamMessage[];
}

export interface UseAgentStreamReturn {
  messages: AgentStreamMessage[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: (content?: string, agentId?: string) => Promise<void>;
  resumeAgent: (decisions: HITLDecision[]) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  isWaitingApproval: boolean;
  error: string | null;
  clearError: () => void;
  reset: () => void;
  conversationId: string | null;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const { walletId, walletAddress, autoApproveThreshold, getAccessToken, initialMessages } = options;

  const [messages, setMessages] = useState<AgentStreamMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Track which assistant message is currently being streamed (for resume)
  const currentAssistantIdRef = useRef<string | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsWaitingApproval(false);
  }, []);

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

          case 'interrupt':
            return {
              ...m,
              isStreaming: false,
              approval: {
                threadId: event.data.threadId,
                actionRequests: event.data.actionRequests,
                reviewConfigs: event.data.reviewConfigs,
              },
            };

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
            return m;

          default:
            return m;
        }
      }),
    );
  }

  /**
   * SSEストリームを読み取ってapplyEventを適用するヘルパー
   */
  async function readStream(
    response: Response,
    assistantId: string,
  ): Promise<boolean> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let interrupted = false;

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
            if (event.data.conversationId) {
              setConversationId(event.data.conversationId);
            }
          } else {
            applyEvent(assistantId, event);

            if (event.type === 'interrupt') {
              interrupted = true;
            }
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
            if (event.type === 'interrupt') {
              interrupted = true;
            }
          }
        } catch {}
      }
    }

    return interrupted;
  }

  const sendMessage = useCallback(
    async (content?: string, targetAgentId?: string) => {
      const text = (content ?? input).trim();
      if (!text) return;

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

      currentAssistantIdRef.current = assistantId;
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const requestBody: Record<string, unknown> = {
          message: text,
          walletId,
          walletAddress,
          autoApproveThreshold,
        };
        if (targetAgentId) {
          requestBody.agentId = targetAgentId;
        }
        if (conversationId) {
          requestBody.conversationId = conversationId;
        }

        const response = await authFetch(
          '/api/agent/stream',
          getAccessToken,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(
            (errorJson as { error?: string }).error ?? `HTTP ${response.status}`,
          );
        }

        const interrupted = await readStream(response, assistantId);
        if (interrupted) {
          setIsWaitingApproval(true);
          // Don't clear isStreaming in finally — we're waiting for approval
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [input, walletId, walletAddress, autoApproveThreshold, conversationId, getAccessToken, abort],
  );

  /**
   * HITL承認/編集/拒否後にエージェント実行を再開
   */
  const resumeAgent = useCallback(
    async (decisions: HITLDecision[]) => {
      const assistantId = currentAssistantIdRef.current;
      if (!assistantId) return;

      // approval情報からthreadIdを取得（refを使ってステートの最新値にアクセス）
      let threadId: string | null = null;
      // messagesはstateなのでsetMessages内のコールバックで最新値を参照する
      const currentMessages = await new Promise<AgentStreamMessage[]>((resolve) => {
        setMessages((prev) => {
          resolve(prev);
          return prev;
        });
      });

      const msg = currentMessages.find((m) => m.id === assistantId);
      if (msg?.approval) {
        threadId = msg.approval.threadId;
      }

      if (!threadId) {
        setError('No pending approval to resume');
        return;
      }

      setIsWaitingApproval(false);
      setIsStreaming(true);

      // approval を resolved に更新し、ストリーミング再開
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                isStreaming: true,
                approval: m.approval ? { ...m.approval, resolved: true } : undefined,
              }
            : m,
        ),
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const requestBody: Record<string, unknown> = {
          threadId,
          decisions,
          autoApproveThreshold,
        };
        if (conversationId) {
          requestBody.conversationId = conversationId;
        }

        const response = await authFetch(
          '/api/agent/resume',
          getAccessToken,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(
            (errorJson as { error?: string }).error ?? `HTTP ${response.status}`,
          );
        }

        const interrupted = await readStream(response, assistantId);
        if (interrupted) {
          setIsWaitingApproval(true);
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          );
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [autoApproveThreshold, conversationId, getAccessToken],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setInput('');
    setError(null);
    setConversationId(null);
    currentAssistantIdRef.current = null;
  }, [abort]);

  return useMemo(
    () => ({
      messages,
      input,
      setInput,
      sendMessage,
      resumeAgent,
      abort,
      isStreaming,
      isWaitingApproval,
      error,
      clearError,
      reset,
      conversationId,
    }),
    [messages, input, sendMessage, resumeAgent, abort, isStreaming, isWaitingApproval, error, clearError, reset, conversationId],
  );
}
