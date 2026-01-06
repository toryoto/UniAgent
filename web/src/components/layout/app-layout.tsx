'use client';

import { ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils/cn';

interface SidebarContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within AppLayout');
  }
  return context;
}

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * アプリケーション内のレイアウト（サイドバー付き）
 * Chat, Marketplace, History, Wallet, Faucet で使用
 */
export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen, isMobile }}>
      <div className="flex h-screen bg-slate-950">
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:relative md:z-auto md:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} isMobile={isMobile} />
        </div>

        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="flex-1 overflow-y-auto md:ml-0">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
