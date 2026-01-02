/**
 * useDelegatedWallet - Privy Session Signers管理フック
 *
 * TEE実行環境でユーザーのembedded walletをサーバー側から使用できるようにするための
 * セッション署名者を管理するカスタムフック
 *
 */

import { useCallback, useMemo, useState } from 'react';
import { usePrivy, useSigners } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';

export interface DelegatedWalletInfo {
  walletId: string;
  address: string;
  isDelegated: boolean;
}

export interface UseDelegatedWalletReturn {
  /** Embedded wallet情報 */
  wallet: DelegatedWalletInfo | null;
  /** 委譲処理中かどうか */
  isDelegating: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ウォレットを委譲する */
  delegateWallet: () => Promise<boolean>;
  /** ローディング中かどうか */
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
  const { addSigners } = useSigners();

  const [isDelegating, setIsDelegating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegatedAddresses, setDelegatedAddresses] = useState<Set<string>>(new Set());

  // Embedded walletを取得
  const embeddedWallet = useMemo(() => {
    if (!user?.linkedAccounts) return null;
    return getEmbeddedWallet(user.linkedAccounts);
  }, [user?.linkedAccounts]);

  // wallet情報を構築
  const wallet = useMemo((): DelegatedWalletInfo | null => {
    if (!embeddedWallet) return null;

    const walletId =
      embeddedWallet.id ??
      // @ts-expect-error - Privy SDKのバージョンによって構造が異なる
      embeddedWallet.walletId ??
      embeddedWallet.address;

    const isDelegated = delegatedAddresses.has(embeddedWallet.address.toLowerCase());

    return {
      walletId,
      address: embeddedWallet.address,
      isDelegated,
    };
  }, [embeddedWallet, delegatedAddresses]);

  // ウォレットにセッション署名者を追加
  const delegateWallet = useCallback(async (): Promise<boolean> => {
    if (!embeddedWallet) {
      setError('Embedded wallet not found');
      return false;
    }

    if (wallet?.isDelegated) {
      return true;
    }

    setIsDelegating(true);
    setError(null);

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

      // セッション署名者の追加が成功したら、ローカル状態を更新
      setDelegatedAddresses((prev) => {
        const newSet = new Set(prev);
        newSet.add(embeddedWallet.address.toLowerCase());
        return newSet;
      });

      console.log('Session signer added successfully:', embeddedWallet.address);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add session signer';

      // 重複エラーの場合（既に追加されている）、成功として扱う
      if (errorMessage.toLowerCase().includes('duplicate')) {
        console.log('Session signer already added (duplicate):', embeddedWallet.address);
        setDelegatedAddresses((prev) => {
          const newSet = new Set(prev);
          newSet.add(embeddedWallet.address.toLowerCase());
          return newSet;
        });
        return true;
      }

      console.error('Failed to add session signer:', err);
      setError(errorMessage);
      return false;
    } finally {
      setIsDelegating(false);
    }
  }, [embeddedWallet, wallet?.isDelegated, addSigners]);

  return useMemo(
    () => ({
      wallet,
      isDelegating,
      error,
      delegateWallet,
      isLoading: !ready,
    }),
    [wallet, isDelegating, error, delegateWallet, ready]
  );
}
