/**
 * useBudgetSettings - Budget Settings 管理フック
 *
 * dailyLimit / autoApproveThreshold の取得・更新を管理する。
 */

import { useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth/authFetch';

export interface BudgetSettingsData {
  dailyLimit: number;
  autoApproveThreshold: number;
}

export interface UseBudgetSettingsReturn {
  settings: BudgetSettingsData;
  isLoading: boolean;
  error: string | null;
  updateSettings: (data: Partial<BudgetSettingsData>) => Promise<void>;
  isUpdating: boolean;
}

const DEFAULTS: BudgetSettingsData = {
  dailyLimit: 100,
  autoApproveThreshold: 1,
};

export function useBudgetSettings(): UseBudgetSettingsReturn {
  const { user, ready, getAccessToken } = usePrivy();
  const queryClient = useQueryClient();

  const isAuthenticated = !!user;

  const {
    data,
    isLoading: isLoadingQuery,
    error: queryError,
  } = useQuery({
    queryKey: ['budget-settings'],
    queryFn: async () => {
      const response = await authFetch('/api/wallet/budget', getAccessToken);
      if (!response.ok) {
        if (response.status === 404) return DEFAULTS;
        throw new Error('Failed to fetch budget settings');
      }
      return response.json() as Promise<BudgetSettingsData>;
    },
    enabled: isAuthenticated && ready,
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<BudgetSettingsData>) => {
      const response = await authFetch('/api/wallet/budget', getAccessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update budget settings');
      }

      return response.json() as Promise<BudgetSettingsData>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['budget-settings'], data);
    },
  });

  const updateSettings = useCallback(
    async (update: Partial<BudgetSettingsData>) => {
      await mutation.mutateAsync(update);
    },
    [mutation],
  );

  const settings = useMemo(() => data ?? DEFAULTS, [data]);

  const error = useMemo(() => {
    if (queryError) {
      return queryError instanceof Error
        ? queryError.message
        : 'Failed to load budget settings';
    }
    if (mutation.error) {
      return mutation.error instanceof Error
        ? mutation.error.message
        : 'Failed to update budget settings';
    }
    return null;
  }, [queryError, mutation.error]);

  return useMemo(
    () => ({
      settings,
      isLoading: !ready || isLoadingQuery,
      error,
      updateSettings,
      isUpdating: mutation.isPending,
    }),
    [settings, ready, isLoadingQuery, error, updateSettings, mutation.isPending],
  );
}
