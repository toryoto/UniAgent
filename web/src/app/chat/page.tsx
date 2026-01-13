'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Send, Loader2, Bot, User, AlertCircle, Wrench, DollarSign, Shield } from 'lucide-react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useAgentChat, type AgentChatMessage } from '@/lib/hooks/useAgentChat';
import { useDelegatedWallet } from '@/lib/hooks/useDelegatedWallet';
import { useSlashCommand, type SlashCommandOption } from '@/lib/hooks/useSlashCommand';
import { CommandDropdown } from '@/components/chat/CommandDropdown';
import { CommandBadge } from '@/components/chat/CommandBadge';
import { parseMessage } from '@/lib/utils/message-parser';
import type { ExecutionLogEntry } from '@agent-marketplace/shared';
import Link from 'next/link';

// デフォルトの最大予算 (USDC)
const DEFAULT_MAX_BUDGET = 5.0;

// Slash command definitions
const SLASH_COMMANDS: SlashCommandOption[] = [
  {
    id: 'use-agent',
    label: '/use-agent',
    description: 'Execute a specific agent by ID',
    value: '/use-agent ',
    metadata: {
      usage: '/use-agent <agent-id>',
      example: '/use-agent 0x1234...',
    },
  },
];

export default function ChatPage() {
  const { wallet } = useDelegatedWallet();
  const [maxBudget, setMaxBudget] = useState(DEFAULT_MAX_BUDGET);

  const walletId = wallet?.walletId || '';
  const walletAddress = wallet?.address || '';

  const { messages, input, setInput, sendMessage, isLoading, error, clearError } = useAgentChat({
    walletId,
    walletAddress,
    maxBudget,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

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

  // Slash command handler
  const slashCommand = useSlashCommand({
    options: SLASH_COMMANDS,
    onSelect: (option) => {
      // Replace the slash command with the selected command
      const textarea = inputRef.current;
      if (textarea) {
        const beforeCursor = input.substring(0, textarea.selectionStart);
        const afterCursor = input.substring(textarea.selectionStart);
        const lastSlashIndex = beforeCursor.lastIndexOf('/');
        const newInput = beforeCursor.substring(0, lastSlashIndex) + option.value + afterCursor;
        setInput(newInput);

        // Set cursor position after the inserted command
        setTimeout(() => {
          const newCursorPos = lastSlashIndex + option.value.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }
    },
  });

  // Detect slash commands for dropdown
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      slashCommand.detectCommand(input, textarea.selectionStart);
    }
  }, [input, slashCommand]);

  // Parse current input to detect active command
  const activeCommand = useMemo(() => {
    const parsed = parseMessage(input);
    if (parsed.command && parsed.agentId) {
      return {
        command: parsed.command,
        agentId: parsed.agentId,
      };
    }
    return null;
  }, [input]);

  // Remove command from input
  const handleRemoveCommand = () => {
    setInput('');
    inputRef.current?.focus();
  };

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

    // Parse message to extract agent ID
    const parsed = parseMessage(input);

    // Send structured message
    sendMessage(parsed.text, parsed.agentId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command navigation first
    if (slashCommand.isOpen && slashCommand.handleKeyDown(e)) {
      return;
    }

    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Wallet connection and delegation status warning
  const walletWarning = !walletAddress ? (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-900/50 bg-yellow-950/30 p-3 md:gap-3 md:p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400 md:h-5 md:w-5" />
      <div className="flex-1">
        <p className="text-xs text-yellow-200 md:text-sm">
          Wallet is not connected. Please connect your wallet to use payment features.
        </p>
      </div>
    </div>
  ) : !wallet?.isDelegated ? (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-900/50 bg-yellow-950/30 p-3 md:gap-3 md:p-4">
      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400 md:h-5 md:w-5" />
      <div className="flex-1">
        <p className="text-xs text-yellow-200 md:text-sm">
          Wallet is not delegated to the server. To use x402 payments, please delegate your wallet
          on the{' '}
          <Link href="/wallet" className="font-medium underline hover:text-yellow-100">
            Wallet page
          </Link>
          .
        </p>
      </div>
    </div>
  ) : null;

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-screen flex-col bg-slate-950">
          {/* Header */}
          <PageHeader
            title="Chat"
            description="Paygent X will execute your tasks"
            rightContent={
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-xs text-slate-400 md:text-sm">Max Budget:</span>
                <input
                  type="number"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  min={0.01}
                  step={0.01}
                  className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white md:w-20 md:text-sm"
                />
                <span className="text-xs text-slate-400 md:text-sm">USDC</span>
              </div>
            }
          />

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-4xl">
              {walletWarning}

              {messages.length === 0 && <WelcomeMessage />}

              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {isLoading && messages.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 md:text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Agent is executing...</span>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 md:gap-3 md:p-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400 md:h-5 md:w-5" />
                  <div className="flex-1">
                    <p className="text-xs text-red-200 md:text-sm">{error}</p>
                    <button
                      onClick={clearError}
                      className="mt-2 text-xs text-red-400 hover:text-red-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-800 bg-slate-900/50 p-4 md:p-6">
            <div className="mx-auto max-w-4xl">
              {activeCommand && (
                <CommandBadge
                  command={activeCommand.command}
                  agentId={activeCommand.agentId}
                  onRemove={handleRemoveCommand}
                />
              )}

              <div ref={inputContainerRef} className="relative flex gap-2 md:gap-4">
                {slashCommand.isOpen && (
                  <CommandDropdown
                    options={slashCommand.filteredOptions}
                    selectedIndex={slashCommand.selectedIndex}
                    onSelect={slashCommand.selectOption}
                    onClose={slashCommand.close}
                  />
                )}

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your task... (Type / for commands)"
                  disabled={isLoading || !walletAddress || !wallet?.isDelegated}
                  rows={1}
                  className="scrollbar-hide flex-1 resize-none overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 md:px-4 md:py-3 md:text-base"
                  style={{ minHeight: '44px', maxHeight: '100px' }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading || !walletAddress || !wallet?.isDelegated}
                  className="self-start rounded-lg bg-purple-600 p-2.5 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Type / for commands • Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}

function WelcomeMessage() {
  return (
    <div className="mb-8 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 md:p-6">
      <h2 className="mb-2 text-base font-bold text-purple-300 md:text-lg">Welcome to UniAgent!</h2>
      <p className="mb-3 text-sm text-purple-200/80 md:text-base">
        Paygent X will discover and execute external agents from the marketplace:
      </p>
      <ul className="space-y-2 text-xs text-purple-200/70 md:text-sm">
        <li>1. Search for agents using discover_agents</li>
        <li>2. Select the best agent considering price and ratings</li>
        <li>3. Execute agents with x402 payment</li>
        <li>4. Deliver integrated results</li>
      </ul>
      <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
        <p className="mb-2 text-xs font-semibold text-purple-300 md:text-sm">Slash Commands:</p>
        <ul className="space-y-1 text-xs text-purple-200/70">
          <li>
            <code className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-purple-300">
              /use-agent &lt;agent-id&gt;
            </code>{' '}
            - Execute a specific agent by ID
          </li>
        </ul>
      </div>
      <p className="mt-4 text-xs text-purple-300/60">
        Examples: &quot;Search for agents in the travel category&quot;, &quot;/use-agent 0x1234...
        Create a 3-day travel plan for Paris&quot;
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`w-full max-w-3xl rounded-2xl px-4 py-3 md:px-6 md:py-4 ${
          isUser ? 'bg-purple-600 text-white' : 'border border-slate-800 bg-slate-900/50'
        }`}
      >
        {/* Role indicator */}
        <div
          className={`mb-2 flex items-center gap-2 text-xs font-medium md:text-sm ${
            isUser ? 'text-purple-200' : 'text-purple-400'
          }`}
        >
          {isUser ? (
            <>
              <User className="h-3 w-3 md:h-4 md:w-4" />
              You
            </>
          ) : (
            <>
              <Bot className="h-3 w-3 md:h-4 md:w-4" />
              AI Agent
            </>
          )}
        </div>

        {/* Content */}
        <div
          className={`whitespace-pre-wrap text-sm md:text-base ${isUser ? 'text-white' : 'text-slate-300'}`}
        >
          {message.content || <span className="text-slate-500 italic">Executing...</span>}
        </div>

        {/* Execution Log (アシスタントメッセージのみ) */}
        {!isUser && message.executionLog && message.executionLog.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-700 pt-3 md:mt-4 md:pt-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Wrench className="h-3 w-3" />
              Execution Log
            </div>
            {message.executionLog.map((entry, index) => (
              <ExecutionLogCard key={index} entry={entry} />
            ))}
          </div>
        )}

        {/* Total Cost */}
        {!isUser && message.totalCost !== undefined && message.totalCost > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-700 pt-2 text-xs md:mt-3 md:pt-3 md:text-sm">
            <DollarSign className="h-3 w-3 text-green-400 md:h-4 md:w-4" />
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
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-xs md:p-3">
      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${typeColors[entry.type]}`} />
        <span className="font-mono text-slate-500">[Step {entry.step}]</span>
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
          {typeLabels[entry.type]}
        </span>
        <span className="text-slate-300">{entry.action}</span>
      </div>
      {entry.details && Object.keys(entry.details).length > 0 && (
        <pre className="mt-2 overflow-x-auto text-[10px] text-slate-400 md:text-xs">
          {JSON.stringify(entry.details, null, 2)}
        </pre>
      )}
    </div>
  );
}
