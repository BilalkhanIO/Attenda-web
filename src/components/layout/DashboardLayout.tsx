'use client';
import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Clock, Calendar, CalendarClock, Wallet, Users, TrendingUp,
  BarChart2, Settings, LogOut, Bell, Menu, MessageSquare, ClipboardCheck,
  ChevronDown, Home, Check, Trash2, AlarmClock, Megaphone, Receipt, FileText
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '@/lib/queries';
import { notificationApi, getAccessToken } from '@/lib/api';
import type { InAppNotification } from '@/types';
import TrialBanner from '@/components/TrialBanner';
import AIChatWidget from '@/components/AIChatWidget';
import { navItemVisible } from '@/lib/nav';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  permission?: string;
  permissionsAlt?: string[];
  feature?: string;
  badge?: number;
  section?: string;
  sub?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',           icon: <LayoutDashboard size={15} /> },
  { label: 'Approvals',   href: '/approvals',           icon: <ClipboardCheck size={15} />,  permission: 'leave.approve', permissionsAlt: ['overtime.manage', 'remote.approve', 'shifts.swaps.approve', 'attendance.late_notices.manage', 'attendance.override', 'expenses.view'] },

  { section: 'Workforce',
    label: 'Attendance',  href: '/attendance',           icon: <Clock size={15} />,        feature: 'attendance',         permission: 'attendance.view_team' },
  { label: 'Remote',      href: '/remote',               icon: <Home size={15} />,         feature: 'remote_work',        permission: 'remote.approve' },
  { label: 'Leave',       href: '/leave',                icon: <Calendar size={15} />,     feature: 'leave_management' },
  { label: 'Overtime',    href: '/overtime',             icon: <AlarmClock size={15} />,   feature: 'attendance' },
  { label: 'Expenses',    href: '/expenses',             icon: <Receipt size={15} /> },
  { label: 'Documents',   href: '/documents',            icon: <FileText size={15} /> },

  { section: 'Scheduling',
    label: 'Shifts',      href: '/shifts',               icon: <CalendarClock size={15} />, feature: 'shifts',            permission: 'shifts.view' },
  { label: 'Templates',   href: '/shifts/templates',     icon: <CalendarClock size={13} />, feature: 'shifts',            permission: 'shifts.view', sub: true },
  { label: 'Swaps',       href: '/shifts/swaps',         icon: <CalendarClock size={13} />, feature: 'shifts',            permission: 'shifts.view', sub: true },

  { section: 'HR',
    label: 'Payroll',     href: '/payroll',              icon: <Wallet size={15} />,        feature: 'payroll',           permission: 'payroll.view' },
  { label: 'Employees',   href: '/employees',            icon: <Users size={15} />,                                       permission: 'employees.view', permissionsAlt: ['employees.view_team'] },
  { label: 'Performance', href: '/performance',          icon: <TrendingUp size={15} />,    feature: 'performance_reviews', permission: 'performance.view' },
  { label: 'Announcements', href: '/settings/announcements', icon: <Megaphone size={15} />,   permission: 'org.announcements.send' },
  { label: 'Goals',       href: '/performance/goals',    icon: <TrendingUp size={13} />,    feature: 'performance_reviews', permission: 'performance.view', sub: true },

  { section: 'Insights',
    label: 'Analytics',   href: '/analytics',            icon: <BarChart2 size={15} />,                                   permission: 'analytics.view' },
  { label: 'Reports',     href: '/analytics/reports',    icon: <BarChart2 size={13} />,                                   permission: 'analytics.view', sub: true },
  { label: 'AI Chat',     href: '/analytics/ai',         icon: <BarChart2 size={13} />,                                   permission: 'analytics.view', sub: true },

  { section: 'Admin',
    label: 'WhatsApp',    href: '/settings/whatsapp',    icon: <MessageSquare size={15} />, feature: 'whatsapp',          permission: 'org.whatsapp.update' },
  { label: 'Settings',    href: '/settings',             icon: <Settings size={15} />,                                    permission: 'org.settings.view' },
];

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NOTIF_ICONS: Record<string, string> = {
  leave_request:    '📋',
  leave_approved:   '✅',
  leave_rejected:   '❌',
  remote_request:   '🏠',
  remote_approved:  '✅',
  remote_rejected:  '❌',
  remote_no_reply:  '⚠️',
  attendance_late:  '⏰',
  attendance_absent:'🚫',
  goal_assigned:    '🎯',
  review_submitted: '📊',
  payslip_ready:    '💰',
  shift_reminder:   '🔔',
};

// Server-pushed invalidation hints → TanStack Query key roots. Unknown
// scopes are ignored, so client and server halves can deploy independently.
const INVALIDATE_SCOPES: Record<string, readonly (readonly string[])[]> = {
  attendance_changed: [keys.attendance.all, ['approvals', 'correction']],
  leave_changed:      [keys.leave.all, ['approvals', 'leave']],
  overtime_changed:   [keys.overtime.all, ['approvals', 'overtime']],
  remote_changed:     [keys.remote.all, ['approvals', 'remote']],
  swap_changed:       [keys.swaps.all, ['approvals', 'swap']],
  expense_changed:    [keys.expenses.all, ['approvals', 'expense']],
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout, capabilities, hasFeature, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');

  const [bellOpen, setBellOpen]           = useState(false);
  const [notifs, setNotifs]               = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'platform_admin') {
      router.replace('/admin');
    }
  }, [user, router]);

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
          if (msg.type === 'invalidate') {
            for (const key of INVALIDATE_SCOPES[msg.scope as string] ?? []) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          }
        } catch { /* ignore */ }
      },
      onerror: () => {
        const delay = retryMs;
        retryMs = Math.min(retryMs * 2, 30_000);
        return delay;
      },
    }).catch(() => {});

    return () => ctrl.abort();
  }, [user, queryClient]);

  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await notificationApi.getAll(1, 20);
      setNotifs(res.data.data?.items ?? []);
      setUnreadCount(res.data.data?.unread_count ?? 0);
    } catch { /* ignore */ }
    finally { setNotifsLoading(false); }
  }, []);

  const toggleBell = () => {
    setBellOpen(o => !o);
    if (!bellOpen) loadNotifs(); // fetch fresh notifications on open
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (bellRef.current && !bellRef.current.contains(target)) {
        setBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
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

  const handleDelete = async (id: string, wasUnread: boolean) => {
    try {
      await notificationApi.delete(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const update = () => setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  const filteredNav = navItems.filter(item =>
    navItemVisible(item, hasFeature, hasPermission),
  );

  const roleLabel = capabilities?.org_role?.name
    ?? user?.role.replace(/_/g, ' ')
    ?? '';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-11 flex items-center px-4 border-b border-white/10 shrink-0">
        <AttendaLogo iconSize={24} variant="dark" />
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto custom-scrollbar space-y-0.5">
        {filteredNav.map((item) => {
          const isActive = item.sub
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <div key={item.href}>
              {item.section && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--on-glass-dim)] select-none">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                  item.sub && 'ml-3 text-[12px]',
                  isActive
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'text-[var(--on-glass-muted)] hover:bg-[var(--glass-10)] hover:text-white'
                )}
              >
                <span className={cn('shrink-0', isActive ? 'text-white' : 'text-[var(--on-glass-dim)] group-hover:text-white')}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {user && (
        <div className="p-3 border-t border-[var(--glass-border)] shrink-0 lg:hidden">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-[var(--glass-05)]">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-wider truncate">{roleLabel}</p>
            </div>
            <button onClick={logout} aria-label="Log out" title="Log out" className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors p-1 shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dark-950)]">
      <aside className="hidden lg:flex w-48 flex-col shrink-0 bg-[var(--dark-800)] border-r border-[var(--glass-border)]">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div role="presentation" className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-48 bg-[var(--dark-800)] border-r border-[var(--glass-border)] flex flex-col z-50 slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--dark-950)] relative">
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 10% 20%, var(--primary-600) 0%, transparent 40%), radial-gradient(circle at 90% 80%, var(--secondary) 0%, transparent 40%)' }} />

        <header className="h-11 bg-[var(--dark-950)]/50 backdrop-blur-md border-b border-[var(--glass-border)] flex items-center justify-between px-4 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-[var(--on-glass-sub)] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {filteredNav.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label || 'Dashboard'}
              </h2>
              {dateStr && <p className="text-[11px] text-[var(--on-glass-muted)] mt-0.5">{dateStr}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div ref={bellRef} className="relative">
              <button
                onClick={toggleBell}
                aria-label="Notifications"
                className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)] hover:bg-[var(--glass-10)] text-white transition-all active:scale-90"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[var(--accent)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-[var(--accent)]/30">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-11 z-50 w-80 bg-[var(--dark-800)] rounded-2xl shadow-2xl border border-[var(--glass-border)] flex flex-col max-h-100 fade-in-up overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      Notifications {unreadCount > 0 && <span className="ml-1 text-[var(--primary-600)]">({unreadCount})</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-[var(--primary-600)] hover:text-[var(--secondary)] font-bold transition-colors flex items-center gap-1"
                      >
                        <Check size={12} /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {notifsLoading ? (
                      <div className="flex items-center justify-center py-12 text-[var(--on-glass-muted)] text-sm">Loading…</div>
                    ) : notifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                        <div className="w-12 h-12 rounded-full bg-[var(--glass-05)] flex items-center justify-center">
                          <Bell size={24} className="text-[var(--on-glass-dim)]" />
                        </div>
                        <p className="text-sm text-[var(--on-glass-muted)]">No notifications yet</p>
                      </div>
                    ) : notifs.map(n => (
                      <div
                        key={n.id}
                        className={cn(
                          'flex gap-3 px-4 py-3 border-b border-[var(--glass-border)] hover:bg-[var(--glass-05)] transition-colors group',
                          !n.read_at && 'bg-[var(--primary-600)]/5'
                        )}
                      >
                        <span className="text-base flex-shrink-0 mt-0.5">
                          {NOTIF_ICONS[n.type] ?? '🔔'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs leading-snug', !n.read_at ? 'font-bold text-white' : 'text-[var(--on-glass-sub)]')}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-[var(--on-glass-muted)] mt-0.5 line-clamp-1">{n.body}</p>
                          <p className="text-[10px] text-[var(--on-glass-dim)] mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {!n.read_at && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="p-1 rounded text-[var(--primary-600)] hover:bg-[var(--primary-600)]/10 transition-colors"
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id, !n.read_at)}
                            className="p-1 rounded text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-colors"
                            title="Delete"
                            aria-label="Delete notification"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {notifs.length > 0 && (
                    <div className="px-5 py-3 border-t border-[var(--glass-border)] text-center bg-[var(--glass-05)]">
                      <button
                        onClick={() => { loadNotifs(); }}
                        className="text-xs font-bold text-[var(--on-glass-muted)] hover:text-white transition-colors"
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {user && (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-label="Account menu"
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--glass-05)] transition-all border border-transparent hover:border-[var(--glass-border)]"
                >
                  <div className="relative">
                    <Avatar name={user.name} size="sm" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[var(--primary-600)] border-2 border-[var(--dark-950)] rounded-full" />
                  </div>
                  <span className="hidden sm:block text-sm font-bold text-white">{user.name}</span>
                  <ChevronDown size={14} className={cn('text-[var(--on-glass-muted)] transition-transform duration-300', profileOpen && 'rotate-180')} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 bg-[var(--dark-800)] rounded-2xl shadow-2xl border border-[var(--glass-border)] py-2 fade-in-up overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
                      <p className="text-sm font-bold text-white">{user.name}</p>
                      <p className="text-[11px] text-[var(--on-glass-muted)] mt-0.5 truncate">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link href="/settings/profile" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-[var(--glass-10)] rounded-xl transition-colors">
                        <Settings size={16} className="text-[var(--on-glass-muted)]" /> Profile Settings
                      </Link>
                      <button onClick={logout}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 rounded-xl transition-colors mt-1">
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col custom-scrollbar z-10 relative">
          <TrialBanner />
          <div className="flex-1 p-4 page-fade-in" key={pathname}>
            {children}
          </div>
        </main>
      </div>
      <AIChatWidget />
    </div>
  );
}
