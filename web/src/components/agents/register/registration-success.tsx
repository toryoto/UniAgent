'use client';

import { CheckCircle2, ExternalLink, RotateCcw } from 'lucide-react';
import { BLOCK_EXPLORER_URL } from '@/lib/blockchain/config';

interface RegistrationSuccessProps {
  agentId: bigint;
  registerTxHash?: string;
  walletTxHash?: string;
  ipfsUri?: string;
  onReset: () => void;
}

export function RegistrationSuccess({
  agentId,
  registerTxHash,
  walletTxHash,
  ipfsUri,
  onReset,
}: RegistrationSuccessProps) {
  return (
    <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
      <div className="mb-4 flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-400" />
        <div>
          <h3 className="text-lg font-bold text-green-300">
            Agent Registered Successfully!
          </h3>
          <p className="text-sm text-green-400/80">
            Agent ID: {agentId.toString()}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {ipfsUri && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">IPFS:</span>
            <span className="font-mono text-xs text-slate-300">
              {ipfsUri}
            </span>
          </div>
        )}

        {registerTxHash && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Register Tx:</span>
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${registerTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs text-green-300 hover:text-green-200"
            >
              {registerTxHash.slice(0, 10)}...{registerTxHash.slice(-8)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {walletTxHash && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Set Wallet Tx:</span>
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${walletTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs text-green-300 hover:text-green-200"
            >
              {walletTxHash.slice(0, 10)}...{walletTxHash.slice(-8)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      <button
        onClick={onReset}
        className="mt-4 flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
      >
        <RotateCcw className="h-4 w-4" />
        Register Another Agent
      </button>
    </div>
  );
}
