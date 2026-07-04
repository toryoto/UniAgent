'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Shield,
  XCircle,
} from 'lucide-react';
import type { HITLDecision } from '@agent-marketplace/shared';
import type { AgentApproval } from '@/lib/types';

export function ApprovalCard({
  approval,
  onResume,
}: {
  approval: AgentApproval;
  onResume: (decisions: HITLDecision[]) => Promise<void>;
}) {
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [editedArgsMap, setEditedArgsMap] = useState<Record<number, Record<string, unknown>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actions = approval.actionRequests;
  if (actions.length === 0) return null;

  const isBatch = actions.length > 1;
  const isEditing = editingIndices.size > 0;

  const getAllowedDecisions = (idx: number) => {
    const rc = approval.reviewConfigs.find((r) => r.actionName === actions[idx].name);
    return rc?.allowedDecisions ?? ['approve', 'reject'];
  };

  const canEditAny = actions.some((_, i) => getAllowedDecisions(i).includes('edit'));

  const toggleEdit = (idx: number) => {
    setEditingIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        setEditedArgsMap((m) => {
          const { [idx]: _, ...rest } = m;
          return rest;
        });
      } else {
        next.add(idx);
        setEditedArgsMap((m) => ({ ...m, [idx]: { ...actions[idx].args } }));
      }
      return next;
    });
  };

  const updateEditedArgs = (idx: number, updated: Record<string, unknown>) => {
    setEditedArgsMap((m) => ({ ...m, [idx]: updated }));
  };

  const buildDecisions = (): HITLDecision[] =>
    actions.map((a, i) => {
      const edited = editedArgsMap[i];
      if (edited && JSON.stringify(edited) !== JSON.stringify(a.args)) {
        return { type: 'edit' as const, editedAction: { name: a.name, args: edited } };
      }
      return { type: 'approve' as const };
    });

  const handleApprove = async () => {
    setIsSubmitting(true);
    await onResume(actions.map(() => ({ type: 'approve' as const })));
  };

  const handleSubmitEdits = async () => {
    setIsSubmitting(true);
    await onResume(buildDecisions());
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    await onResume(
      actions.map(() => ({
        type: 'reject' as const,
        message: 'User rejected the agent execution',
      })),
    );
  };

  const totalMaxPrice = isBatch
    ? actions.reduce((sum, a) => sum + (Number((a.args as Record<string, unknown>).maxPrice) || 0), 0)
    : null;

  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 md:p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-amber-300 md:text-sm">
        <Shield className="h-4 w-4" />
        Approval Required
        {isBatch && (
          <span className="rounded bg-amber-800/50 px-1.5 py-0.5 text-[10px] text-amber-200">
            {actions.length} agents
          </span>
        )}
      </div>

      {isBatch && totalMaxPrice !== null && (
        <div className="mb-3 flex items-center gap-2 rounded bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300">
          <span className="text-slate-500">Total estimated cost:</span>
          <span className="font-mono text-green-400">${totalMaxPrice.toFixed(4)} USDC</span>
        </div>
      )}

      {isBatch ? (
        <div className="mb-3 space-y-2">
          {actions.map((a, i) => {
            const allowed = getAllowedDecisions(i);
            const isEditingThis = editingIndices.has(i);
            return (
              <div key={i} className="rounded border border-slate-700/50 bg-slate-800/30 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500">AGENT {i + 1}</span>
                  {allowed.includes('edit') && (
                    <button
                      onClick={() => toggleEdit(i)}
                      disabled={isSubmitting}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-900/30 disabled:opacity-50"
                    >
                      <Pencil className="h-3 w-3" />
                      {isEditingThis ? 'Cancel' : 'Edit'}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 md:text-sm">
                  {isEditingThis ? (
                    <ActionEditor
                      args={editedArgsMap[i] ?? { ...a.args }}
                      onChange={(updated) => updateEditedArgs(i, updated)}
                    />
                  ) : (
                    <ActionDetail action={a} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-3 space-y-1.5 text-xs text-slate-300 md:text-sm">
          {editingIndices.has(0) ? (
            <ActionEditor
              args={editedArgsMap[0] ?? { ...actions[0].args }}
              onChange={(updated) => updateEditedArgs(0, updated)}
            />
          ) : (
            <ActionDetail action={actions[0]} />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isEditing && getAllowedDecisions(0).includes('approve') && (
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 md:text-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isBatch ? `Approve All (${actions.length})` : 'Approve'}
          </button>
        )}
        {isEditing && (
          <button
            onClick={handleSubmitEdits}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 md:text-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            Apply Changes
          </button>
        )}
        {!isBatch && !isEditing && canEditAny && (
          <button
            onClick={() => toggleEdit(0)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 md:text-sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        {isEditing && (
          <button
            onClick={() => {
              setEditingIndices(new Set());
              setEditedArgsMap({});
            }}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-50 md:text-sm"
          >
            Cancel
          </button>
        )}
        {!isEditing && getAllowedDecisions(0).includes('reject') && (
          <button
            onClick={handleReject}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 md:text-sm"
          >
            <XCircle className="h-3.5 w-3.5" />
            {isBatch ? 'Reject All' : 'Reject'}
          </button>
        )}
      </div>

      {isSubmitting && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing decision...
        </div>
      )}
    </div>
  );
}

function ActionDetail({
  action,
}: {
  action: { name: string; args: Record<string, unknown>; description?: string };
}) {
  const { agentUrl, task, data, maxPrice, agentId } = action.args as Record<string, unknown>;

  if (action.description) {
    return <p className="whitespace-pre-wrap text-amber-200/80">{action.description}</p>;
  }

  return (
    <>
      <div className="flex gap-2">
        <span className="text-slate-500">Tool:</span>
        <span className="font-mono text-slate-200">{action.name}</span>
      </div>
      {agentId != null && (
        <div className="flex gap-2">
          <span className="text-slate-500">Agent ID:</span>
          <span className="font-mono text-slate-200">{String(agentId)}</span>
        </div>
      )}
      {agentUrl != null && (
        <div className="flex gap-2">
          <span className="text-slate-500">Agent URL:</span>
          <span className="font-mono text-slate-200">{String(agentUrl)}</span>
        </div>
      )}
      {task != null && (
        <div className="flex gap-2">
          <span className="text-slate-500">Task:</span>
          <span className="text-slate-200">{String(task)}</span>
        </div>
      )}
      {data != null && typeof data === 'object' && (
        <div className="flex gap-2">
          <span className="text-slate-500">Params:</span>
          <pre className="max-w-full overflow-x-auto rounded bg-slate-800/50 px-2 py-1 font-mono text-[11px] text-slate-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
      {maxPrice !== undefined && (
        <div className="flex gap-2">
          <span className="text-slate-500">Max Price:</span>
          <span className="font-mono text-green-400">${String(maxPrice)} USDC</span>
        </div>
      )}
    </>
  );
}

function ActionEditor({
  args,
  onChange,
}: {
  args: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      {args.task !== undefined && (
        <>
          <label className="text-[10px] font-medium text-slate-500">EDIT TASK</label>
          <textarea
            value={String(args.task ?? '')}
            onChange={(e) => onChange({ ...args, task: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none md:text-sm"
            rows={2}
          />
        </>
      )}
      {args.data !== undefined && (
        <>
          <label className="text-[10px] font-medium text-slate-500">EDIT PARAMS (JSON)</label>
          <textarea
            value={typeof args.data === 'string' ? args.data : JSON.stringify(args.data, null, 2)}
            onChange={(e) => {
              try {
                onChange({ ...args, data: JSON.parse(e.target.value) });
              } catch {
                onChange({ ...args, data: e.target.value });
              }
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none md:text-sm"
            rows={4}
          />
        </>
      )}
    </div>
  );
}
