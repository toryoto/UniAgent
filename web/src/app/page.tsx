'use client';

import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { Particles } from '@/components/animations/particles';
import { Sparkles } from '@/components/animations/sparkles';
import { X } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { authenticated, ready, login } = usePrivy();
  const [projectName, setProjectName] = useState('');
  const [website, setWebsite] = useState('');
  const [noWebsite, setNoWebsite] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) return;
    // Redirect authenticated users to chat
    router.replace('/chat');
  }, [ready, authenticated, router]);

  const handleContinue = async () => {
    if (!authenticated) {
      await login();
    } else {
      router.push('/chat');
    }
  };

  const isFormValid = projectName.trim().length > 0 && (noWebsite || website.trim().length > 0);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Welcome Section */}
      <div className="flex-1 relative bg-[#0F172A] overflow-hidden">
        {/* Background particles */}
        <Particles />
        <Sparkles />

        {/* Gradient overlay pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col">
          {/* Logo */}
          <div className="p-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <span className="text-[#0F172A] text-sm font-bold">P</span>
              </div>
              <span className="text-white text-xl font-medium tracking-tight">privy</span>
            </div>
          </div>

          {/* Main text */}
          <div className="flex-1 flex items-center px-16">
            <div className="max-w-xl">
              <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
                Welcome to your
                <br />
                dashboard
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed">
                Answer a few quick questions
                <br />
                to get started.
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-8 pb-8">
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-purple-600 rounded-full transition-all duration-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="flex-1 relative bg-[#0A0F1E] flex items-center justify-center p-12">
        {/* Close button */}
        <button
          className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Form */}
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-white mb-12">
            What are you building?
          </h2>

          <div className="space-y-8">
            {/* Project Name */}
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-white mb-3">
                Project or company name
              </label>
              <input
                id="projectName"
                type="text"
                placeholder="Add name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
              />
            </div>

            {/* Website */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium text-white mb-3">
                Website
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  https://
                </span>
                <input
                  id="website"
                  type="text"
                  placeholder=""
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={noWebsite}
                  className="w-full pl-20 pr-4 py-3 bg-transparent border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Checkbox */}
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="noWebsite"
                  checked={noWebsite}
                  onChange={(e) => {
                    setNoWebsite(e.target.checked);
                    if (e.target.checked) setWebsite('');
                  }}
                  className="w-5 h-5 rounded border-slate-700 bg-transparent text-purple-600 focus:ring-2 focus:ring-purple-600 focus:ring-offset-0 cursor-pointer accent-purple-600"
                />
                <label htmlFor="noWebsite" className="text-sm text-slate-400 cursor-pointer">
                  Don&apos;t have a website
                </label>
              </div>
            </div>
          </div>

          {/* Continue button */}
          <div className="mt-12 flex justify-end">
            <button
              onClick={handleContinue}
              disabled={!isFormValid}
              className="px-8 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 focus:ring-offset-[#0A0F1E] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
