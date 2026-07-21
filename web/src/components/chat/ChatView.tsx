'use client';

import { Send, Loader2, AlertCircle, Shield, Square } from 'lucide-react';
import { useRef, useEffect, useMemo, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAgentStream } from '@/lib/hooks/useAgentStream';
import { useDelegatedWallet } from '@/lib/hooks/useDelegatedWallet';
import { useSlashCommand, type SlashCommandOption } from '@/lib/hooks/useSlashCommand';
import { CommandDropdown } from '@/components/chat/CommandDropdown';
import { CommandBadge } from '@/components/chat/CommandBadge';
import { parseMessage } from '@/lib/utils/message-parser';
import { PageHeader } from '@/components/layout/page-header';
import { WelcomeMessage } from '@/components/chat/WelcomeMessage';
import { MessageBubble } from '@/components/chat/MessageBubble';
import type { AgentStreamMessage } from '@/lib/types';

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

const BOTTOM_SCROLL_THRESHOLD_PX = 80;

interface ChatViewProps {
  conversationId?: string;
  initialMessages?: AgentStreamMessage[];
}

export function ChatView({ conversationId: initialConversationId, initialMessages }: ChatViewProps) {
  const { getAccessToken } = usePrivy();
  const { wallet } = useDelegatedWallet();
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const walletId = wallet?.walletId || '';
  const walletAddress = wallet?.address || '';

  const {
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
  } = useAgentStream({
    walletId,
    walletAddress,
    conversationId: initialConversationId,
    getAccessToken,
    initialMessages,
  });

  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev !== pathname && pathname === '/chat') {
      reset();
    }
  }, [pathname, reset]);

  useEffect(() => {
    if (conversationId && !initialConversationId) {
      window.history.replaceState(null, '', `/chat/${conversationId}`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [conversationId, initialConversationId, queryClient]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const updateScrollPin = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= BOTTOM_SCROLL_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

  const slashCommand = useSlashCommand({
    options: SLASH_COMMANDS,
    onSelect: (option) => {
      const textarea = inputRef.current;
      if (textarea) {
        const beforeCursor = input.substring(0, textarea.selectionStart);
        const afterCursor = input.substring(textarea.selectionStart);
        const lastSlashIndex = beforeCursor.lastIndexOf('/');
        const newInput = beforeCursor.substring(0, lastSlashIndex) + option.value + afterCursor;
        setInput(newInput);

        setTimeout(() => {
          const newCursorPos = lastSlashIndex + option.value.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }
    },
  });

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      slashCommand.detectCommand(input, textarea.selectionStart);
    }
  }, [input, slashCommand]);

  const activeCommand = useMemo(() => {
    const parsed = parseMessage(input);
    if (parsed.command && parsed.agentId) {
      return { command: parsed.command, agentId: parsed.agentId };
    }
    return null;
  }, [input]);

  const handleRemoveCommand = useCallback(() => {
    setInput('');
    inputRef.current?.focus();
  }, [setInput]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    isNearBottomRef.current = true;
    const parsed = parseMessage(input);
    sendMessage(parsed.text, parsed.agentId);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashCommand.isOpen && slashCommand.handleKeyDown(e)) return;
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [slashCommand, handleSubmit],
  );

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
    <>
      <PageHeader title="Chat" />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8"
        onScroll={updateScrollPin}
      >
        <div className="mx-auto max-w-4xl">
          {walletWarning}

          {messages.length === 0 && <WelcomeMessage />}

          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onResume={resumeAgent} />
            ))}

            {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
              <div className="flex items-center gap-2 text-xs text-slate-400 md:text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Agent is executing...</span>
              </div>
            )}
          </div>

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
              disabled={isStreaming || isWaitingApproval || !walletAddress || !wallet?.isDelegated}
              rows={1}
              className="scrollbar-hide flex-1 resize-none overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 md:px-4 md:py-3 md:text-base"
              style={{ minHeight: '44px', maxHeight: '100px' }}
            />
            {isStreaming ? (
              <button
                onClick={abort}
                className="self-start rounded-lg bg-red-600 p-2.5 font-semibold text-white transition-colors hover:bg-red-700 md:px-6 md:py-3"
                title="Stop streaming"
              >
                <Square className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isWaitingApproval || !walletAddress || !wallet?.isDelegated}
                className="self-start rounded-lg bg-purple-600 p-2.5 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Type / for commands • Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
