'use client';
import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Clock, Calendar, CalendarClock, Wallet, Users, TrendingUp,
  BarChart2, Settings, LogOut, Bell, Menu, X, MessageSquare,
  ChevronDown
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';

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
  { label: 'Leave',        href: '/leave',        icon: <Calendar size={18} />,        roles: ['super_admin','hr_admin','manager','employee'] },
  { label: 'Shifts',       href: '/shifts',       icon: <CalendarClock size={18} />,   roles: ['super_admin','hr_admin','manager'] },
  { label: 'Payroll',      href: '/payroll',      icon: <Wallet size={18} />,          roles: ['super_admin','hr_admin'] },
  { label: 'Employees',    href: '/employees',    icon: <Users size={18} />,           roles: ['super_admin','hr_admin','manager'] },
  { label: 'Performance',  href: '/performance',  icon: <TrendingUp size={18} />,      roles: ['super_admin','hr_admin','manager'] },
  { label: 'Analytics',    href: '/analytics',    icon: <BarChart2 size={18} />,       roles: ['super_admin','hr_admin'] },
  { label: 'WhatsApp',     href: '/settings/whatsapp', icon: <MessageSquare size={18} />, roles: ['super_admin'] },
  { label: 'Settings',     href: '/settings',     icon: <Settings size={18} />,        roles: ['super_admin','hr_admin'] },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');

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
            <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)] transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--danger-500)] rounded-full" />
            </button>

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
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 page-fade-in" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
