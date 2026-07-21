'use client';

import { Bot, CreditCard, DollarSign, Loader2, User } from 'lucide-react';
import type { HITLDecision } from '@agent-marketplace/shared';
import type { AgentStreamMessage } from '@/lib/types';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { HotelResultsCard } from '@/components/chat/HotelResultsCard';
import { ApprovalCard } from '@/components/chat/ApprovalCard';
import { ToolCallCard } from '@/components/chat/ToolCallCard';
import { extractHotelResults } from '@/lib/utils/extract-hotel-results';

export function MessageBubble({
  message,
  onResume,
}: {
  message: AgentStreamMessage;
  onResume: (decisions: HITLDecision[]) => Promise<void>;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`w-full max-w-3xl rounded-2xl px-4 py-3 md:px-6 md:py-4 ${
          isUser ? 'bg-purple-600 text-white' : 'border border-slate-800 bg-slate-900/50'
        }`}
      >
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
              {message.isStreaming && (
                <Loader2 className="h-3 w-3 animate-spin text-purple-300" />
              )}
            </>
          )}
        </div>

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 space-y-2">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.toolCallId} toolCall={tc} />
            ))}
          </div>
        )}

        {!isUser && (() => {
          const hotelData = message.toolCalls
            ?.map((tc) =>
              tc.status !== 'calling' && tc.result ? extractHotelResults(tc.result) : null,
            )
            .find(Boolean);
          return hotelData ? (
            <div className="mb-3">
              <HotelResultsCard
                hotels={hotelData.hotels}
                searchParams={hotelData.searchParams}
                totalResults={hotelData.totalResults}
              />
            </div>
          ) : null;
        })()}

        {!isUser && message.approval && !message.approval.resolved && (
          <div className="mb-3">
            <ApprovalCard approval={message.approval} onResume={onResume} />
          </div>
        )}

        {!isUser && message.payment && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-900/50 bg-green-950/30 p-2 text-xs">
            <CreditCard className="h-3 w-3 text-green-400" />
            <span className="text-green-300">
              Payment: ${message.payment.amount.toFixed(4)} USDC
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              Total: ${message.payment.totalCost.toFixed(4)} USDC
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              Remaining: ${message.payment.remainingBudget.toFixed(4)} USDC
            </span>
          </div>
        )}

        <div
          className={`min-w-0 text-sm md:text-base ${isUser ? 'whitespace-pre-wrap text-white' : 'text-slate-300'}`}
        >
          {message.content ? (
            isUser ? (
              message.content
            ) : (
              <MessageMarkdown content={message.content} />
            )
          ) : message.isStreaming ? (
            <span className="flex items-center gap-2 text-slate-500 italic">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </span>
          ) : !message.approval ? (
            <span className="text-slate-500 italic">No response</span>
          ) : null}
        </div>

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
