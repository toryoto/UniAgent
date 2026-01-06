'use client';

import { AppLayout } from '@/components/layout/app-layout';
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
        <div className="min-h-screen bg-slate-950 p-8">
          <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-white">Faucet</h1>
              <p className="text-slate-400">Request testnet USDC for your wallet</p>
            </div>

            {/* Wallet Address */}
            <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <label className="mb-2 block text-sm font-medium text-slate-400">
                Your Wallet Address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-white">
                  {user?.wallet?.address || 'No wallet connected'}
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                  title="Copy address"
                >
                  {copiedAddress ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Base Sepolia USDC Faucet */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                    <Droplet className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Base Sepolia USDC</h2>
                    <p className="text-sm text-slate-400">
                      Get USDC tokens for testing agent payments
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRequestUSDC}
                  disabled={usdcStatus === 'loading' || !user?.wallet?.address}
                  className="w-full rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {usdcStatus === 'loading' ? 'Requesting...' : 'Request USDC'}
                </button>

                {usdcMessage && (
                  <div
                    className={`mt-4 flex items-center gap-2 rounded-lg p-4 ${
                      usdcStatus === 'success'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {usdcStatus === 'success' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    <div className="flex-1">
                      <span className="text-sm">{usdcMessage}</span>
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
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
                <h3 className="mb-3 font-bold text-yellow-300">Rate Limit Rules</h3>
                <ul className="space-y-2 text-sm text-yellow-200/80">
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
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
                <h3 className="mb-3 font-bold text-purple-300">Instructions</h3>
                <ol className="space-y-2 text-sm text-purple-200/80">
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
      </AuthGuard>
    </AppLayout>
  );
}
