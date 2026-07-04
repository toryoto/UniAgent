/**
 * useAgentStream - Agent Service ストリーミング用フック
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { AgentStreamMessage } from '@/lib/types';
import type { HITLDecision, StreamEvent } from '@agent-marketplace/shared';
import { authFetch } from '@/lib/auth/authFetch';
import { applyStreamEventToMessage } from '@/lib/agent/apply-stream-event';
import { readAgentSseStream } from '@/lib/agent/sse-client';

export interface UseAgentStreamOptions {
  walletId: string;
  walletAddress: string;
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
  const { walletId, walletAddress, getAccessToken, initialMessages } = options;

  const [messages, setMessages] = useState<AgentStreamMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const pendingApprovalRef = useRef<{ threadId: string } | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsWaitingApproval(false);
  }, []);

  const applyEvent = useCallback((assistantId: string, event: StreamEvent) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m;
        const { message, threadId } = applyStreamEventToMessage(m, event);
        if (threadId) {
          pendingApprovalRef.current = { threadId };
        }
        if (event.type === 'error') {
          setError(event.data.error);
        }
        return message;
      }),
    );
  }, []);

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
        };
        if (targetAgentId) requestBody.agentId = targetAgentId;
        if (conversationId) requestBody.conversationId = conversationId;

        const response = await authFetch('/api/agent/stream', getAccessToken, {
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

        const interrupted = await readAgentSseStream(response, {
          onEvent: (event) => {
            if (event.type === 'meta') {
              if (event.data.conversationId) setConversationId(event.data.conversationId);
              return;
            }
            applyEvent(assistantId, event);
          },
        });

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
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [input, walletId, walletAddress, conversationId, getAccessToken, abort, applyEvent],
  );

  const resumeAgent = useCallback(
    async (decisions: HITLDecision[]) => {
      const assistantId = currentAssistantIdRef.current;
      if (!assistantId) return;

      const threadId = pendingApprovalRef.current?.threadId ?? null;
      if (!threadId) {
        setError('No pending approval to resume');
        return;
      }

      pendingApprovalRef.current = null;
      setIsWaitingApproval(false);
      setIsStreaming(true);
      setError(null);

      const isRejected = decisions.every((d) => d.type === 'reject');
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;

          let updatedToolCalls = m.toolCalls ?? [];
          const callingIndices = updatedToolCalls
            .map((tc, idx) => (tc.status === 'calling' ? idx : -1))
            .filter((idx) => idx !== -1);

          for (let i = 0; i < Math.min(decisions.length, callingIndices.length); i++) {
            const decision = decisions[i];
            const tcIdx = callingIndices[i];
            if (decision.type === 'edit' && decision.editedAction) {
              updatedToolCalls = updatedToolCalls.map((tc, j) =>
                j === tcIdx ? { ...tc, args: decision.editedAction.args } : tc,
              );
            }
          }

          if (isRejected) {
            updatedToolCalls = updatedToolCalls.map((tc) =>
              tc.status === 'calling'
                ? { ...tc, status: 'completed' as const, result: 'Rejected by user' }
                : tc,
            );
          }

          return {
            ...m,
            isStreaming: !isRejected,
            toolCalls: updatedToolCalls,
            approval: m.approval ? { ...m.approval, resolved: true } : undefined,
          };
        }),
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const requestBody: Record<string, unknown> = { threadId, decisions };
        if (conversationId) requestBody.conversationId = conversationId;

        const response = await authFetch('/api/agent/resume', getAccessToken, {
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

        const interrupted = await readAgentSseStream(response, {
          onEvent: (event) => {
            if (event.type === 'meta') return;
            applyEvent(assistantId, event);
          },
        });

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
    [conversationId, getAccessToken, applyEvent],
  );

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setInput('');
    setError(null);
    setConversationId(null);
    currentAssistantIdRef.current = null;
    pendingApprovalRef.current = null;
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
    [
      messages,
      input,
      sendMessage,
      resumeAgent,
      abort,
      isStreaming,
      isWaitingApproval,
      error,
      clearError,
      reset,
      conversationId,
    ],
  );
}
