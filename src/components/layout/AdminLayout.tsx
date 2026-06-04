'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Clock, Tag, FileText, Users, Settings,
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
  { label: 'Audit log', href: '/admin/audit', icon: <Settings size={18} /> },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href.startsWith('/admin#')) {
    return pathname === '/admin';
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-[var(--glass-border)] flex-shrink-0">
        <AttendaLogo iconSize={32} variant="dark" />
      </div>
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {NAV.map(item => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all',
                active
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[var(--glass-border)]">
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#040D12] text-slate-300 flex">
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 border-r border-[var(--glass-border)] bg-[#040D12]">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-[#040D12] border-r border-[var(--glass-border)] z-50">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-[var(--glass-border)]">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-2 text-slate-400">
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-slate-200">Platform Admin</span>
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
