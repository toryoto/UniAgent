'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, LayoutDashboard, History, Wallet, Droplet, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Marketplace', href: '/marketplace', icon: LayoutDashboard },
  { name: 'History', href: '/history', icon: History },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'Faucet', href: '/faucet', icon: Droplet },
];

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, user, logout } = usePrivy();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-slate-700 bg-slate-900">
      {/* Logo & Close Button */}
      <div className="flex h-16 items-center justify-between border-b border-slate-700 px-6">
        <Link
          href={authenticated ? '/chat' : '/'}
          className="flex items-center gap-2"
          onClick={handleLinkClick}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
            <span className="text-lg font-bold text-white">U3</span>
          </div>
          <span className="text-xl font-bold text-white">UniAgent</span>
        </Link>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="メニューを閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      {authenticated && user && (
        <div className="border-t border-slate-700 p-4">
          <div className="mb-3 rounded-lg bg-slate-800 p-3">
            <div className="text-xs text-slate-400">Connected Wallet</div>
            <div className="mt-1 font-mono text-sm text-white">
              {user.wallet?.address
                ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
                : 'No wallet'}
            </div>
          </div>
          <button
            onClick={() => {
              handleLogout();
              handleLinkClick();
            }}
            className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
