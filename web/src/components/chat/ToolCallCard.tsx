'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Wrench, XCircle } from 'lucide-react';
import type { AgentToolCall } from '@/lib/types';

export function ToolCallCard({ toolCall }: { toolCall: AgentToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCalling = toolCall.status === 'calling';
  const isRejected = toolCall.result === 'Rejected by user';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-xs md:p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2"
      >
        {isCalling ? (
          <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
        ) : isRejected ? (
          <XCircle className="h-3 w-3 text-red-400" />
        ) : (
          <Wrench className="h-3 w-3 text-green-400" />
        )}
        <span className="font-mono font-medium text-slate-200">{toolCall.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            isCalling
              ? 'bg-yellow-500/20 text-yellow-300'
              : isRejected
                ? 'bg-red-500/20 text-red-300'
                : 'bg-green-500/20 text-green-300'
          }`}
        >
          {isCalling ? 'Running...' : isRejected ? 'Rejected' : 'Done'}
        </span>
        <span className="ml-auto text-slate-500">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          <div>
            <span className="text-[10px] font-medium text-slate-500">ARGS</span>
            <pre className="mt-0.5 overflow-x-auto text-[10px] text-slate-400 md:text-xs">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <span className="text-[10px] font-medium text-slate-500">RESULT</span>
              <pre className="mt-0.5 max-h-40 overflow-auto text-[10px] text-slate-400 md:text-xs">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(toolCall.result), null, 2);
                  } catch {
                    return toolCall.result;
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
