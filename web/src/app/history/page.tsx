'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ExternalLink, Star } from 'lucide-react';

export default function HistoryPage() {
  return (
    <AppLayout>
      <AuthGuard>
        <div className="min-h-screen bg-slate-950 p-8">
          <div className="mx-auto max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-white">History</h1>
              <p className="text-slate-400">トランザクション履歴と評価を確認できます</p>
            </div>

            {/* Statistics */}
            <div className="mb-8 grid gap-6 md:grid-cols-3">
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
              <div className="border-b border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white">Transaction History</h2>
              </div>

              <div className="p-6">
                {/* Empty State */}
                <div className="py-12 text-center">
                  <div className="mb-4 text-6xl">📜</div>
                  <h3 className="mb-2 text-xl font-bold text-white">No transactions yet</h3>
                  <p className="mb-6 text-slate-400">
                    Start using agents in the Chat to see your transaction history
                  </p>
                  <a
                    href="/chat"
                    className="inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
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
      </AuthGuard>
    </AppLayout>
  );
}

function StatCard({ label, value, gradient }: { label: string; value: string; gradient: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-2 text-sm font-medium text-slate-400">{label}</div>
      <div
        className={`bg-gradient-to-r ${gradient} bg-clip-text text-3xl font-bold text-transparent`}
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
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-4">
      <div className="flex-1">
        <div className="mb-1 font-medium text-white">{agentName}</div>
        <div className="text-sm text-slate-400">{date}</div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-sm text-slate-400">Amount</div>
          <div className="font-bold text-white">{amount} USDC</div>
        </div>

        <div className="flex items-center gap-1 text-yellow-400">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-current' : ''}`} />
          ))}
        </div>

        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 transition-colors hover:text-purple-300"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
