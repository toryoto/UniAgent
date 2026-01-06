import { useMutation } from '@tanstack/react-query';

export interface FaucetResponse {
  status?: 'success';
  success?: boolean;
  message: string;
  txHash?: string;
  amount?: string;
  error?: string;
  reason?: string;
}

export interface UseFaucetReturn {
  requestUSDC: (walletAddress: string) => Promise<void>;
  usdcStatus: 'idle' | 'loading' | 'success' | 'error';
  usdcMessage: string;
  usdcTxHash: string | null;
  usdcError: Error | null;
}

export function useFaucet(): UseFaucetReturn {
  const usdcMutation = useMutation<FaucetResponse, Error, string>({
    mutationFn: async (walletAddress: string) => {
      const response = await fetch('/api/faucet/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.reason || 'Failed to request USDC');
      }

      return data;
    },
  });

  const requestUSDC = async (walletAddress: string) => {
    if (!walletAddress) {
      throw new Error('Wallet address is required');
    }
    await usdcMutation.mutateAsync(walletAddress);
  };

  // USDC状態の計算
  const usdcStatus: 'idle' | 'loading' | 'success' | 'error' =
    usdcMutation.status === 'pending' ? 'loading' : usdcMutation.status;

  const usdcMessage = usdcMutation.data?.message || usdcMutation.error?.message || '';
  const usdcTxHash = usdcMutation.data?.txHash || null;

  return {
    requestUSDC,
    usdcStatus,
    usdcMessage,
    usdcTxHash,
    usdcError: usdcMutation.error,
  };
}
