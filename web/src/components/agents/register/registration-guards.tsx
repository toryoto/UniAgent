'use client';

import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { RegistrationGuardResult } from '@/lib/registration/guards';

interface RegistrationGuardsProps {
  guards: RegistrationGuardResult[];
  isChecking: boolean;
}

export function RegistrationGuards({
  guards,
  isChecking,
}: RegistrationGuardsProps) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-400">
          Checking prerequisites...
        </span>
      </div>
    );
  }

  const failedGuards = guards.filter((g) => !g.allowed);
  if (failedGuards.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
      <h3 className="mb-2 text-sm font-bold text-red-300">
        Prerequisites Not Met
      </h3>
      <ul className="space-y-2">
        {guards.map((guard) => (
          <li key={guard.id} className="flex items-center gap-2">
            {guard.allowed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span
              className={`text-sm ${guard.allowed ? 'text-green-300' : 'text-red-300'}`}
            >
              {guard.name}
              {guard.reason && (
                <span className="text-red-400/80"> — {guard.reason}</span>
              )}
            </span>
            {!guard.allowed && guard.actionLabel && guard.actionHref && (
              <Link
                href={guard.actionHref}
                className="ml-auto text-xs text-purple-400 hover:text-purple-300"
              >
                {guard.actionLabel}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
