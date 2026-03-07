'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Check, Clock, Coins, X } from 'lucide-react';
import { useAgentStaking } from '@/lib/hooks/useAgentStaking';

interface StakingPanelProps {
  agentId: string;
  agentName: string;
}

function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'Ready';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function StakingPanel({ agentId, agentName }: StakingPanelProps) {
  const {
    currentStake,
    unstakeRequest,
    isLoadingStake,
    error,

    approveUsdc,
    isApproving,
    approveConfirming,
    approveConfirmed,

    stake,
    isStaking,
    stakeConfirming,
    stakeConfirmed,

    requestUnstake,
    isRequestingUnstake,
    requestUnstakeConfirming,
    requestUnstakeConfirmed,

    executeUnstake,
    isExecutingUnstake,
    executeUnstakeConfirming,
    executeUnstakeConfirmed,

    cancelUnstake,
    isCancellingUnstake,
    cancelUnstakeConfirming,
    cancelUnstakeConfirmed,

    refetch,
  } = useAgentStaking(agentId);

  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [step, setStep] = useState<'idle' | 'approved'>('idle');
  const [countdown, setCountdown] = useState('');

  // Refresh data after successful transactions
  useEffect(() => {
    if (stakeConfirmed || executeUnstakeConfirmed || requestUnstakeConfirmed || cancelUnstakeConfirmed) {
      refetch();
      if (stakeConfirmed) {
        setStakeAmount('');
        setStep('idle');
      }
      if (requestUnstakeConfirmed) setUnstakeAmount('');
    }
  }, [stakeConfirmed, executeUnstakeConfirmed, requestUnstakeConfirmed, cancelUnstakeConfirmed, refetch]);

  // Move to step 'approved' when approve confirms
  useEffect(() => {
    if (approveConfirmed) setStep('approved');
  }, [approveConfirmed]);

  // Countdown timer for unstake cooldown
  useEffect(() => {
    if (!unstakeRequest || unstakeRequest.isReady) return;
    const update = () => setCountdown(formatCountdown(unstakeRequest.availableAt));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [unstakeRequest]);

  const handleApprove = async () => {
    const amount = Number(stakeAmount);
    if (!amount || amount <= 0) return;
    try {
      await approveUsdc(amount);
    } catch {
      // error is set in hook
    }
  };

  const handleStake = async () => {
    const amount = Number(stakeAmount);
    if (!amount || amount <= 0) return;
    try {
      await stake(amount);
    } catch {
      // error is set in hook
    }
  };

  const handleRequestUnstake = async () => {
    const amount = Number(unstakeAmount);
    if (!amount || amount <= 0) return;
    try {
      await requestUnstake(amount);
    } catch {
      // error is set in hook
    }
  };

  const handleExecuteUnstake = async () => {
    try {
      await executeUnstake();
    } catch {
      // error is set in hook
    }
  };

  const handleCancelUnstake = async () => {
    try {
      await cancelUnstake();
    } catch {
      // error is set in hook
    }
  };

  const isStakeProcessing = isApproving || approveConfirming || isStaking || stakeConfirming;
  const isUnstakeProcessing =
    isRequestingUnstake ||
    requestUnstakeConfirming ||
    isExecutingUnstake ||
    executeUnstakeConfirming ||
    isCancellingUnstake ||
    cancelUnstakeConfirming;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 md:p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-red-200 md:text-sm">{error}</p>
        </div>
      )}

      {/* Current Stake */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-white md:text-xl">
          <Coins className="h-5 w-5 text-green-400" />
          Current Stake
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-center">
          {isLoadingStake ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-slate-400">Loading...</span>
            </div>
          ) : (
            <div className="text-2xl font-bold text-white md:text-3xl">
              {currentStake.toFixed(2)} <span className="text-lg text-slate-400">USDC</span>
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Agent: {agentName} (ID: {agentId})
        </p>
      </div>

      {/* Stake Form */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
        <h3 className="mb-3 text-lg font-bold text-white md:text-xl">Stake USDC</h3>
        <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-xs text-blue-200 md:text-sm">
            Staking USDC on your agent increases trust and improves discovery ranking.
            Two steps: first approve USDC, then stake.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => {
                setStakeAmount(e.target.value);
                setStep('idle');
              }}
              min={0.01}
              step={0.01}
              placeholder="e.g. 10"
              disabled={isStakeProcessing}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 md:px-4 md:py-3 md:text-base"
            />
          </div>

          {step === 'idle' ? (
            <button
              onClick={handleApprove}
              disabled={isStakeProcessing || !stakeAmount || Number(stakeAmount) <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : approveConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming approval...
                </>
              ) : (
                'Step 1: Approve USDC'
              )}
            </button>
          ) : (
            <button
              onClick={handleStake}
              disabled={isStakeProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
            >
              {isStaking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Staking...
                </>
              ) : stakeConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming stake...
                </>
              ) : stakeConfirmed ? (
                <>
                  <Check className="h-4 w-4" />
                  Staked!
                </>
              ) : (
                'Step 2: Stake'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Unstake Management */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
        <h3 className="mb-3 text-lg font-bold text-white md:text-xl">Unstake</h3>

        {currentStake === 0 && !unstakeRequest ? (
          <p className="text-sm text-slate-500">No stake to unstake.</p>
        ) : unstakeRequest ? (
          // Active unstake request
          <div className="space-y-3">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 md:p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-200">
                <Clock className="h-4 w-4" />
                Unstake Request Active
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-yellow-200/70">Amount</span>
                  <div className="text-lg font-bold text-white">
                    {unstakeRequest.amount.toFixed(2)} USDC
                  </div>
                </div>
                <div>
                  <span className="text-xs text-yellow-200/70">
                    {unstakeRequest.isReady ? 'Status' : 'Cooldown'}
                  </span>
                  <div className="text-lg font-bold text-white">
                    {unstakeRequest.isReady ? (
                      <span className="text-green-400">Ready</span>
                    ) : (
                      countdown
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {unstakeRequest.isReady && (
                <button
                  onClick={handleExecuteUnstake}
                  disabled={isUnstakeProcessing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 md:py-3"
                >
                  {isExecutingUnstake || executeUnstakeConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isExecutingUnstake ? 'Executing...' : 'Confirming...'}
                    </>
                  ) : executeUnstakeConfirmed ? (
                    <>
                      <Check className="h-4 w-4" />
                      Done
                    </>
                  ) : (
                    'Execute Unstake'
                  )}
                </button>
              )}
              <button
                onClick={handleCancelUnstake}
                disabled={isUnstakeProcessing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 md:py-3"
              >
                {isCancellingUnstake || cancelUnstakeConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : cancelUnstakeConfirmed ? (
                  <>
                    <Check className="h-4 w-4" />
                    Cancelled
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Cancel Unstake
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          // No active request - show request form
          <div className="space-y-3">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <p className="text-xs text-yellow-200 md:text-sm">
                Unstaking requires a 7-day cooldown period. After requesting, wait 7 days
                before executing the withdrawal.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                Amount to Unstake (USDC)
              </label>
              <input
                type="number"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                min={0.01}
                step={0.01}
                max={currentStake}
                placeholder={`Max: ${currentStake.toFixed(2)}`}
                disabled={isUnstakeProcessing}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 md:px-4 md:py-3 md:text-base"
              />
            </div>

            <button
              onClick={handleRequestUnstake}
              disabled={
                isUnstakeProcessing ||
                !unstakeAmount ||
                Number(unstakeAmount) <= 0 ||
                Number(unstakeAmount) > currentStake
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
            >
              {isRequestingUnstake ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Requesting...
                </>
              ) : requestUnstakeConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : requestUnstakeConfirmed ? (
                <>
                  <Check className="h-4 w-4" />
                  Requested
                </>
              ) : (
                'Request Unstake'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
