'use client';

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * アプリケーション内のレイアウト（サイドバー付き）
 * Chat, Marketplace, History, Wallet, Faucet で使用
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
