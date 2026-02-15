'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Star,
  Shield,
  Clock,
  MessageSquare,
} from 'lucide-react';
import type { DiscoveredAgent } from '@agent-marketplace/shared';
import { useAgentAttestations } from '@/lib/hooks/useAgentAttestations';
import { formatCategory, formatAddress, formatRelativeTime } from '@/lib/utils/format';

interface AgentDetailModalProps {
  agent: DiscoveredAgent;
  onClose: () => void;
}

/** 0-255 (uint8) → 1.0-5.0 display scale */
function toDisplayScore(uint8: number): string {
  return (uint8 / 51).toFixed(1);
}

/** 0-255 → 0-100 percentage for progress bar */
function toPercentage(uint8: number): number {
  return Math.round((uint8 / 255) * 100);
}

export function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  const { attestations, summary, isLoading } = useAgentAttestations(
    agent.agentId
  );
  const [copied, setCopied] = useState(false);

  const handleClose = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleClose);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleClose);
      document.body.style.overflow = '';
    };
  }, [handleClose]);

  const handleCopyAgentId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(agent.agentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const category = agent.category ? formatCategory(agent.category) : 'unknown';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative z-10 flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-purple-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto">
          {/* ── Agent Header ── */}
          <div className="flex flex-col items-center px-6 pt-8 pb-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-3xl shadow-lg shadow-purple-500/20">
              🤖
            </div>
            <h2 className="mb-1 text-xl font-bold text-white">{agent.name}</h2>
            <span className="mb-3 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-0.5 text-xs font-medium text-purple-300">
              {category}
            </span>
            <p className="max-w-md text-center text-sm leading-relaxed text-slate-400">
              {agent.description}
            </p>

            {/* Skills */}
            {agent.skills && agent.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {agent.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-0.5 text-xs text-slate-300"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            )}

            {/* Price & x402 */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-lg font-bold text-white">
                {agent.price.toFixed(2)} USDC
              </span>
              {agent.x402Support && (
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-300">
                  x402
                </span>
              )}
            </div>

            {/* Agent ID */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5">
              <span className="truncate font-mono text-xs text-slate-400 max-w-[280px]">
                {agent.agentId}
              </span>
              <button
                onClick={handleCopyAgentId}
                className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                title={copied ? 'Copied!' : 'Copy Agent ID'}
              >
                <Copy
                  className={`h-3.5 w-3.5 ${copied ? 'text-green-400' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* ── Summary Stats ── */}
          <div className="border-t border-slate-800 px-6 py-4">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-slate-800/50"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 text-yellow-400">
                    <Star className="h-4 w-4 fill-current" />
                  </div>
                  <div className="text-lg font-bold text-white">
                    {summary.count > 0
                      ? toDisplayScore(summary.avgQuality)
                      : '-'}
                  </div>
                  <div className="text-xs text-slate-400">Quality</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 text-blue-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-bold text-white">
                    {summary.count > 0
                      ? toDisplayScore(summary.avgReliability)
                      : '-'}
                  </div>
                  <div className="text-xs text-slate-400">Reliability</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1 text-purple-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-bold text-white">
                    {summary.count}
                  </div>
                  <div className="text-xs text-slate-400">Reviews</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Attestation List ── */}
          <div className="border-t border-slate-800 px-6 py-4 pb-6">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Evaluations ({summary.count})
            </h3>

            {isLoading && (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-xl bg-slate-800/50"
                  />
                ))}
              </div>
            )}

            {!isLoading && attestations.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-800/20 p-8 text-center">
                <div className="mb-2 text-2xl">📋</div>
                <p className="text-sm text-slate-400">
                  No evaluations yet
                </p>
              </div>
            )}

            {!isLoading && attestations.length > 0 && (
              <div className="space-y-3">
                {attestations.map((att) => (
                  <div
                    key={att.id}
                    className="rounded-xl border border-slate-800 bg-slate-800/20 p-4"
                  >
                    {/* Scores */}
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                          <span>Quality</span>
                          <span className="text-white">
                            {toDisplayScore(att.quality)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-yellow-400"
                            style={{ width: `${toPercentage(att.quality)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                          <span>Reliability</span>
                          <span className="text-white">
                            {toDisplayScore(att.reliability)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{
                              width: `${toPercentage(att.reliability)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Latency */}
                    <div className="mb-2 flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{(att.latency / 1000).toFixed(1)}s</span>
                    </div>

                    {/* Tags */}
                    {att.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {att.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reasoning */}
                    {att.reasoning && (
                      <p className="mb-2 text-xs leading-relaxed text-slate-400 line-clamp-3">
                        {att.reasoning}
                      </p>
                    )}

                    {/* Footer: attester + date + EAS Scan link */}
                    <div className="flex items-center justify-between border-t border-slate-700/50 pt-2">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{formatAddress(att.attester)}</span>
                        <span>·</span>
                        <span>
                          {formatRelativeTime(new Date(att.createdAt))}
                        </span>
                      </div>
                      <a
                        href={att.easScanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/10 hover:text-purple-300"
                      >
                        EAS Scan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
