import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@/lib/types';
import type { AttestationsApiResponse } from '@/app/api/agents/[agentId]/attestations/route';

export function useAgentAttestations(agentId: string | null) {
  const query = useQuery({
    queryKey: ['agent-attestations', agentId],
    queryFn: async (): Promise<AttestationsApiResponse> => {
      const res = await fetch(`/api/agents/${agentId}/attestations`);
      const json = (await res.json()) as ApiResponse<AttestationsApiResponse>;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'Failed to fetch attestations');
      }
      return json.data;
    },
    enabled: !!agentId,
  });

  return {
    attestations: query.data?.attestations ?? [],
    summary: query.data?.summary ?? {
      count: 0,
      avgQuality: 0,
      avgReliability: 0,
      avgLatency: 0,
    },
    isLoading: query.isLoading,
    error:
      query.error instanceof Error
        ? query.error.message
        : query.error
          ? String(query.error)
          : null,
  };
}
