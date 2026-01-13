import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DiscoveryApiResponse, MarketplaceFilters } from '@/lib/types';
import { useDebouncedValue } from './useDebouncedValue';

function buildDiscoveryAgentsQuery(filters: MarketplaceFilters): string {
  const sp = new URLSearchParams();

  const q = (filters.searchQuery ?? '').trim();
  if (q) sp.set('q', q);
  if (filters.category) sp.set('category', filters.category);

  if (typeof filters.maxPrice === 'number' && Number.isFinite(filters.maxPrice)) {
    sp.set('maxPrice', String(filters.maxPrice));
  }
  if (typeof filters.minRating === 'number' && Number.isFinite(filters.minRating)) {
    sp.set('minRating', String(filters.minRating));
  }

  if (filters.sortBy) sp.set('sortBy', filters.sortBy);
  if (filters.sortOrder) sp.set('sortOrder', filters.sortOrder);

  return sp.toString();
}

export function useDiscoverAgents(filters: MarketplaceFilters) {
  // searchQueryだけは入力中のリクエスト連打を避ける
  const debouncedQuery = useDebouncedValue(filters.searchQuery ?? '', 250);

  const stableFilters = useMemo(
    () => ({ ...filters, searchQuery: debouncedQuery }),
    [filters, debouncedQuery]
  );

  const queryString = useMemo(() => buildDiscoveryAgentsQuery(stableFilters), [stableFilters]);
  const url = queryString ? `/api/discovery/agents?${queryString}` : '/api/discovery/agents';

  const query = useQuery({
    queryKey: ['discovery-agents', queryString],
    queryFn: async (): Promise<DiscoveryApiResponse> => {
      const res = await fetch(url, { method: 'GET' });
      const json = (await res.json()) as ApiResponse<DiscoveryApiResponse>;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'Failed to fetch agents');
      }
      return json.data;
    },
  });

  return {
    agents: query.data?.agents ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error:
      query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}
