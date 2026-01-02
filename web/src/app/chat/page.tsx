'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Send, Loader2, Bot, User, AlertCircle, Wrench, DollarSign, Shield } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { useAgentChat, type AgentChatMessage } from '@/lib/hooks/useAgentChat';
import { useDelegatedWallet } from '@/lib/hooks/useDelegatedWallet';
import type { ExecutionLogEntry } from '@agent-marketplace/shared';
import Link from 'next/link';

// デフォルトの最大予算 (USDC)
const DEFAULT_MAX_BUDGET = 5.0;

export default function ChatPage() {
  const { wallet, isLoading: isWalletLoading } = useDelegatedWallet();
  const [maxBudget, setMaxBudget] = useState(DEFAULT_MAX_BUDGET);

  // Privy embedded walletからwalletIdとwalletAddressを取得
  // delegated walletの場合のみサーバー側で署名可能
  const walletId = wallet?.walletId || '';
  const walletAddress = wallet?.address || '';

  const { messages, input, setInput, sendMessage, isLoading, error, clearError } = useAgentChat({
    walletId,
    walletAddress,
    maxBudget,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 新しいメッセージが来たら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 送信後に入力欄にフォーカス
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // textareaの高さを自動調整
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ウォレット未接続またはdelegateされていない場合の警告
  const walletWarning = !walletAddress ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/30 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-400" />
      <div className="flex-1">
        <p className="text-sm text-yellow-200">
          ウォレットが接続されていません。決済機能を使用するにはウォレットを接続してください。
        </p>
      </div>
    </div>
  ) : !wallet?.isDelegated ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/30 p-4">
      <Shield className="mt-0.5 h-5 w-5 text-yellow-400" />
      <div className="flex-1">
        <p className="text-sm text-yellow-200">
          ウォレットがサーバーに委譲されていません。x402決済を使用するには{' '}
          <Link href="/wallet" className="font-medium underline hover:text-yellow-100">
            Walletページ
          </Link>{' '}
          でウォレットを委譲してください。
        </p>
      </div>
    </div>
  ) : null;

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-screen flex-col bg-slate-950">
          {/* Header */}
          <div className="border-b border-slate-800 bg-slate-900/50 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">AI Agent Chat</h1>
                <p className="text-sm text-slate-400">
                  LangChain.js エージェントがタスクを実行します
                </p>
              </div>
              {/* 予算設定 */}
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-sm text-slate-400">Max Budget:</span>
                <input
                  type="number"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  min={0.01}
                  step={0.01}
                  className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white"
                />
                <span className="text-sm text-slate-400">USDC</span>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-4xl">
              {/* Wallet Warning */}
              {walletWarning}

              {/* Welcome Message (メッセージがない場合のみ表示) */}
              {messages.length === 0 && <WelcomeMessage />}

              {/* Messages */}
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {/* Loading indicator */}
                {isLoading && messages.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>エージェント実行中...</span>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm text-red-200">{error}</p>
                    <button
                      onClick={clearError}
                      className="mt-2 text-xs text-red-400 hover:text-red-300"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-800 bg-slate-900/50 p-6">
            <div className="mx-auto max-w-4xl">
              <div className="flex gap-4">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="タスクを入力してください..."
                  disabled={isLoading}
                  rows={1}
                  className="scrollbar-hide flex-1 resize-none overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                  style={{ minHeight: '48px', maxHeight: '100px' }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  className="self-start rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Enter で送信、Shift+Enter で改行</p>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}

function WelcomeMessage() {
  return (
    <div className="mb-8 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
      <h2 className="mb-2 text-lg font-bold text-purple-300">Welcome to UniAgent3!</h2>
      <p className="mb-3 text-purple-200/80">
        LangChain.jsエージェントがマーケットプレイス上の外部エージェントを発見・実行します：
      </p>
      <ul className="space-y-2 text-sm text-purple-200/70">
        <li>1. discover_agents でエージェントを検索</li>
        <li>2. 価格・評価を考慮して最適なエージェントを選択</li>
        <li>3. x402決済付きでエージェントを実行</li>
        <li>4. 結果を統合してお届け</li>
      </ul>
      <p className="mt-4 text-xs text-purple-300/60">
        例: 「travelカテゴリのエージェントを検索して」「パリ3日間の旅行プランを作成して」
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl rounded-2xl px-6 py-4 ${
          isUser ? 'bg-purple-600 text-white' : 'border border-slate-800 bg-slate-900/50'
        }`}
      >
        {/* Role indicator */}
        <div
          className={`mb-2 flex items-center gap-2 text-sm font-medium ${
            isUser ? 'text-purple-200' : 'text-purple-400'
          }`}
        >
          {isUser ? (
            <>
              <User className="h-4 w-4" />
              You
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              AI Agent
            </>
          )}
        </div>

        {/* Content */}
        <div className={`whitespace-pre-wrap ${isUser ? 'text-white' : 'text-slate-300'}`}>
          {message.content || <span className="text-slate-500 italic">実行中...</span>}
        </div>

        {/* Execution Log (アシスタントメッセージのみ) */}
        {!isUser && message.executionLog && message.executionLog.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-700 pt-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Wrench className="h-3 w-3" />
              実行ログ
            </div>
            {message.executionLog.map((entry, index) => (
              <ExecutionLogCard key={index} entry={entry} />
            ))}
          </div>
        )}

        {/* Total Cost */}
        {!isUser && message.totalCost !== undefined && message.totalCost > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3 text-sm">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-slate-400">Total Cost:</span>
            <span className="font-mono text-green-400">${message.totalCost.toFixed(4)} USDC</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionLogCard({ entry }: { entry: ExecutionLogEntry }) {
  const typeColors = {
    llm: 'bg-purple-500',
    logic: 'bg-blue-500',
    payment: 'bg-green-500',
    error: 'bg-red-500',
  };

  const typeLabels = {
    llm: 'LLM',
    logic: 'Logic',
    payment: 'Payment',
    error: 'Error',
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${typeColors[entry.type]}`} />
        <span className="font-mono text-slate-500">[Step {entry.step}]</span>
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
          {typeLabels[entry.type]}
        </span>
        <span className="text-slate-300">{entry.action}</span>
      </div>
      {entry.details && Object.keys(entry.details).length > 0 && (
        <pre className="mt-2 overflow-x-auto text-slate-400">
          {JSON.stringify(entry.details, null, 2)}
        </pre>
      )}
    </div>
  );
}
