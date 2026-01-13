/**
 * CommandBadge - Visual indicator for active slash commands
 */

import { X, Terminal } from 'lucide-react';

export interface CommandBadgeProps {
  command: string;
  agentId?: string;
  onRemove: () => void;
}

export function CommandBadge({ command, agentId, onRemove }: CommandBadgeProps) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
      <Terminal className="h-4 w-4 shrink-0 text-purple-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-purple-300">Active Command:</span>
          <code className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-xs text-purple-200">
            /{command}
          </code>
        </div>
        {agentId && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-xs text-purple-400/70">Agent ID:</span>
            <span className="truncate font-mono text-xs text-purple-300">{agentId}</span>
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-purple-400 transition-colors hover:bg-purple-500/20 hover:text-purple-300"
        title="Remove command"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
