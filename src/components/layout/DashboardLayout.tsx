'use client';
import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Clock, Calendar, CalendarClock, Wallet, Users, TrendingUp,
  BarChart2, Settings, LogOut, Bell, Menu, X, MessageSquare,
  ChevronDown, Home, Check, Trash2
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { notificationApi } from '@/lib/api';
import type { InAppNotification } from '@/types';
import TrialBanner from '@/components/TrialBanner';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard',    icon: <LayoutDashboard size={18} />, roles: ['super_admin','hr_admin','manager','employee'] },
  { label: 'Attendance',   href: '/attendance',   icon: <Clock size={18} />,           roles: ['super_admin','hr_admin','manager'] },
  { label: 'Remote',       href: '/remote',       icon: <Home size={18} />,            roles: ['super_admin','hr_admin','manager'] },
  { label: 'Leave',        href: '/leave',        icon: <Calendar size={18} />,        roles: ['super_admin','hr_admin','manager','employee'] },
  { label: 'Shifts',       href: '/shifts',       icon: <CalendarClock size={18} />,   roles: ['super_admin','hr_admin','manager'] },
  { label: 'Payroll',      href: '/payroll',      icon: <Wallet size={18} />,          roles: ['super_admin','hr_admin'] },
  { label: 'Employees',    href: '/employees',    icon: <Users size={18} />,           roles: ['super_admin','hr_admin','manager'] },
  { label: 'Performance',  href: '/performance',  icon: <TrendingUp size={18} />,      roles: ['super_admin','hr_admin','manager'] },
  { label: 'Analytics',    href: '/analytics',    icon: <BarChart2 size={18} />,       roles: ['super_admin','hr_admin'] },
  { label: 'WhatsApp',     href: '/settings/whatsapp', icon: <MessageSquare size={18} />, roles: ['super_admin'] },
  { label: 'Settings',     href: '/settings',     icon: <Settings size={18} />,        roles: ['super_admin','hr_admin'] },
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
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
    if (bellOpen) loadNotifs();
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

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/10 flex-shrink-0">
        <AttendaLogo iconSize={32} variant="dark" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 overflow-hidden',
                isActive
                  ? 'bg-white/12 text-white'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-white rounded-r-full" />
              )}
              <span className={cn('transition-colors', isActive ? 'text-white' : 'text-white/50')}>{item.icon}</span>
              {item.label}
              {item.badge != null && (
                <span className="ml-auto bg-[var(--danger-500)] text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile at bottom */}
      {user && (
        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-white/50 capitalize truncate">{user.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              className="text-white/40 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--gray-50)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 bg-[var(--dark-950)]">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-[var(--dark-950)] flex flex-col z-50 slide-in-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[var(--gray-200)] flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-[var(--gray-500)] hover:text-[var(--dark-950)]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-sm font-semibold text-[var(--dark-950)] capitalize">
                {filteredNav.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label || 'Dashboard'}
              </h2>
              {dateStr && <p className="text-xs text-[var(--gray-500)] mt-0.5">{dateStr}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setBellOpen(o => !o)}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)] transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-[var(--danger-500)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-11 z-30 w-96 bg-white rounded-xl shadow-xl border border-[var(--gray-200)] flex flex-col max-h-[520px] fade-in-up">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--gray-100)]">
                    <span className="text-sm font-semibold text-[var(--dark-950)]">
                      Notifications {unreadCount > 0 && <span className="ml-1 text-[var(--primary-600)]">({unreadCount} unread)</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-[var(--primary-600)] hover:underline flex items-center gap-1"
                      >
                        <Check size={12} /> Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto flex-1">
                    {notifsLoading ? (
                      <div className="flex items-center justify-center py-12 text-[var(--gray-400)] text-sm">Loading…</div>
                    ) : notifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <Bell size={28} className="text-[var(--gray-300)]" />
                        <p className="text-sm text-[var(--gray-400)]">No notifications yet</p>
                      </div>
                    ) : notifs.map(n => (
                      <div
                        key={n.id}
                        className={cn(
                          'flex gap-3 px-4 py-3 border-b border-[var(--gray-50)] hover:bg-[var(--gray-50)] transition-colors group',
                          !n.read_at && 'bg-[var(--primary-50)]'
                        )}
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {NOTIF_ICONS[n.type] ?? '🔔'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm leading-snug', !n.read_at ? 'font-semibold text-[var(--dark-950)]' : 'text-[var(--dark-700)]')}>
                            {n.title}
                          </p>
                          <p className="text-xs text-[var(--gray-500)] mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-[var(--gray-400)] mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {!n.read_at && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="p-1 rounded text-[var(--primary-600)] hover:bg-[var(--primary-100)] transition-colors"
                              title="Mark as read"
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id, !n.read_at)}
                            className="p-1 rounded text-[var(--danger-500)] hover:bg-[var(--danger-100)] transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {notifs.length > 0 && (
                    <div className="px-4 py-2 border-t border-[var(--gray-100)] text-center">
                      <button
                        onClick={() => { loadNotifs(); }}
                        className="text-xs text-[var(--gray-400)] hover:text-[var(--primary-600)] transition-colors"
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--gray-100)] transition-colors"
                >
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden sm:block text-sm font-medium text-[var(--dark-950)]">{user.name}</span>
                  <ChevronDown size={14} className="text-[var(--gray-500)]" />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-12 z-20 w-52 bg-white rounded-xl shadow-lg border border-[var(--gray-200)] py-1 fade-in-up">
                      <div className="px-4 py-3 border-b border-[var(--gray-100)]">
                        <p className="text-sm font-semibold text-[var(--dark-950)]">{user.name}</p>
                        <p className="text-xs text-[var(--gray-500)]">{user.email}</p>
                      </div>
                      <Link href="/settings/profile" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dark-950)] hover:bg-[var(--gray-50)]">
                        <Settings size={14} /> Profile Settings
                      </Link>
                      <button onClick={logout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--danger-800)] hover:bg-[var(--danger-100)]">
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          <TrialBanner />
          <div className="flex-1 p-6 page-fade-in" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
