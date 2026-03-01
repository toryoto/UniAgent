'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  History,
  Wallet,
  Droplet,
  PlusCircle,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils/cn';
import { useConversations } from '@/lib/hooks/useConversations';

const navigation = [
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Marketplace', href: '/marketplace', icon: LayoutDashboard },
  { name: 'History', href: '/history', icon: History },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'Register Agent', href: '/agents/register', icon: PlusCircle },
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

  const [historyOpen, setHistoryOpen] = useState(true);

  const { conversations, isLoading: loadingConversations, deleteConversation } =
    useConversations();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    deleteConversation(conversationId);
    if (pathname === `/chat/${conversationId}`) {
      router.push('/chat');
    }
  };

  const activeConversationId = pathname?.startsWith('/chat/')
    ? pathname.replace('/chat/', '')
    : null;

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
      <nav className="space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/chat'
              ? pathname === '/chat' || pathname?.startsWith('/chat/')
              : pathname === item.href;
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

      {/* Chat History (collapsible) */}
      {authenticated && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-slate-700">
          <div className="flex items-center justify-between px-4 py-2.5">
            <button
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-200"
            >
              {historyOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span>Chat History</span>
            </button>
            <button
              onClick={() => {
                router.push('/chat');
                handleLinkClick();
              }}
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
              title="New Chat"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {historyOpen && (
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate-500">
                  No conversations yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        router.push(`/chat/${conv.id}`);
                        handleLinkClick();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/chat/${conv.id}`);
                          handleLinkClick();
                        }
                      }}
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer',
                        activeConversationId === conv.id
                          ? 'bg-purple-600/20 text-white'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      )}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {conv.title || 'New Chat'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="shrink-0 rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
