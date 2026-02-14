'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { RegistrationStepper } from '@/components/agents/register/registration-stepper';
import { RegistrationGuards } from '@/components/agents/register/registration-guards';
import { RegistrationForm } from '@/components/agents/register/registration-form';
import { RegistrationSuccess } from '@/components/agents/register/registration-success';
import { useRegistrationGuards } from '@/lib/hooks/useRegistrationGuards';
import { useAgentRegistration } from '@/lib/hooks/useAgentRegistration';

export default function AgentRegisterPage() {
  const { guards, allPassed, isChecking } = useRegistrationGuards();
  const reg = useAgentRegistration();

  const isCompleted =
    reg.agentId !== null && (reg.currentStep === 5 || reg.walletConfirmed);

  return (
    <AppLayout>
      <AuthGuard>
        <div className="flex h-full flex-col bg-slate-950">
          <PageHeader
            title="Register Agent"
            description="Register your AI agent on the ERC-8004 Identity Registry"
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <RegistrationGuards guards={guards} isChecking={isChecking} />

              {!isCompleted && (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                    <RegistrationStepper currentStep={reg.currentStep} />
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-6">
                    <RegistrationForm reg={reg} disabled={!allPassed} />
                  </div>
                </>
              )}

              {isCompleted && reg.agentId && (
                <RegistrationSuccess
                  agentId={reg.agentId}
                  registerTxHash={
                    reg.registerTxHash
                      ? String(reg.registerTxHash)
                      : undefined
                  }
                  walletTxHash={
                    reg.walletTxHash
                      ? String(reg.walletTxHash)
                      : undefined
                  }
                  ipfsUri={reg.ipfsUri ?? undefined}
                  onReset={reg.reset}
                />
              )}

              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 md:p-6">
                <h3 className="mb-2 text-sm font-bold text-purple-300">
                  How it works
                </h3>
                <ol className="space-y-1.5 text-xs text-purple-200/80 md:text-sm">
                  <li className="flex gap-2">
                    <span className="font-bold">1.</span>
                    <span>
                      Fill in your agent&apos;s metadata and service endpoints
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">2.</span>
                    <span>
                      Metadata is uploaded to IPFS for decentralized storage
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">3.</span>
                    <span>
                      An ERC-721 NFT is minted on Base Sepolia as your
                      agent&apos;s identity
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">4.</span>
                    <span>
                      Optionally set a wallet address to receive x402 payments
                    </span>
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
