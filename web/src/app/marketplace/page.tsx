'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Search, Star } from 'lucide-react';
import { useState } from 'react';
import { useAgents } from '@/lib/hooks/useAgents';
import type { AgentCardDto } from '@/lib/types';
import { formatCategory, formatRating } from '@/lib/utils/format';

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');

  const { agents, total, isLoading, error, refetch } = useAgents({
    searchQuery,
    category: category || undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    sortBy: 'newest',
    sortOrder: 'desc',
  });

  return (
    <AppLayout>
      <div className="flex h-full flex-col bg-slate-950">
        <PageHeader
          title="Marketplace"
          description="エージェントを検索・発見してタスクに活用できます"
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
                    placeholder="エージェントを検索..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:py-3 md:pl-10 md:text-base"
                  />
                </div>
                <button
                  onClick={() => refetch()}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 md:w-auto md:px-6 md:py-3"
                >
                  更新
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                    Min Rating
                  </label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:px-4 md:text-base"
                  >
                    <option value="">Any Rating</option>
                    <option value="4">4+ Stars</option>
                    <option value="3">3+ Stars</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-400 md:text-sm">
                {isLoading ? '読み込み中...' : `該当: ${total} 件`}
              </div>
          </div>

            {/* Agent List */}
            <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>

            {/* Empty State */}
            {!isLoading && !error && agents.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center md:p-12">
                <div className="mb-4 text-4xl md:text-6xl">🤖</div>
                <h3 className="mb-2 text-lg font-bold text-white md:text-xl">
                  該当するエージェントがありません
                </h3>
                <p className="text-sm text-slate-400 md:text-base">
                  検索条件を調整して再度お試しください
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
      </div>
    </AppLayout>
  );
}

function AgentCard({ agent }: { agent: AgentCardDto }) {
  const price = agent.payment?.pricePerCallUsdc ?? 0;
  const category = agent.category ? formatCategory(agent.category) : 'unknown';
  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700 hover:shadow-xl hover:shadow-purple-500/10 md:p-6">
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

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs md:mb-4 md:gap-4 md:text-sm">
        <div className="flex items-center gap-1 text-yellow-400">
          <Star className="h-3 w-3 fill-current md:h-4 md:w-4" />
          <span className="font-medium">{formatRating(agent.averageRating)}</span>
        </div>
        <div className="text-slate-400">評価数 {agent.ratingCountDisplay}</div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-3 md:pt-4">
        <div>
          <div className="text-xs text-slate-400">Price</div>
          <div className="text-lg font-bold text-white md:text-xl">{price.toFixed(2)} USDC</div>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white/70 md:px-4 md:py-2 md:text-sm"
          title="PoCでは詳細画面は未実装です"
        >
          詳細
        </button>
      </div>
    </div>
  );
}
