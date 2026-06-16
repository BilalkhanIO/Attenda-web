'use client';

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Tag, FileText, Users,
  LogOut, Menu, AlertCircle, Bell, Check, Trash2, ChevronDown, Settings, History, Megaphone,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { notificationApi, getAccessToken } from '@/lib/api';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { InAppNotification } from '@/types';

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
  { label: 'Broadcast', href: '/admin/broadcast', icon: <Megaphone size={15} />, permissions: ['platform.orgs.manage'] },
  { label: 'Audit logs', href: '/admin/logs', icon: <History size={15} />, permissions: ['platform.audit.view', 'platform.orgs.manage'] },
];

const NOTIF_ICONS: Record<string, string> = {
  leave_request:    '📋',
  leave_approved:   '✅',
  leave_rejected:   '❌',
  remote_request:   '🏠',
  remote_approved:  '✅',
  remote_rejected:  '❌',
  attendance_late:  '⏰',
  attendance_absent:'🚫',
  goal_assigned:    '🎯',
  review_submitted: '📊',
  payslip_ready:    '💰',
  shift_reminder:   '🔔',
};

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, capabilities } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');

  // Notification state
  const [bellOpen, setBellOpen]           = useState(false);
  const [notifs, setNotifs]               = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  // SSE: live unread count
  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '/api/v1');
    let retryMs = 1_000;

    fetchEventSource(`${apiBase}/notifications/stream`, {
      signal: ctrl.signal,
      openWhenHidden: false,
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string>),
            Authorization: `Bearer ${getAccessToken() ?? ''}`,
          },
        }),
      onopen: async (res) => {
        if (res.ok) { retryMs = 1_000; return; }
        throw new Error(`notification stream rejected: ${res.status}`);
      },
      onmessage: (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'count') setUnreadCount(msg.count);
        } catch { /* ignore */ }
      },
      onerror: () => {
        const delay = retryMs;
        retryMs = Math.min(retryMs * 2, 30_000);
        return delay;
      },
    }).catch(() => {});

    return () => ctrl.abort();
  }, [user]);

  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await notificationApi.getAll(1, 10);
      setNotifs(res.data.data?.items ?? []);
      setUnreadCount(res.data.data?.unread_count ?? 0);
    } catch { /* ignore */ }
    finally { setNotifsLoading(false); }
  }, []);

  useEffect(() => {
    if (bellOpen) loadNotifs();
  }, [bellOpen, loadNotifs]);

  // Click outside handlers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (bellRef.current && !bellRef.current.contains(target)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

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
      <nav className="flex-1 px-2 py-4 overflow-y-auto custom-scrollbar space-y-1">
        {visibleNav.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all duration-300',
                active
                  ? 'bg-[var(--primary-600)] text-white shadow-lg shadow-[var(--primary-600)]/20'
                  : 'text-[var(--on-glass-muted)] hover:bg-[var(--glass-10)] hover:text-white hover:translate-x-1',
              )}
            >
              <span className={cn('shrink-0 transition-colors', active ? 'text-white' : 'text-[var(--on-glass-dim)] group-hover:text-white')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User at bottom (simplified) */}
      {user && (
        <div className="p-3 border-t border-[var(--glass-border)] shrink-0 lg:hidden">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-[var(--glass-05)]">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-wider truncate">Platform Admin</p>
            </div>
            <button onClick={logout} className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors p-1 shrink-0">
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
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-48 bg-[var(--dark-800)] border-r border-[var(--glass-border)] flex flex-col z-50 slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--dark-950)] relative">
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 10% 20%, var(--primary-600) 0%, transparent 40%), radial-gradient(circle at 90% 80%, var(--secondary) 0%, transparent 40%)' }} />

        {/* Top Header - HIGH Z-INDEX */}
        <header className="h-11 bg-[var(--dark-950)]/50 backdrop-blur-md border-b border-[var(--glass-border)] flex items-center justify-between px-4 shrink-0 z-30">
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

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--glass-05)] border border-[var(--glass-border)] hover:bg-[var(--glass-10)] text-white transition-all active:scale-95"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-[var(--accent)] text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg shadow-[var(--accent)]/30">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-10 z-50 w-80 bg-[var(--dark-800)] rounded-2xl shadow-2xl border border-[var(--glass-border)] flex flex-col max-h-[32rem] fade-in-up overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      Notifications {unreadCount > 0 && <span className="ml-1 text-[var(--primary-600)]">({unreadCount})</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-[10px] text-[var(--primary-600)] hover:underline font-black uppercase tracking-widest">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {notifsLoading ? (
                      <div className="py-8 text-center text-xs text-[var(--on-glass-dim)]">Loading...</div>
                    ) : notifs.length === 0 ? (
                      <div className="py-12 text-center">
                        <Bell size={24} className="mx-auto mb-2 text-[var(--on-glass-dim)]" />
                        <p className="text-xs text-[var(--on-glass-muted)] font-bold">No notifications</p>
                      </div>
                    ) : notifs.map(n => (
                      <div key={n.id} className={cn('flex gap-3 px-4 py-3 border-b border-[var(--glass-border)] hover:bg-white/5 transition-colors group', !n.read_at && 'bg-[var(--primary-600)]/5')}>
                        <span className="text-sm mt-0.5">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-[12px] leading-snug', !n.read_at ? 'font-black text-white' : 'text-[var(--on-glass-sub)]')}>{n.title}</p>
                          <p className="text-[10px] text-[var(--on-glass-dim)] mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[9px] text-[var(--on-glass-dim)] mt-1 uppercase font-bold">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read_at && (
                          <button onClick={() => handleMarkRead(n.id)} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--primary-600)] hover:bg-[var(--primary-600)]/10 rounded transition-all">
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Link href="/admin" onClick={() => setBellOpen(false)} className="px-4 py-2 text-center text-[10px] font-black text-[var(--on-glass-muted)] hover:text-white uppercase tracking-widest border-t border-[var(--glass-border)] bg-[var(--glass-05)]">
                    Close
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            {user && (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)] hover:bg-[var(--glass-10)] transition-all active:scale-95"
                >
                  <Avatar name={user.name} size="sm" />
                  <div className="hidden sm:block text-left">
                    <p className="text-[11px] font-black text-white leading-tight truncate max-w-[80px]">{user.name.split(' ')[0]}</p>
                    <p className="text-[8px] text-[var(--on-glass-muted)] font-black uppercase tracking-widest">Admin</p>
                  </div>
                  <ChevronDown size={12} className={cn('text-[var(--on-glass-dim)] transition-transform duration-300', profileOpen && 'rotate-180')} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-10 z-50 w-52 bg-[var(--dark-800)] rounded-2xl shadow-2xl border border-[var(--glass-border)] py-1.5 fade-in-up overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-05)] mb-1">
                      <p className="text-xs font-black text-white truncate">{user.name}</p>
                      <p className="text-[9px] text-[var(--on-glass-dim)] font-black uppercase tracking-widest mt-0.5 truncate">{user.email}</p>
                    </div>
                    <div className="px-1.5 space-y-0.5">
                      <Link href="/admin/users" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-[var(--on-glass-sub)] hover:bg-[var(--glass-10)] hover:text-white rounded-xl transition-all">
                        <Users size={14} className="text-[var(--on-glass-dim)]" /> Team Management
                      </Link>
                      <button onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 rounded-xl transition-all">
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content - Lower Z-INDEX than header */}
        <main className="flex-1 overflow-y-auto custom-scrollbar z-10 page-fade-in" key={pathname}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
