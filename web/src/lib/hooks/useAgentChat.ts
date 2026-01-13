/**
 * useAgentChat - Agent Service用チャットフック
 *
 * /api/agent エンドポイントを呼び出し、エージェントの実行結果を取得する
 *
 * このカスタムフックはLangChainを使用したAgent endpoint実行用
 */

import { useCallback, useMemo, useState } from 'react';
import type { AgentResponse, ExecutionLogEntry } from '@agent-marketplace/shared';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  executionLog?: ExecutionLogEntry[];
  totalCost?: number;
}

export interface UseAgentChatOptions {
  walletId: string;
  walletAddress: string;
  maxBudget: number;
  agentId?: string;
}

export interface UseAgentChatReturn {
  messages: AgentChatMessage[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: (content?: string, agentId?: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  reset: () => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { walletId, walletAddress, maxBudget } = options;

  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content?: string, targetAgentId?: string) => {
      const text = (content ?? input).trim();
      if (!text) return;

      setError(null);
      setInput('');

      // ユーザーメッセージを追加
      const userMessage: AgentChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // ローディング用のアシスタントメッセージを追加
      const assistantId = generateId();
      const loadingMessage: AgentChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, loadingMessage]);

      setIsLoading(true);

      try {
        // Prepare structured message
        const requestBody: Record<string, unknown> = {
          message: text,
          walletId,
          walletAddress,
          maxBudget,
        };

        if (targetAgentId) {
          requestBody.agentId = targetAgentId;
        }

        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(errorJson.error ?? `HTTP ${response.status}`);
        }

        const result: AgentResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error ?? 'Agent execution failed');
        }

        // アシスタントメッセージを更新
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: result.message,
                  executionLog: result.executionLog,
                  totalCost: result.totalCost,
                }
              : m
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);

        // エラー時はローディングメッセージを削除
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
      }
    },
    [input, walletId, walletAddress, maxBudget]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setInput('');
    setError(null);
    setIsLoading(false);
  }, []);

  return useMemo(
    () => ({
      messages,
      input,
      setInput,
      sendMessage,
      isLoading,
      error,
      clearError,
      reset,
    }),
    [messages, input, sendMessage, isLoading, error, clearError, reset]
  );
}
