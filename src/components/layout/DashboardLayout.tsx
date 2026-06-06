'use client';
import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Clock, Calendar, CalendarClock, Wallet, Users, TrendingUp,
  BarChart2, Settings, LogOut, Bell, Menu, MessageSquare,
  ChevronDown, Home, Check, Trash2, AlarmClock
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { notificationApi } from '@/lib/api';
import type { AuthRole, InAppNotification } from '@/types';
import TrialBanner from '@/components/TrialBanner';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** Legacy fallback while capabilities load */
  roles?: string[];
  permission?: string;
  /** Extra permission keys that also grant access (e.g. manager team scope) */
  permissionsAlt?: string[];
  feature?: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['super_admin', 'hr_admin', 'manager', 'employee'] },
  { label: 'Attendance', href: '/attendance', icon: <Clock size={18} />, feature: 'attendance', permission: 'attendance.view_team', roles: ['super_admin', 'hr_admin', 'manager'] },
  { label: 'Remote', href: '/remote', icon: <Home size={18} />, feature: 'remote_work', permission: 'remote.approve', roles: ['super_admin', 'hr_admin', 'manager'] },
  { label: 'Leave', href: '/leave', icon: <Calendar size={18} />, feature: 'leave_management', roles: ['super_admin', 'hr_admin', 'manager', 'employee'] },
  { label: 'Shifts', href: '/shifts', icon: <CalendarClock size={18} />, feature: 'shifts', permission: 'shifts.view', roles: ['super_admin', 'hr_admin', 'manager'] },
  { label: 'Overtime', href: '/overtime', icon: <AlarmClock size={18} />, feature: 'attendance', permission: 'overtime.manage', roles: ['super_admin', 'hr_admin', 'manager', 'employee'] },
  { label: 'Payroll', href: '/payroll', icon: <Wallet size={18} />, feature: 'payroll', permission: 'payroll.view', roles: ['super_admin', 'hr_admin'] },
  { label: 'Employees', href: '/employees', icon: <Users size={18} />, permission: 'employees.view', permissionsAlt: ['employees.view_team'], roles: ['super_admin', 'hr_admin', 'manager'] },
  { label: 'Performance', href: '/performance', icon: <TrendingUp size={18} />, feature: 'performance_reviews', permission: 'performance.view', roles: ['super_admin', 'hr_admin', 'manager'] },
  { label: 'Analytics', href: '/analytics', icon: <BarChart2 size={18} />, permission: 'analytics.view', roles: ['super_admin', 'hr_admin'] },
  { label: 'WhatsApp', href: '/settings/whatsapp', icon: <MessageSquare size={18} />, feature: 'whatsapp', permission: 'org.whatsapp.update', roles: ['super_admin'] },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} />, permission: 'org.settings.view', roles: ['super_admin', 'hr_admin'] },
];

function navItemVisible(
  item: NavItem,
  userRole: string,
  capabilitiesLoading: boolean,
  hasFeature: (key: string) => boolean,
  hasPermission: (key: string) => boolean,
  hasRole: (...roles: AuthRole[]) => boolean,
): boolean {
  const roleFallback = item.roles?.length
    ? item.roles.some(r => hasRole(r as AuthRole))
    : true;

  if (capabilitiesLoading && item.roles?.length) {
    return item.roles.includes(userRole);
  }

  if (item.feature && !hasFeature(item.feature)) return false;

  if (item.permission) {
    const permKeys = [item.permission, ...(item.permissionsAlt ?? [])];
    if (permKeys.some(k => hasPermission(k))) return true;
    return roleFallback;
  }

  return roleFallback;
}

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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout, capabilities, capabilitiesLoading, hasFeature, hasPermission, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');

  // Notification bell state
  const [bellOpen, setBellOpen]           = useState(false);
  const [notifs, setNotifs]               = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const sseRef  = useRef<EventSource | null>(null);

  useEffect(() => {
    if (user?.role === 'platform_admin') {
      router.replace('/admin');
    }
  }, [user, router]);

  // SSE: subscribe to live unread count
  useEffect(() => {
    if (!user) return;
    const token = Cookies.get('access_token');
    if (!token) return;

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1');
    const es = new EventSource(`${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`);
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'count') setUnreadCount(msg.count);
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => es.close();

    return () => { es.close(); sseRef.current = null; };
  }, [user]);

  // Load notifications when bell is opened
  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await notificationApi.getAll(1, 20);
      setNotifs(res.data.data?.items ?? []);
      setUnreadCount(res.data.data?.unread_count ?? 0);
    } catch { /* ignore */ }
    finally { setNotifsLoading(false); }
  }, []);

  useEffect(() => {
    if (bellOpen) {
      loadNotifs();
    }
  }, [bellOpen, loadNotifs]);

  // Close bell on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
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
    user && navItemVisible(item, user.role, capabilitiesLoading, hasFeature, hasPermission, hasRole),
  );

  const roleLabel = capabilities?.org_role?.name
    ?? user?.role.replace(/_/g, ' ')
    ?? '';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/10 flex-shrink-0">
        <AttendaLogo iconSize={32} variant="dark" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'group flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200',
                isActive
                  ? 'bg-[var(--primary-600)] text-white shadow-lg shadow-[var(--primary-600)]/20'
                  : 'text-[var(--on-glass-muted)] hover:bg-[var(--glass-10)] hover:text-white'
              )}
            >
              <span className={cn('transition-colors', isActive ? 'text-white' : 'text-[var(--on-glass-dim)] group-hover:text-white')}>
                {item.icon}
              </span>
              {item.label}
              {item.badge != null && (
                <span className="ml-auto bg-[var(--accent)] text-white text-[10px] font-black rounded-full px-2 py-0.5 min-w-[20px] text-center shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      {user && (
        <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--glass-05)] flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-[var(--glass-10)] transition-colors group cursor-pointer">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-widest font-black truncate">{roleLabel}</p>
            </div>
            <button
              onClick={logout}
              className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors p-1"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dark-950)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 bg-[var(--dark-800)] border-r border-[var(--glass-border)]">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-[var(--dark-800)] border-r border-[var(--glass-border)] flex flex-col z-50 slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--dark-950)] relative">
        {/* Background Mesh Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(circle at 10% 20%, var(--primary-600) 0%, transparent 40%), radial-gradient(circle at 90% 80%, var(--secondary) 0%, transparent 40%)' }} />

        {/* Top Header */}
        <header className="h-16 bg-[var(--dark-950)]/50 backdrop-blur-md border-b border-[var(--glass-border)] flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-[var(--on-glass-sub)] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(true)}
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
            {/* Notification bell */}
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setBellOpen(o => !o)}
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
                <div className="absolute right-0 top-12 z-30 w-96 bg-[var(--dark-800)] rounded-2xl shadow-2xl border border-[var(--glass-border)] flex flex-col max-h-[520px] fade-in-up overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)]">
                    <span className="text-sm font-bold text-white uppercase tracking-wide">
                      Notifications {unreadCount > 0 && <span className="ml-1 text-[var(--primary-600)]">({unreadCount})</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-[var(--primary-600)] hover:text-[var(--secondary)] font-bold transition-colors flex items-center gap-1"
                      >
                        <Check size={14} /> Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
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
                          'flex gap-4 px-5 py-4 border-b border-[var(--glass-border)] hover:bg-[var(--glass-05)] transition-colors group',
                          !n.read_at && 'bg-[var(--primary-600)]/5'
                        )}
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {NOTIF_ICONS[n.type] ?? '🔔'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm leading-snug', !n.read_at ? 'font-bold text-white' : 'text-[var(--on-glass-sub)]')}>
                            {n.title}
                          </p>
                          <p className="text-xs text-[var(--on-glass-muted)] mt-1 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-[var(--on-glass-dim)] mt-2 font-medium">{timeAgo(n.created_at)}</p>
                        </div>
                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {!n.read_at && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="p-1.5 rounded-lg text-[var(--primary-600)] hover:bg-[var(--primary-600)]/10 transition-colors"
                              title="Mark as read"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id, !n.read_at)}
                            className="p-1.5 rounded-lg text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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

            {/* Profile dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--glass-05)] transition-all border border-transparent hover:border-[var(--glass-border)]"
                >
                  <div className="relative">
                    <Avatar name={user.name} size="sm" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[var(--primary-600)] border-2 border-[var(--dark-950)] rounded-full" />
                  </div>
                  <span className="hidden sm:block text-sm font-bold text-white">{user.name}</span>
                  <ChevronDown size={14} className="text-[var(--on-glass-muted)]" />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-12 z-20 w-56 bg-[var(--dark-800)] rounded-2xl shadow-2xl border border-[var(--glass-border)] py-2 fade-in-up overflow-hidden">
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
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto flex flex-col custom-scrollbar z-10">
          <TrialBanner />
          <div className="flex-1 p-6 page-fade-in" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
