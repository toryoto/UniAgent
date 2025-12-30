'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { usePrivy } from '@privy-io/react-auth';
import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function WalletPage() {
  const { user } = usePrivy();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(user.wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AppLayout>
      <AuthGuard>
        <div className="min-h-screen bg-slate-950 p-8">
          <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-white">Wallet</h1>
              <p className="text-slate-400">ウォレット情報の確認と予算設定ができます</p>
            </div>

            <div className="space-y-6">
              {/* Wallet Info */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <h2 className="mb-4 text-xl font-bold text-white">Wallet Information</h2>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Wallet Address
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-white">
                        {user?.wallet?.address || 'No wallet connected'}
                      </div>
                      <button
                        onClick={handleCopy}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        title="Copy address"
                      >
                        {copied ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <Copy className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        ETH Balance
                      </label>
                      <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-2xl font-bold text-white">
                        0.0000 ETH
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-400">
                        USDC Balance
                      </label>
                      <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-2xl font-bold text-white">
                        0.00 USDC
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* USDC Section */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <h2 className="mb-4 text-xl font-bold text-white">USDC Setup</h2>

                <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                  <p className="text-sm text-blue-200">
                    エージェントを利用するには、USDCトークンが必要です。
                    Faucetページでテスト用のUSDCを取得してください。
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Base Sepolia USDC Contract
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-slate-400">
                        Coming soon...
                      </div>
                      <a
                        href="#"
                        className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        title="View on Etherscan"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    </div>
                  </div>

                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white opacity-50"
                  >
                    Approve USDC (Coming Soon)
                  </button>
                </div>
              </div>

              {/* Budget Settings */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <h2 className="mb-4 text-xl font-bold text-white">Budget Settings</h2>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Daily Limit (USDC)
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-400">
                      Auto-Approve Threshold (USDC)
                    </label>
                    <input
                      type="number"
                      placeholder="10"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      この金額以下の取引は自動的に承認されます
                    </p>
                  </div>

                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white opacity-50"
                  >
                    Save Settings (Coming Soon)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
