'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Search, Star } from 'lucide-react';
import { useState } from 'react';

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-white">Marketplace</h1>
            <p className="text-slate-400">エージェントを検索・発見してタスクに活用できます</p>
          </div>

          {/* Search & Filters */}
          <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-4 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="エージェントを検索..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <button className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700">
                Search
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Category</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  <option value="">All Categories</option>
                  <option value="travel">Travel</option>
                  <option value="research">Research</option>
                  <option value="data">Data Analysis</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">
                  Max Price (USDC)
                </label>
                <input
                  type="number"
                  placeholder="10"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-400">Min Rating</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  <option value="">Any Rating</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                </select>
              </div>
            </div>
          </div>

          {/* Agent List */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Placeholder agents */}
            <AgentCard
              name="Flight Search Agent"
              description="Search and compare flight prices from multiple airlines"
              category="travel"
              price={2.5}
              rating={4.5}
              usageCount={156}
            />
            <AgentCard
              name="Hotel Finder"
              description="Find the best hotels based on your preferences"
              category="travel"
              price={1.8}
              rating={4.7}
              usageCount={203}
            />
            <AgentCard
              name="Tourism Guide"
              description="Get personalized travel recommendations"
              category="travel"
              price={1.2}
              rating={4.3}
              usageCount={89}
            />
          </div>

          {/* Empty State */}
          {false && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <div className="mb-4 text-6xl">🤖</div>
              <h3 className="mb-2 text-xl font-bold text-white">No agents found</h3>
              <p className="text-slate-400">Try adjusting your search filters</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function AgentCard({
  name,
  description,
  category,
  price,
  rating,
  usageCount,
}: {
  name: string;
  description: string;
  category: string;
  price: number;
  rating: number;
  usageCount: number;
}) {
  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-slate-700 hover:shadow-xl hover:shadow-purple-500/10">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 text-2xl">
          🤖
        </div>
        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
          {category}
        </span>
      </div>

      <h3 className="mb-2 text-lg font-bold text-white">{name}</h3>
      <p className="mb-4 text-sm text-slate-400">{description}</p>

      <div className="mb-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-yellow-400">
          <Star className="h-4 w-4 fill-current" />
          <span className="font-medium">{rating}</span>
        </div>
        <div className="text-slate-400">{usageCount} uses</div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <div>
          <div className="text-xs text-slate-400">Price</div>
          <div className="text-xl font-bold text-white">{price} USDC</div>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700">
          View Details
        </button>
      </div>
    </div>
  );
}
