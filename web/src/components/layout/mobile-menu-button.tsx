'use client';

import { Menu } from 'lucide-react';
import { useSidebar } from './app-layout';

export function MobileMenuButton() {
  const { isMobile, setSidebarOpen } = useSidebar();

  if (!isMobile) {
    return null;
  }

  return (
    <button
      onClick={() => setSidebarOpen(true)}
      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      aria-label="メニューを開く"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}
