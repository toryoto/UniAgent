'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { usePrivy } from '@privy-io/react-auth';
import { Copy, Droplet, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useFaucet } from '@/lib/hooks/useFaucet';

export default function FaucetPage() {
  const { user } = usePrivy();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const { requestUSDC, usdcStatus, usdcMessage, usdcTxHash } = useFaucet();

  const handleCopyAddress = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(user.wallet.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleRequestUSDC = async () => {
    if (!user?.wallet?.address) return;
    try {
      await requestUSDC(user.wallet.address);
    } catch (error) {
      // エラーはuseFaucetフック内で処理される
      console.error('Failed to request USDC:', error);
    }
  };

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col bg-slate-950">
          <PageHeader title="Faucet" description="Request testnet USDC for your wallet" />
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-4xl">
              {/* Wallet Address */}
              <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:mb-8 md:p-6">
                <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                  Your Wallet Address
                </label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white md:px-4 md:py-3 md:text-sm">
                    <span className="block truncate">
                      {user?.wallet?.address || 'No wallet connected'}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white md:p-3"
                    title="Copy address"
                  >
                    {copiedAddress ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <Copy className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6">
                {/* Base Sepolia USDC Faucet */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                  <div className="mb-3 flex items-center gap-2 md:mb-4 md:gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 md:h-12 md:w-12">
                      <Droplet className="h-5 w-5 text-white md:h-6 md:w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white md:text-xl">Base Sepolia USDC</h2>
                      <p className="text-xs text-slate-400 md:text-sm">
                        Get USDC tokens for testing agent payments
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleRequestUSDC}
                    disabled={usdcStatus === 'loading' || !user?.wallet?.address}
                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
                  >
                    {usdcStatus === 'loading' ? 'Requesting...' : 'Request USDC'}
                  </button>

                  {usdcMessage && (
                    <div
                      className={`mt-3 flex items-start gap-2 rounded-lg p-3 md:mt-4 md:gap-2 md:p-4 ${
                        usdcStatus === 'success'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {usdcStatus === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 md:h-5 md:w-5" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 md:h-5 md:w-5" />
                      )}
                      <div className="flex-1">
                        <span className="text-xs md:text-sm">{usdcMessage}</span>
                        {usdcTxHash && usdcStatus === 'success' && (
                          <div className="mt-2 flex items-center gap-2">
                            <a
                              href={`https://sepolia.basescan.org/tx/${usdcTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-green-300 transition-colors hover:text-green-200 hover:underline"
                            >
                              <span className="font-mono">
                                {usdcTxHash.slice(0, 10)}...{usdcTxHash.slice(-8)}
                              </span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rate Limit Rules */}
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 md:p-6">
                  <h3 className="mb-2 text-sm font-bold text-yellow-300 md:mb-3 md:text-base">
                    Rate Limit Rules
                  </h3>
                  <ul className="space-y-1.5 text-xs text-yellow-200/80 md:space-y-2 md:text-sm">
                    <li className="flex gap-2">
                      <span className="font-bold">•</span>
                      <span>Each wallet address can request USDC once per 24 hours</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold">•</span>
                      <span>Each IP address can request USDC up to 3 times per 24 hours</span>
                    </li>
                  </ul>
                </div>

                {/* Instructions */}
                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 md:p-6">
                  <h3 className="mb-2 text-sm font-bold text-purple-300 md:mb-3 md:text-base">
                    Instructions
                  </h3>
                  <ol className="space-y-1.5 text-xs text-purple-200/80 md:space-y-2 md:text-sm">
                    <li className="flex gap-2">
                      <span className="font-bold">1.</span>
                      <span>Request USDC tokens to pay for agent services</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold">2.</span>
                      <span>You&apos;re ready to use agents in the Chat!</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
