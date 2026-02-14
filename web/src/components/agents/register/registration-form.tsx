'use client';

import { Loader2, ExternalLink, ArrowLeft, ArrowRight } from 'lucide-react';
import { ServiceForm } from './service-form';
import { BLOCK_EXPLORER_URL } from '@/lib/blockchain/config';
import type { useAgentRegistration } from '@/lib/hooks/useAgentRegistration';

type RegistrationHook = ReturnType<typeof useAgentRegistration>;

interface RegistrationFormProps {
  reg: RegistrationHook;
  disabled: boolean;
}

export function RegistrationForm({ reg, disabled }: RegistrationFormProps) {
  const {
    formData,
    updateFormData,
    currentStep,
    setCurrentStep,
    uploadToIpfs,
    ipfsUri,
    isUploading,
    uploadError,
    registerOnChain,
    registerTxHash,
    isRegistering,
    isRegisterConfirming,
    registerError,
    agentId,
    setAgentWalletOnChain,
    walletTxHash,
    isSettingWallet,
    isWalletConfirming,
    walletError,
    address,
  } = reg;

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return url.startsWith('https://') || url.startsWith('http://');
    } catch {
      return false;
    }
  };

  const isStep1Valid =
    formData.name.trim() !== '' &&
    formData.description.trim() !== '' &&
    formData.image.trim() !== '' &&
    isValidUrl(formData.image) &&
    formData.services.some((s) =>
      s.name.trim() && s.endpoint.trim() && isValidUrl(s.endpoint)
    );

  if (currentStep === 1) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              disabled={disabled}
              placeholder="e.g. FlightFinderPro"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => updateFormData({ category: e.target.value })}
              disabled={disabled}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">Select category</option>
              <option value="travel">Travel</option>
              <option value="finance">Finance</option>
              <option value="productivity">Productivity</option>
              <option value="development">Development</option>
              <option value="data">Data</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => updateFormData({ description: e.target.value })}
            disabled={disabled}
            placeholder="Describe what your agent does..."
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Image URL *
          </label>
          <input
            type="url"
            value={formData.image}
            onChange={(e) => updateFormData({ image: e.target.value })}
            disabled={disabled}
            placeholder="https://example.com/agent-icon.png"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={formData.x402Support}
              onChange={(e) =>
                updateFormData({ x402Support: e.target.checked })
              }
              disabled={disabled}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-slate-600 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-purple-600 peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm text-slate-300">
            x402 Payment Support
          </span>
        </div>

        <ServiceForm
          services={formData.services}
          onChange={(services) => updateFormData({ services })}
        />

        <div className="flex justify-end pt-2">
          <button
            onClick={() => setCurrentStep(2)}
            disabled={disabled || !isStep1Valid}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Review & Upload
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h4 className="mb-2 text-sm font-medium text-slate-300">
            Metadata Preview
          </h4>
          <pre className="max-h-60 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">
            {JSON.stringify(
              {
                type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
                name: formData.name,
                description: formData.description,
                image: formData.image,
                services: formData.services.filter(
                  (s) => s.name && s.endpoint
                ),
                x402Support: formData.x402Support,
                active: true,
                category: formData.category || undefined,
              },
              null,
              2
            )}
          </pre>
        </div>

        {uploadError && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {uploadError}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={uploadToIpfs}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload to IPFS'
            )}
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    return (
      <div className="space-y-4">
        {ipfsUri && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <span className="text-xs text-slate-400">IPFS URI</span>
            <p className="mt-1 break-all font-mono text-sm text-purple-300">
              {ipfsUri}
            </p>
          </div>
        )}

        {registerTxHash && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <span className="text-xs text-slate-400">Transaction</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-slate-300">
                {String(registerTxHash).slice(0, 14)}...{String(registerTxHash).slice(-10)}
              </span>
              <a
                href={`${BLOCK_EXPLORER_URL}/tx/${String(registerTxHash)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {isRegisterConfirming && (
              <div className="mt-2 flex items-center gap-2 text-xs text-yellow-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for confirmation...
              </div>
            )}
          </div>
        )}

        {registerError && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {registerError}
          </div>
        )}

        {!registerTxHash && (
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={registerOnChain}
              disabled={isRegistering}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register on Blockchain'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (currentStep === 4) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="mb-3 text-sm text-slate-300">
            Set a wallet address to receive x402 payments. You can skip this
            step and set it later.
          </p>
          <label className="mb-1 block text-xs text-slate-400">
            Agent Wallet Address
          </label>
          <input
            type="text"
            value={formData.agentWallet}
            onChange={(e) => updateFormData({ agentWallet: e.target.value })}
            placeholder={address || '0x...'}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {walletTxHash && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <span className="text-xs text-slate-400">Transaction</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-slate-300">
                {String(walletTxHash).slice(0, 14)}...{String(walletTxHash).slice(-10)}
              </span>
              <a
                href={`${BLOCK_EXPLORER_URL}/tx/${String(walletTxHash)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {isWalletConfirming && (
              <div className="mt-2 flex items-center gap-2 text-xs text-yellow-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for confirmation...
              </div>
            )}
          </div>
        )}

        {walletError && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {walletError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setCurrentStep(5)}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            Skip
          </button>
          <button
            onClick={() => {
              const wallet = formData.agentWallet || address;
              if (wallet) setAgentWalletOnChain(wallet);
            }}
            disabled={
              isSettingWallet ||
              (!formData.agentWallet && !address)
            }
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSettingWallet ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting Wallet...
              </>
            ) : (
              'Set Agent Wallet'
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
