/**
 * useDelegatedWallet - Privy Session Signers管理フック
 *
 * TEE実行環境でユーザーのembedded walletをサーバー側から使用できるようにするための
 * セッション署名者を管理するカスタムフック
 *
 */

import { useCallback, useMemo } from 'react';
import { usePrivy, useSigners } from '@privy-io/react-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WalletWithMetadata } from '@privy-io/react-auth';

export interface DelegatedWalletInfo {
  walletId: string;
  address: string;
  isDelegated: boolean;
}

export interface UseDelegatedWalletReturn {
  wallet: DelegatedWalletInfo | null;
  isDelegating: boolean;
  error: string | null;
  delegateWallet: () => Promise<boolean>;
  undelegateWallet: () => Promise<boolean>;
  isLoading: boolean;
}

/**
 * ユーザーのembedded walletを取得
 */
function getEmbeddedWallet(linkedAccounts: unknown[]): WalletWithMetadata | null {
  if (!linkedAccounts || !Array.isArray(linkedAccounts)) {
    return null;
  }

  // walletClientType: 'privy' のウォレットを検索
  const embeddedWallet = linkedAccounts.find(
    (account): account is WalletWithMetadata =>
      account !== null &&
      typeof account === 'object' &&
      'type' in account &&
      account.type === 'wallet' &&
      'walletClientType' in account &&
      account.walletClientType === 'privy'
  ) as WalletWithMetadata | undefined;

  return embeddedWallet ?? null;
}

export function useDelegatedWallet(): UseDelegatedWalletReturn {
  const { user, ready } = usePrivy();
  const { addSigners, removeSigners } = useSigners();
  const queryClient = useQueryClient();

  // Embedded walletを取得
  const embeddedWallet = useMemo(() => {
    if (!user?.linkedAccounts) return null;
    return getEmbeddedWallet(user.linkedAccounts);
  }, [user?.linkedAccounts]);

  const privyUserId = user?.id || null;

  const {
    data: delegationData,
    isLoading: isLoadingDelegation,
    error: delegationError,
  } = useQuery({
    queryKey: ['wallet-delegation', privyUserId],
    queryFn: async () => {
      if (!privyUserId) return null;

      const response = await fetch(
        `/api/wallet/delegation?privyUserId=${encodeURIComponent(privyUserId)}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          return { isDelegated: false, walletAddress: null };
        }
        throw new Error('Failed to fetch delegation status');
      }
      return response.json() as Promise<{ isDelegated: boolean; walletAddress: string | null }>;
    },
    enabled: !!privyUserId && ready,
    staleTime: 30 * 1000,
  });

  // 委託状態を更新するMutation
  const updateDelegationMutation = useMutation({
    mutationFn: async (isDelegated: boolean) => {
      if (!privyUserId) throw new Error('User not authenticated');

      const response = await fetch('/api/wallet/delegation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyUserId, isDelegated }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update delegation status');
      }

      return response.json() as Promise<{ isDelegated: boolean; walletAddress: string | null }>;
    },
    onSuccess: () => {
      // キャッシュを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ['wallet-delegation', privyUserId] });
    },
  });

  // wallet情報を構築
  const wallet = useMemo((): DelegatedWalletInfo | null => {
    if (!embeddedWallet) return null;

    const walletId =
      embeddedWallet.id ??
      // @ts-expect-error - Privy SDKのバージョンによって構造が異なる
      embeddedWallet.walletId ??
      embeddedWallet.address;

    const isDelegated = delegationData?.isDelegated ?? false;

    return {
      walletId,
      address: embeddedWallet.address,
      isDelegated,
    };
  }, [embeddedWallet, delegationData?.isDelegated]);

  // ウォレットにセッション署名者を追加
  const delegateWallet = useCallback(async (): Promise<boolean> => {
    if (!embeddedWallet) {
      return false;
    }

    if (wallet?.isDelegated) {
      return true;
    }

    try {
      await addSigners({
        address: embeddedWallet.address,
        signers: [
          {
            signerId: process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID || '',
            policyIds: [],
          },
        ],
      });

      await updateDelegationMutation.mutateAsync(true);

      console.log('Session signer added successfully:', embeddedWallet.address);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add session signer';

      // 既に追加されていて、重複エラーの場合
      if (errorMessage.toLowerCase().includes('duplicate')) {
        console.log('Session signer already added (duplicate):', embeddedWallet.address);
        return true;
      }

      console.error('Failed to add session signer:', err);
      return false;
    }
  }, [embeddedWallet, wallet?.isDelegated, addSigners, updateDelegationMutation]);

  // ウォレットからセッション署名者を削除
  const undelegateWallet = useCallback(async (): Promise<boolean> => {
    if (!embeddedWallet) {
      return false;
    }

    if (!wallet?.isDelegated) {
      return true;
    }

    try {
      await removeSigners({
        address: embeddedWallet.address,
      });

      await updateDelegationMutation.mutateAsync(false);

      console.log('Session signer removed successfully:', embeddedWallet.address);
      return true;
    } catch (err) {
      console.error('Failed to remove session signer:', err);
      return false;
    }
  }, [embeddedWallet, wallet?.isDelegated, removeSigners, updateDelegationMutation]);

  const error = useMemo(() => {
    if (delegationError) {
      return delegationError instanceof Error
        ? delegationError.message
        : 'Failed to load delegation status';
    }
    if (updateDelegationMutation.error) {
      return updateDelegationMutation.error instanceof Error
        ? updateDelegationMutation.error.message
        : 'Failed to update delegation status';
    }
    return null;
  }, [delegationError, updateDelegationMutation.error]);

  return useMemo(
    () => ({
      wallet,
      isDelegating: updateDelegationMutation.isPending,
      error,
      delegateWallet,
      undelegateWallet,
      isLoading: !ready || isLoadingDelegation,
    }),
    [
      wallet,
      updateDelegationMutation.isPending,
      error,
      delegateWallet,
      undelegateWallet,
      ready,
      isLoadingDelegation,
    ]
  );
}
