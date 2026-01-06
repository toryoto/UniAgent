'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ExternalLink, Star } from 'lucide-react';

export default function HistoryPage() {
  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col bg-slate-950">
          <PageHeader
            title="(WIP) History"
            description="トランザクション履歴と評価を確認できます"
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
              {/* Statistics */}
              <div className="mb-6 grid gap-4 md:mb-8 md:grid-cols-3 md:gap-6">
                <StatCard
                  label="Total Spent"
                  value="0.00 USDC"
                  gradient="from-blue-500 to-cyan-500"
                />
                <StatCard
                  label="Total Transactions"
                  value="0"
                  gradient="from-purple-500 to-pink-500"
                />
                <StatCard
                  label="Average Rating"
                  value="N/A"
                  gradient="from-yellow-500 to-orange-500"
                />
              </div>

              {/* Transactions */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="border-b border-slate-800 p-4 md:p-6">
                  <h2 className="text-lg font-bold text-white md:text-xl">Transaction History</h2>
                </div>

                <div className="p-4 md:p-6">
                  {/* Empty State */}
                  <div className="py-8 text-center md:py-12">
                    <div className="mb-4 text-4xl md:text-6xl">📜</div>
                    <h3 className="mb-2 text-lg font-bold text-white md:text-xl">
                      No transactions yet
                    </h3>
                    <p className="mb-4 text-sm text-slate-400 md:mb-6 md:text-base">
                      Start using agents in the Chat to see your transaction history
                    </p>
                    <a
                      href="/chat"
                      className="inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 md:px-6 md:py-3"
                    >
                      Go to Chat
                    </a>
                  </div>

                  {/* Transaction rows will go here */}
                  {false && (
                    <div className="space-y-4">
                      <TransactionRow
                        date="2025-01-01 12:00"
                        agentName="Flight Search Agent"
                        amount={2.5}
                        rating={5}
                        txHash="0x1234...5678"
                        status="completed"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}

function StatCard({ label, value, gradient }: { label: string; value: string; gradient: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
      <div className="mb-2 text-xs font-medium text-slate-400 md:text-sm">{label}</div>
      <div
        className={`bg-gradient-to-r ${gradient} bg-clip-text text-2xl font-bold text-transparent md:text-3xl`}
      >
        {value}
      </div>
    </div>
  );
}

function TransactionRow({
  date,
  agentName,
  amount,
  rating,
  txHash,
  status,
}: {
  date: string;
  agentName: string;
  amount: number;
  rating: number;
  txHash: string;
  status: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-800/50 p-3 md:flex-row md:items-center md:justify-between md:gap-6 md:p-4">
      <div className="flex-1">
        <div className="mb-1 text-sm font-medium text-white md:text-base">{agentName}</div>
        <div className="text-xs text-slate-400 md:text-sm">{date}</div>
      </div>

      <div className="flex items-center justify-between gap-4 md:gap-6">
        <div className="text-left md:text-right">
          <div className="text-xs text-slate-400 md:text-sm">Amount</div>
          <div className="text-sm font-bold text-white md:text-base">{amount} USDC</div>
        </div>

        <div className="flex items-center gap-0.5 text-yellow-400 md:gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`h-3 w-3 md:h-4 md:w-4 ${i < rating ? 'fill-current' : ''}`} />
          ))}
        </div>

        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 transition-colors hover:text-purple-300"
        >
          <ExternalLink className="h-4 w-4 md:h-5 md:w-5" />
        </a>
      </div>
    </div>
  );
}
