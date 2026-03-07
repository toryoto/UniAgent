'use client';

import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { StakingPanel } from '@/components/agents/staking/staking-panel';
import { useDiscoverAgents } from '@/lib/hooks/useDiscoverAgents';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Coins, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default function StakingPage() {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address?.toLowerCase();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { agents, isLoading } = useDiscoverAgents({});

  // Filter agents owned by the current user
  const myAgents = useMemo(() => {
    if (!walletAddress) return [];
    return agents.filter((a) => a.owner.toLowerCase() === walletAddress);
  }, [agents, walletAddress]);

  const selectedAgent = myAgents.find((a) => a.agentId === selectedAgentId);

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col bg-slate-950">
          <PageHeader
            title="Agent Staking"
            description="Stake USDC on your agents to increase trust and discovery ranking"
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-4xl">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              ) : !walletAddress ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
                  <p className="text-slate-400">Connect your wallet to manage staking.</p>
                </div>
              ) : myAgents.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
                  <div className="mb-3 text-4xl">🤖</div>
                  <h3 className="mb-2 text-lg font-bold text-white">No Agents Found</h3>
                  <p className="text-sm text-slate-400">
                    You don&apos;t own any registered agents yet. Register an agent first to
                    start staking.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Agent Selector */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                    <h2 className="mb-3 text-lg font-bold text-white md:mb-4 md:text-xl">
                      Your Agents
                    </h2>
                    <div className="space-y-2">
                      {myAgents.map((agent) => (
                        <button
                          key={agent.agentId}
                          onClick={() => setSelectedAgentId(agent.agentId)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors md:p-4',
                            selectedAgentId === agent.agentId
                              ? 'border-purple-500/50 bg-purple-500/10'
                              : 'border-slate-800 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/50'
                          )}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-lg">
                            🤖
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-white">{agent.name}</div>
                            <div className="truncate text-xs text-slate-400">
                              ID: {agent.agentId}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(agent.stakedAmount ?? 0) > 0 && (
                              <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-300">
                                <Coins className="h-3 w-3" />
                                {(agent.stakedAmount ?? 0).toFixed(2)}
                              </span>
                            )}
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 text-slate-500',
                                selectedAgentId === agent.agentId && 'text-purple-400'
                              )}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Staking Panel */}
                  {selectedAgent && (
                    <StakingPanel
                      agentId={selectedAgent.agentId}
                      agentName={selectedAgent.name}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
