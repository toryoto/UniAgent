'use client';

import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { type Hex } from 'viem';
import { CONTRACT_ADDRESSES, USDC_DECIMALS } from '@/lib/blockchain/config';
import { AGENT_STAKING_ABI } from '@/lib/blockchain/contract';
import { ERC20_ABI } from '@/lib/blockchain/config';

const stakingAddress = CONTRACT_ADDRESSES.AGENT_STAKING as Hex;
const usdcAddress = CONTRACT_ADDRESSES.USDC as Hex;

export interface UnstakeRequest {
  amount: number;
  availableAt: Date;
  isReady: boolean;
}

function toShortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|user denied/i.test(msg)) return 'Transaction was rejected.';
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds.';
  if (/exceeds allowance/i.test(msg)) return 'USDC allowance exceeded.';
  const first = msg.split('\n')[0];
  return first.length > 120 ? `${first.slice(0, 120)}…` : first;
}

export function useAgentStaking(agentId: string | undefined) {
  const [error, setError] = useState<string | null>(null);

  // ── Read: current stake ──
  const {
    data: stakeRaw,
    refetch: refetchStake,
    isLoading: isLoadingStake,
  } = useReadContract({
    address: stakingAddress,
    abi: AGENT_STAKING_ABI,
    functionName: 'getStake',
    args: agentId ? [BigInt(agentId)] : undefined,
    query: { enabled: !!agentId },
  });

  // ── Read: unstake request ──
  const {
    data: unstakeRequestRaw,
    refetch: refetchUnstakeRequest,
  } = useReadContract({
    address: stakingAddress,
    abi: AGENT_STAKING_ABI,
    functionName: 'unstakeRequests',
    args: agentId ? [BigInt(agentId)] : undefined,
    query: { enabled: !!agentId },
  });

  // ── Read: USDC allowance ──
  const {
    data: allowanceRaw,
    refetch: refetchAllowance,
  } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: undefined,
    query: { enabled: false },
  });

  // ── Write contracts ──
  const { mutateAsync: writeApprove, isPending: isApproving, data: approveTxHash } =
    useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  const { mutateAsync: writeStake, isPending: isStaking, data: stakeTxHash } =
    useWriteContract();
  const { isLoading: stakeConfirming, isSuccess: stakeConfirmed } =
    useWaitForTransactionReceipt({ hash: stakeTxHash });

  const { mutateAsync: writeRequestUnstake, isPending: isRequestingUnstake, data: requestUnstakeTxHash } =
    useWriteContract();
  const { isLoading: requestUnstakeConfirming, isSuccess: requestUnstakeConfirmed } =
    useWaitForTransactionReceipt({ hash: requestUnstakeTxHash });

  const { mutateAsync: writeExecuteUnstake, isPending: isExecutingUnstake, data: executeUnstakeTxHash } =
    useWriteContract();
  const { isLoading: executeUnstakeConfirming, isSuccess: executeUnstakeConfirmed } =
    useWaitForTransactionReceipt({ hash: executeUnstakeTxHash });

  const { mutateAsync: writeCancelUnstake, isPending: isCancellingUnstake, data: cancelUnstakeTxHash } =
    useWriteContract();
  const { isLoading: cancelUnstakeConfirming, isSuccess: cancelUnstakeConfirmed } =
    useWaitForTransactionReceipt({ hash: cancelUnstakeTxHash });

  // ── Actions ──

  const approveUsdc = useCallback(
    async (amount: number) => {
      setError(null);
      try {
        const amountWei = BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));
        await writeApprove({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [stakingAddress, amountWei],
        });
      } catch (e) {
        setError(toShortError(e));
        throw e;
      }
    },
    [writeApprove]
  );

  const stake = useCallback(
    async (amount: number) => {
      if (!agentId) return;
      setError(null);
      try {
        const amountWei = BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));
        await writeStake({
          address: stakingAddress,
          abi: AGENT_STAKING_ABI,
          functionName: 'stake',
          args: [BigInt(agentId), amountWei],
        });
      } catch (e) {
        setError(toShortError(e));
        throw e;
      }
    },
    [agentId, writeStake]
  );

  const requestUnstake = useCallback(
    async (amount: number) => {
      if (!agentId) return;
      setError(null);
      try {
        const amountWei = BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));
        await writeRequestUnstake({
          address: stakingAddress,
          abi: AGENT_STAKING_ABI,
          functionName: 'requestUnstake',
          args: [BigInt(agentId), amountWei],
        });
      } catch (e) {
        setError(toShortError(e));
        throw e;
      }
    },
    [agentId, writeRequestUnstake]
  );

  const executeUnstake = useCallback(async () => {
    if (!agentId) return;
    setError(null);
    try {
      await writeExecuteUnstake({
        address: stakingAddress,
        abi: AGENT_STAKING_ABI,
        functionName: 'executeUnstake',
        args: [BigInt(agentId)],
      });
    } catch (e) {
      setError(toShortError(e));
      throw e;
    }
  }, [agentId, writeExecuteUnstake]);

  const cancelUnstake = useCallback(async () => {
    if (!agentId) return;
    setError(null);
    try {
      await writeCancelUnstake({
        address: stakingAddress,
        abi: AGENT_STAKING_ABI,
        functionName: 'cancelUnstake',
        args: [BigInt(agentId)],
      });
    } catch (e) {
      setError(toShortError(e));
      throw e;
    }
  }, [agentId, writeCancelUnstake]);

  const refetch = useCallback(() => {
    refetchStake();
    refetchUnstakeRequest();
  }, [refetchStake, refetchUnstakeRequest]);

  // ── Parsed values ──
  const currentStake =
    stakeRaw != null ? Number(stakeRaw as bigint) / 10 ** USDC_DECIMALS : 0;

  const unstakeRequest: UnstakeRequest | null = (() => {
    if (!unstakeRequestRaw) return null;
    const raw = unstakeRequestRaw as [bigint, bigint];
    const amount = Number(raw[0]) / 10 ** USDC_DECIMALS;
    if (amount === 0) return null;
    const availableAt = new Date(Number(raw[1]) * 1000);
    return { amount, availableAt, isReady: Date.now() >= availableAt.getTime() };
  })();

  return {
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
    refetchAllowance,
  };
}
