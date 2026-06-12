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
import { Avatar } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  exact?: boolean;
  /** Visible if the user holds ANY of these platform permissions. */
  permissions: string[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={15} />, exact: true, permissions: ['platform.orgs.view', 'platform.orgs.manage'] },
  { label: 'Organisations', href: '/admin/orgs', icon: <Building2 size={15} />, permissions: ['platform.orgs.view', 'platform.orgs.manage'] },
  { label: 'Pending', href: '/admin/pending', icon: <AlertCircle size={15} />, permissions: ['platform.orgs.view', 'platform.orgs.manage'] },
  { label: 'Plans', href: '/admin/plans', icon: <Tag size={15} />, permissions: ['platform.plans.manage'] },
  { label: 'Blog', href: '/admin/blog', icon: <FileText size={15} />, permissions: ['platform.blog.manage'] },
  { label: 'Platform users', href: '/admin/users', icon: <Users size={15} />, permissions: ['platform.users.manage'] },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, capabilities } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const update = () => setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  // Until capabilities load, show everything to avoid a nav flash for full admins.
  const platformPerms = capabilities?.platform_permissions;
  const visibleNav = platformPerms?.length
    ? NAV.filter(item => item.permissions.some(p => platformPerms.includes(p)))
    : NAV;

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const activeLabel = visibleNav.find(isActive)?.label || 'Dashboard';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-11 flex items-center px-4 border-b border-white/10 shrink-0">
        <AttendaLogo iconSize={24} variant="dark" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto custom-scrollbar space-y-0.5">
        {visibleNav.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                active
                  ? 'bg-[var(--primary-600)] text-white'
                  : 'text-[var(--on-glass-muted)] hover:bg-[var(--glass-10)] hover:text-white',
              )}
            >
              <span className={cn('shrink-0', active ? 'text-white' : 'text-[var(--on-glass-dim)] group-hover:text-white')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User at bottom */}
      {user && (
        <div className="p-3 border-t border-[var(--glass-border)] shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--glass-10)] transition-colors">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-wider truncate">Platform Admin</p>
            </div>
            <button onClick={logout} className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors p-1 shrink-0" title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dark-950)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-48 flex-col shrink-0 bg-[var(--dark-800)] border-r border-[var(--glass-border)]">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-48 bg-[var(--dark-800)] border-r border-[var(--glass-border)] flex flex-col z-50 slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--dark-950)] relative">
        {/* Background Mesh Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 10% 20%, var(--primary-600) 0%, transparent 40%), radial-gradient(circle at 90% 80%, var(--secondary) 0%, transparent 40%)' }} />

        {/* Top Header */}
        <header className="h-11 bg-[var(--dark-950)]/50 backdrop-blur-md border-b border-[var(--glass-border)] flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-[var(--on-glass-sub)] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">{activeLabel}</h2>
              {dateStr && <p className="text-[11px] text-[var(--on-glass-muted)] mt-0.5">{dateStr}</p>}
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
              <Avatar name={user.name} size="sm" />
              <div className="hidden sm:block min-w-0">
                <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.name}</p>
                <p className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-wider">Platform Admin</p>
              </div>
              <button onClick={logout} className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors p-1 shrink-0" title="Logout">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar z-10 page-fade-in" key={pathname}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
