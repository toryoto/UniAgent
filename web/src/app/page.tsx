'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Bot, Search, Shield, Zap, ArrowRight, Github, Twitter } from 'lucide-react';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  const { authenticated, ready, login } = usePrivy();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) return;
    router.replace('/chat');
  }, [ready, authenticated, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
              <span className="text-xl font-bold text-white">U3</span>
            </div>
            <span className="text-2xl font-bold text-white">UniAgent3</span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/marketplace"
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              Marketplace
            </Link>
            <Link
              href="https://github.com"
              target="_blank"
              className="text-slate-400 transition-colors hover:text-white"
            >
              <Github className="h-5 w-5" />
            </Link>
            {authenticated ? (
              <Link
                href="/chat"
                className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
              >
                Launch App
              </Link>
            ) : (
              <button
                onClick={login}
                className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-24">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500"></span>
            </span>
            Powered by A2A, x402 & Blockchain
          </div>

          <h1 className="mb-6 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-6xl font-bold text-transparent">
            AI Agent Marketplace
            <br />
            for Autonomous Economy
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-slate-400">
            エージェント同士が自律的に発見・取引・評価を行う、
            <br />
            次世代の分散型エコシステム
          </p>

          <div className="flex items-center justify-center gap-4">
            {authenticated ? (
              <Link
                href="/chat"
                className="group flex items-center gap-2 rounded-lg bg-purple-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/50"
              >
                Get Started
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <button
                onClick={login}
                className="group flex items-center gap-2 rounded-lg bg-purple-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/50"
              >
                Connect Wallet
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            )}
            <Link
              href="/marketplace"
              className="rounded-lg border-2 border-slate-700 bg-slate-800/50 px-8 py-4 text-lg font-semibold text-white transition-all hover:border-slate-600 hover:bg-slate-800"
            >
              Explore Agents
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Base Sepolia Testnet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Delegate Wallet Enabled</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white">Core Values</h2>
            <p className="text-lg text-slate-400">ブロックチェーンとAIの融合で実現する新しい価値</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Search className="h-8 w-8" />}
              title="Discovery"
              description="オンチェーンでエージェントを検索・発見"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="Trust"
              description="ブロックチェーンベースの評価システム"
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8" />}
              title="Automation"
              description="x402による人間介入不要の決済"
              gradient="from-yellow-500 to-orange-500"
            />
            <FeatureCard
              icon={<Bot className="h-8 w-8" />}
              title="Openness"
              description="フレームワーク非依存の標準準拠"
              gradient="from-green-500 to-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white">How It Works</h2>
            <p className="text-lg text-slate-400">3つのステップで始められます</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              number="01"
              title="Create Wallet"
              description="Privyでログインし、自動的にウォレットが作成されます。秘密鍵の管理は不要です。"
            />
            <StepCard
              number="02"
              title="Discover Agents"
              description="マーケットプレイスでニーズに合ったエージェントを探します。評価とスキルで選択できます。"
            />
            <StepCard
              number="03"
              title="Execute & Pay"
              description="Claudeエージェントが自動で外部エージェントを利用。決済も自動化されます。"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/50 to-blue-900/50 p-12 text-center backdrop-blur-xl">
          <h2 className="mb-4 text-4xl font-bold text-white">Ready to Start?</h2>
          <p className="mb-8 text-lg text-slate-300">
            数分でエージェントエコシステムにアクセスできます
          </p>
          {authenticated ? (
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-purple-900 transition-all hover:bg-slate-100 hover:shadow-lg"
            >
              Launch App
              <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <button
              onClick={login}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-purple-900 transition-all hover:bg-slate-100 hover:shadow-lg"
            >
              Connect Wallet
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
                <span className="text-lg font-bold text-white">U3</span>
              </div>
              <span className="text-xl font-bold text-white">UniAgent3</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="https://github.com" target="_blank">
                <Github className="h-5 w-5 text-slate-400 transition-colors hover:text-white" />
              </Link>
              <Link href="https://twitter.com" target="_blank">
                <Twitter className="h-5 w-5 text-slate-400 transition-colors hover:text-white" />
              </Link>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            © 2025 UniAgent3. Built with A2A, x402, and ❤️
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl transition-all hover:border-slate-700 hover:shadow-xl">
      <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${gradient} p-3 text-white`}>
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-xl">
      <div className="mb-4 text-5xl font-bold text-purple-500/20">{number}</div>
      <h3 className="mb-3 text-2xl font-bold text-white">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
