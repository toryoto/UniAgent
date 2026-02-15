'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Copy, Search } from 'lucide-react';
import { useState } from 'react';
import { useDiscoverAgents } from '@/lib/hooks/useDiscoverAgents';
import type { DiscoveredAgent } from '@agent-marketplace/shared';
import { formatCategory } from '@/lib/utils/format';
import { AgentDetailModal } from '@/components/marketplace/agent-detail-modal';

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<DiscoveredAgent | null>(null);

  const { agents, total, isLoading, error, refetch } = useDiscoverAgents({
    searchQuery,
    category: category || undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    sortBy: 'newest',
    sortOrder: 'desc',
  });

  return (
    <AppLayout>
      <div className="flex h-full flex-col bg-slate-950">
        <PageHeader
          title="Marketplace"
          description="Search and discover agents to use for your tasks"
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            {/* Search & Filters */}
            <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 md:h-5 md:w-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search agents..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:py-3 md:pl-10 md:text-base"
                  />
                </div>
                <button
                  onClick={() => refetch()}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 md:w-auto md:px-6 md:py-3"
                >
                  Refresh
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:px-4 md:text-base"
                  >
                    <option value="">All Categories</option>
                    <option value="travel">Travel</option>
                    <option value="research">Research</option>
                    <option value="data">Data Analysis</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                    Max Price (USDC)
                  </label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:px-4 md:text-base"
                  />
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-400 md:text-sm">
                {isLoading ? 'Loading...' : `Found: ${total} agents`}
              </div>
            </div>

            {/* Agent List */}
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agentId}
                  agent={agent}
                  onClick={() => setSelectedAgent(agent)}
                />
              ))}
            </div>

            {/* Empty State */}
            {!isLoading && !error && agents.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center md:p-12">
                <div className="mb-4 text-4xl md:text-6xl">🤖</div>
                <h3 className="mb-2 text-lg font-bold text-white md:text-xl">No agents found</h3>
                <p className="text-sm text-slate-400 md:text-base">
                  Try adjusting your search filters
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-200 md:p-4 md:text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {selectedAgent && (
          <AgentDetailModal
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function AgentCard({
  agent,
  onClick,
}: {
  agent: DiscoveredAgent;
  onClick: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const category = agent.category ? formatCategory(agent.category) : 'unknown';

  const handleCopyAgentId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(agent.agentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy agent ID:', error);
    }
  };

  return (
    <div
      onClick={onClick}
      className="group w-full min-w-0 cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700 hover:shadow-xl hover:shadow-purple-500/10 md:p-6"
    >
      <div className="mb-3 flex items-start justify-between md:mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-purple-600 to-blue-600 text-xl md:h-12 md:w-12 md:text-2xl">
          🤖
        </div>
        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-300 md:px-3 md:py-1">
          {category}
        </span>
      </div>

      <h3 className="mb-2 text-base font-bold text-white md:text-lg">{agent.name}</h3>
      <p className="mb-3 text-xs text-slate-400 md:mb-4 md:text-sm">{agent.description}</p>

      {agent.skills && agent.skills.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 md:mb-4">
          {agent.skills.map((skill) => (
            <span
              key={skill.id}
              className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-300"
            >
              {skill.name}
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1.5 md:mb-4">
        <span className="min-w-0 flex-1 truncate text-xs font-mono text-slate-400 md:text-sm">
          {agent.agentId}
        </span>
        <button
          onClick={handleCopyAgentId}
          className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          title={copied ? 'Copied!' : 'Copy Agent ID'}
        >
          <Copy className={`h-3 w-3 md:h-4 md:w-4 ${copied ? 'text-green-400' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-3 md:pt-4">
        <div>
          <div className="text-xs text-slate-400">Price</div>
          <div className="text-lg font-bold text-white md:text-xl">{agent.price.toFixed(2)} USDC</div>
        </div>
        {agent.x402Support && (
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-300">
            x402
          </span>
        )}
      </div>
    </div>
  );
}
