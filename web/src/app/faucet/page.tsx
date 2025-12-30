'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { usePrivy } from '@privy-io/react-auth';
import { Copy, Droplet, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';

type FaucetStatus = 'idle' | 'loading' | 'success' | 'error';

export default function FaucetPage() {
  const { user } = usePrivy();
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Faucet request states
  const [ethStatus, setEthStatus] = useState<FaucetStatus>('idle');
  const [usdcStatus, setUsdcStatus] = useState<FaucetStatus>('idle');
  const [ethMessage, setEthMessage] = useState('');
  const [usdcMessage, setUsdcMessage] = useState('');

  const handleCopyAddress = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(user.wallet.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleRequestETH = async () => {
    if (!user?.wallet?.address) return;

    setEthStatus('loading');
    setEthMessage('');

    try {
      const response = await fetch('/api/faucet/eth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: user.wallet.address,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setEthStatus('success');
        setEthMessage(data.message || 'ETH successfully sent!');
      } else {
        setEthStatus('error');
        setEthMessage(data.error || 'Failed to request ETH');
      }
    } catch (error) {
      setEthStatus('error');
      setEthMessage('Network error. Please try again.');
    }
  };

  const handleRequestUSDC = async () => {
    if (!user?.wallet?.address) return;

    setUsdcStatus('loading');
    setUsdcMessage('');

    try {
      const response = await fetch('/api/faucet/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: user.wallet.address,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsdcStatus('success');
        setUsdcMessage(data.message || 'USDC successfully sent!');
      } else {
        setUsdcStatus('error');
        setUsdcMessage(data.error || 'Failed to request USDC');
      }
    } catch (error) {
      setUsdcStatus('error');
      setUsdcMessage('Network error. Please try again.');
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
              <p className="text-slate-400">Request testnet ETH and USDC for your wallet</p>
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
              {/* Base Sepolia ETH Faucet */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                    <Droplet className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Base Sepolia ETH</h2>
                    <p className="text-sm text-slate-400">
                      Get ETH for gas fees on Base Sepolia testnet
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRequestETH}
                  disabled={ethStatus === 'loading' || !user?.wallet?.address}
                  className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ethStatus === 'loading' ? 'Requesting...' : 'Request ETH'}
                </button>

                {ethMessage && (
                  <div
                    className={`mt-4 flex items-center gap-2 rounded-lg p-4 ${
                      ethStatus === 'success'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {ethStatus === 'success' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    <span className="text-sm">{ethMessage}</span>
                  </div>
                )}
              </div>

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
                    <span className="text-sm">{usdcMessage}</span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
                <h3 className="mb-3 font-bold text-purple-300">Instructions</h3>
                <ol className="space-y-2 text-sm text-purple-200/80">
                  <li className="flex gap-2">
                    <span className="font-bold">1.</span>
                    <span>First, request ETH to cover gas fees for transactions</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">2.</span>
                    <span>Then, request USDC tokens to pay for agent services</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">3.</span>
                    <span>Go to Wallet page to approve USDC spending</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">4.</span>
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
