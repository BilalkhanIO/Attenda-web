'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Tag, FileText, Users,
  LogOut, Menu, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import AttendaLogo from '@/components/ui/AttendaLogo';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={18} />, exact: true },
  { label: 'Organisations', href: '/admin#organisations', icon: <Building2 size={18} /> },
  { label: 'Pending', href: '/admin#pending', icon: <AlertCircle size={18} /> },
  { label: 'Plans', href: '/admin/plans', icon: <Tag size={18} /> },
  { label: 'Blog', href: '/admin/blog', icon: <FileText size={18} /> },
  { label: 'Platform users', href: '/admin/users', icon: <Users size={18} /> },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hash, setHash] = useState('');

  // Track hash changes for active state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHash(window.location.hash);
      const handleHashChange = () => setHash(window.location.hash);
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  const isActive = (item: NavItem) => {
    const [itemPath, itemHash] = item.href.split('#');
    
    if (itemHash) {
      return pathname === itemPath && hash === `#${itemHash}`;
    }
    
    if (item.exact) {
      return pathname === itemPath && (!hash || hash === '#');
    }
    
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-(--glass-border) shrink-0">
        <AttendaLogo iconSize={32} variant="dark" />
      </div>
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {NAV.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setSidebarOpen(false);
                if (item.href.includes('#')) setHash(item.href.split('#')[1] ? `#${item.href.split('#')[1]}` : '');
                else if (item.href === '/admin') setHash('');
              }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all',
                active
                  ? 'bg-(--primary-600)/15 text-(--primary-600) border border-(--primary-600)/25'
                  : 'text-(--on-glass-dim) hover:bg-(--glass-05) hover:text-white',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-(--glass-border)">
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-(--on-glass-dim) hover:bg-rose-500/10 hover:text-rose-400 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#040D12] text-slate-300 flex">
      <aside className="hidden lg:flex w-64 flex-col shrink-0 border-r border-(--glass-border) bg-[#040D12]">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full flex flex-col bg-(--dark-800) border-r border-(--glass-border) z-50 slide-in-left">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-(--glass-border)">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-2 text-(--on-glass-dim)">
            <Menu size={20} />
          </button>
          <span className="text-sm font-black text-white">Platform Admin</span>
          <div className="w-9" />
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
