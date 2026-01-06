'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { usePrivy } from '@privy-io/react-auth';
import { Copy, ExternalLink, Shield, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useDelegatedWallet } from '@/lib/hooks/useDelegatedWallet';
import { useBalance, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, formatUSDCAmount, ERC20_ABI } from '@/lib/blockchain/config';
import { formatEther } from 'viem';

export default function WalletPage() {
  const { user } = usePrivy();
  const {
    wallet,
    isDelegating,
    error: delegationError,
    delegateWallet,
    undelegateWallet,
    isLoading,
  } = useDelegatedWallet();
  const [copied, setCopied] = useState(false);
  const [walletIdCopied, setWalletIdCopied] = useState(false);

  const walletAddress = (wallet?.address || user?.wallet?.address) as `0x${string}` | undefined;

  // Get ETH balance
  const { data: ethBalance, isLoading: isLoadingEth } = useBalance({
    address: walletAddress,
    query: {
      enabled: !!walletAddress,
      refetchInterval: 10000,
    },
  });

  // Get USDC balance
  const { data: usdcBalance, isLoading: isLoadingUsdc } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: {
      enabled: !!walletAddress,
      refetchInterval: 10000,
    },
  });

  const handleCopy = () => {
    if (user?.wallet?.address) {
      navigator.clipboard.writeText(user.wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyWalletId = () => {
    if (wallet?.walletId) {
      navigator.clipboard.writeText(wallet.walletId);
      setWalletIdCopied(true);
      setTimeout(() => setWalletIdCopied(false), 2000);
    }
  };

  const handleDelegate = async () => {
    await delegateWallet();
  };

  const handleUndelegate = async () => {
    await undelegateWallet();
  };

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col bg-slate-950">
          <PageHeader
            title="Wallet"
            description="View your wallet information and configure budget settings"
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-4xl">
              <div className="space-y-4 md:space-y-6">
                {/* Wallet Info */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                  <h2 className="mb-3 text-lg font-bold text-white md:mb-4 md:text-xl">
                    Wallet Information
                  </h2>

                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                        Wallet Address
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white md:px-4 md:py-3 md:text-sm">
                          <span className="block truncate">
                            {user?.wallet?.address || 'No wallet connected'}
                          </span>
                        </div>
                        <button
                          onClick={handleCopy}
                          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white md:p-3"
                          title="Copy address"
                        >
                          {copied ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <Copy className="h-4 w-4 md:h-5 md:w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Wallet ID for Server Delegation */}
                    {wallet && (
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                          Wallet ID (for x402 payments)
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-[10px] text-slate-300 md:px-4 md:py-3 md:text-xs">
                            <span className="block break-all">{wallet.walletId}</span>
                          </div>
                          <button
                            onClick={handleCopyWalletId}
                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white md:p-3"
                            title="Copy Wallet ID"
                          >
                            {walletIdCopied ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <Copy className="h-4 w-4 md:h-5 md:w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                          ETH Balance
                        </label>
                        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-lg font-bold text-white md:px-4 md:py-3 md:text-2xl">
                          {isLoadingEth ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                              <span className="text-sm md:text-lg">Loading...</span>
                            </div>
                          ) : ethBalance ? (
                            `${parseFloat(formatEther(ethBalance.value)).toFixed(4)} ETH`
                          ) : (
                            '0.0000 ETH'
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                          USDC Balance
                        </label>
                        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-lg font-bold text-white md:px-4 md:py-3 md:text-2xl">
                          {isLoadingUsdc ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                              <span className="text-sm md:text-lg">Loading...</span>
                            </div>
                          ) : usdcBalance ? (
                            `${formatUSDCAmount(usdcBalance).toFixed(2)} USDC`
                          ) : (
                            '0.00 USDC'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Server Delegation */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white md:mb-4 md:text-xl">
                    {wallet?.isDelegated ? (
                      <ShieldCheck className="h-5 w-5 text-green-400 md:h-6 md:w-6" />
                    ) : (
                      <Shield className="h-5 w-5 text-yellow-400 md:h-6 md:w-6" />
                    )}
                    Server Delegation
                  </h2>

                  {isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 md:text-sm">
                      <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                      <span>Loading wallet status...</span>
                    </div>
                  ) : wallet?.isDelegated ? (
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 md:gap-3 md:p-4">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400 md:h-5 md:w-5" />
                        <div>
                          <p className="text-sm font-medium text-green-200 md:text-base">
                            Delegation Active
                          </p>
                          <p className="mt-1 text-xs text-green-200/70 md:text-sm">
                            Your wallet is delegated to the server. AI agents can now execute x402
                            payments on your behalf.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleUndelegate}
                        disabled={isDelegating || !wallet}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
                      >
                        {isDelegating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                            Removing delegation...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 md:h-5 md:w-5" />
                            Remove Delegation
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 md:space-y-4">
                      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 md:p-4">
                        <p className="text-xs text-yellow-200 md:text-sm">
                          <strong>Important:</strong> To enable AI agents to make x402 payments on
                          your behalf, you need to delegate your wallet to the server. This allows
                          the server to sign payment transactions without requiring your approval
                          for each transaction.
                        </p>
                      </div>

                      {delegationError && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 md:gap-3 md:p-4">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400 md:h-5 md:w-5" />
                          <div>
                            <p className="text-xs text-red-200 md:text-sm">{delegationError}</p>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleDelegate}
                        disabled={isDelegating || !wallet}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-6 md:py-3"
                      >
                        {isDelegating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />
                            Delegating...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 md:h-5 md:w-5" />
                            Delegate Wallet to Server
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* USDC Section */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                  <h2 className="mb-3 text-lg font-bold text-white md:mb-4 md:text-xl">
                    USDC Setup
                  </h2>

                  <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 md:mb-4 md:p-4">
                    <p className="text-xs text-blue-200 md:text-sm">
                      You need USDC tokens to use agents. Get USDC from the Faucet page.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                        Base Sepolia USDC Contract
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-300 md:px-4 md:py-3 md:text-sm">
                          <span className="block truncate">{CONTRACT_ADDRESSES.USDC}</span>
                        </div>
                        <a
                          href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESSES.USDC}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white md:p-3"
                          title="View on Basescan"
                        >
                          <ExternalLink className="h-4 w-4 md:h-5 md:w-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Budget Settings */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                  <h2 className="mb-3 text-lg font-bold text-white md:mb-4 md:text-xl">
                    Budget Settings
                  </h2>

                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                        Daily Limit (USDC)
                      </label>
                      <input
                        type="number"
                        placeholder="100"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:px-4 md:py-3 md:text-base"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-400 md:text-sm">
                        Auto-Approve Threshold (USDC)
                      </label>
                      <input
                        type="number"
                        placeholder="10"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:px-4 md:py-3 md:text-base"
                      />
                      <p className="mt-2 text-xs text-slate-500 md:text-sm">
                        Transactions below this amount will be automatically approved
                      </p>
                    </div>

                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white opacity-50 md:px-6 md:py-3"
                    >
                      Save Settings (Coming Soon)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    </AppLayout>
  );
}
