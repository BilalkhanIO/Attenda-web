'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { KPICard, Card, Avatar, Badge, Skeleton, PageHeader, Button, Modal } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { todayAttendanceQuery, myTodayStatusQuery } from '@/lib/queries';
import { statusConfig, formatTime } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import { Users, Clock, Wifi, Calendar, AlertTriangle, RefreshCw, LogIn, LogOut } from 'lucide-react';

const n = (v: unknown) => Number(v) || 0;

function totalBreakMinutes(record?: Pick<AttendanceRecord, 'break_minutes' | 'break_records'> | null) {
  const breaks = record?.break_records ?? [];
  if (breaks.length === 0) return n(record?.break_minutes);

  return breaks.reduce((sum, b) => {
    if (b.duration_mins != null) return sum + n(b.duration_mins);
    if (!b.break_start) return sum;
    const start = new Date(b.break_start).getTime();
    const end = b.break_end ? new Date(b.break_end).getTime() : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return sum;
    return sum + Math.floor((end - start) / 60000);
  }, 0);
}

function fmtHours(hours: number): string {
  const m = Math.round(hours * 60);
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h === 0) return `${mins}m`;
  if (mins === 0) return `${h}h`;
  return `${h}h ${mins}m`;
}

function CardElapsed({ checkInAt }: { checkInAt: string }) {
  const calc = () => {
    const ms = Date.now() - new Date(checkInAt).getTime();
    const m = Math.floor(ms / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };
  const [dur, setDur] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setDur(calc()), 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInAt]);
  return <span className="font-medium text-[var(--primary-600)]">{dur}</span>;
}

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  // GET /attendance/today needs attendance.view_team — others get a personal view.
  const canViewTeam = hasPermission('attendance.view_team');
  const [filter, setFilter] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<AttendanceRecord | null>(null);

  // Polls only while a tab is visible; pauses in background tabs and
  // refetches immediately on focus.
  const teamQuery = useQuery({
    ...todayAttendanceQuery(),
    enabled: canViewTeam,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const myQuery = useQuery({
    ...myTodayStatusQuery(),
    enabled: !canViewTeam,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const live = teamQuery.data ?? [];
  const myStatus = myQuery.data ?? null;
  const loading = canViewTeam ? teamQuery.isPending : myQuery.isPending;
  const fetchLive = canViewTeam ? teamQuery.refetch : myQuery.refetch;
  const updatedAt = canViewTeam ? teamQuery.dataUpdatedAt : myQuery.dataUpdatedAt;

  // Counts
  const counts = {
    in:     live.filter(e => e.status === 'in').length,
    out:    live.filter(e => e.status === 'out').length,
    late:   live.filter(e => e.status === 'late').length,
    remote: live.filter(e => e.status === 'remote').length,
    leave:  live.filter(e => e.status === 'leave').length,
    absent: live.filter(e => e.status === 'absent').length,
    total:  live.length,
  };

  const alerts = live.filter(e =>
    e.status === 'absent' ||
    (e.status === 'late' && !e.check_in_at) ||
    (e.check_in_at && (e.late_minutes ?? 0) > 0) ||
    (e.check_out_at && (e.early_out_minutes ?? 0) > 0)
  );
  const filtered = filter === 'all' ? live : live.filter(e => e.status === filter);

  // "Seconds since last refresh" inherently reads the wall clock at render
  // time — memoising or caching it would display stale data. Display-only,
  // so the render-purity rule is inapplicable here.
  // eslint-disable-next-line react-hooks/purity
  const secondsAgo = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : 0;

  if (!canViewTeam) {
    const att = myStatus?.attendance;
    const breakMins = totalBreakMinutes(att);
    const cfg = att ? statusConfig[att.status as keyof typeof statusConfig] : null;
    const preLate = myStatus?.pre_checkin_late_minutes ?? 0;
    return (
      <DashboardLayout>
        <PageHeader
          title="My Day"
          subtitle="Your attendance overview for today"
          actions={
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchLive()}>
              Refresh
            </Button>
          }
        />
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KPICard title="Status" value={cfg?.label ?? (preLate > 0 ? `${preLate}m late` : 'Not checked in')}
                icon={<Wifi size={16} />} color={cfg?.color ?? 'var(--on-glass-muted)'} bg="#10b981" />
              <KPICard title="Check-In" value={att?.check_in_at ? formatTime(att.check_in_at) : '—'}
                icon={<LogIn size={16} />} color="var(--success-500)" bg="#10b981"
                delta={(att?.late_minutes ?? 0) > 0 ? `+${att!.late_minutes}m late` : undefined} deltaPositive={false} />
              <KPICard title="Check-Out" value={att?.check_out_at ? formatTime(att.check_out_at) : '—'}
                icon={<LogOut size={16} />} color="var(--on-glass-muted)" bg="#94a3b8" />
              <KPICard title="Hours" value={att?.net_hours_worked != null ? fmtHours(n(att.net_hours_worked)) : '—'}
                icon={<Clock size={16} />} color="var(--primary-500)" bg="#00C896"
                delta={breakMins > 0 ? `${breakMins}m breaks` : undefined} />
            </div>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-[var(--primary-600)]" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Today&apos;s Shift</h3>
              </div>
              {myStatus?.shift ? (
                <p className="text-sm font-bold text-white">
                  {myStatus.shift.name}
                  <span className="ml-3 font-mono text-[var(--on-glass-muted)]">
                    {myStatus.shift.start_time} – {myStatus.shift.end_time}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-[var(--on-glass-muted)]">No shift scheduled for today.</p>
              )}
            </Card>
          </>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Live Dashboard"
        subtitle={`Today's attendance overview`}
        actions={
          <div className="flex items-center gap-4 bg-[var(--glass-10)] p-1.5 pl-5 rounded-2xl border border-[var(--glass-border)] shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success-500)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--success-600)]"></span>
              </span>
              <span className="text-xs font-bold text-[var(--on-glass-muted)] whitespace-nowrap uppercase tracking-widest">
                Updated {secondsAgo}s ago
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-9 py-0 border-none bg-transparent hover:bg-[var(--glass-15)] active:scale-95 transition-all" icon={<RefreshCw size={14} />} onClick={() => fetchLive()}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {loading ? (
          Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (<>
          <KPICard title="In Office"   value={counts.in}     icon={<Wifi size={16} />}           color="var(--success-500)" bg="#10b981" />
          <KPICard title="Late"        value={counts.late}   icon={<AlertTriangle size={16} />}  color="var(--warning-500)" bg="#f59e0b"
            delta={counts.late > 0 ? `${live.filter(e => e.status === 'late' && e.check_in_at).length} arrived` : undefined}
            deltaPositive={false}
          />
          <KPICard title="Checked Out" value={counts.out}    icon={<Clock size={16} />}          color="var(--on-glass-muted)" bg="#94a3b8" />
          <KPICard title="Remote"      value={counts.remote} icon={<Wifi size={16} />}           color="#a78bfa" bg="#8b5cf6" />
          <KPICard title="On Leave"    value={counts.leave}  icon={<Calendar size={16} />}       color="var(--primary-500)" bg="#00C896" />
          <KPICard title="Absent"      value={counts.absent} icon={<AlertTriangle size={16} />}  color="var(--danger-500)" bg="#ef4444"
            delta={counts.absent > 0 ? `${counts.absent} no-show` : undefined}
            deltaPositive={false}
          />
        </>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Main attendance grid */}
        <div className="xl:col-span-3">
          <Card>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--glass-05)]">
              {(['all','in','late','remote','leave','absent','out'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
                    filter === s
                      ? 'text-[var(--primary-600)] border-[var(--primary-600)]'
                      : 'text-[var(--on-glass-dim)] border-transparent hover:text-white'
                  }`}
                >
                  {s === 'all' ? `All (${counts.total})` : `${statusConfig[s as keyof typeof statusConfig]?.label ?? s}`}
                </button>
              ))}
            </div>

            <div className="p-5">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({length:9}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-[var(--gray-500)] text-sm">No employees in this category</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((entry) => {
                    const cfg = statusConfig[entry.status];
                    const checkedIn  = !!entry.check_in_at;
                    const checkedOut = !!entry.check_out_at;
                    const isActive   = checkedIn && !checkedOut;
                    return (
                      <div
                        key={entry.user!.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedEmployee(entry)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedEmployee(entry); } }}
                        className="flex items-start gap-3 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] hover:shadow-xl transition-all group cursor-pointer"
                      >
                        <Avatar name={entry.user!.name} imageUrl={entry.user!.avatar_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate group-hover:text-[var(--primary-600)] transition-colors">{entry.user!.name}</p>
                          <p className="text-xs font-medium text-[var(--on-glass-muted)] truncate">{entry.user!.job_title || entry.user!.department}</p>

                          {/* Check-in / check-out times + work duration */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {checkedIn && (
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                <LogIn size={11} className="text-[var(--success-500)]" />
                                {formatTime(entry.check_in_at!)}
                                {(entry.late_minutes ?? 0) > 0 && (
                                  <span className="text-[var(--warning-500)]">+{entry.late_minutes}m</span>
                                )}
                              </span>
                            )}
                            {checkedOut && (
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                <LogOut size={11} className="text-[var(--gray-400)]" />
                                {formatTime(entry.check_out_at!)}
                                {(entry.early_out_minutes ?? 0) > 0 && (
                                  <span className="text-[var(--warning-500)]">-{entry.early_out_minutes}m</span>
                                )}
                              </span>
                            )}
                            {checkedIn && (
                              <span className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-wider">
                                {entry.hours_worked != null
                                  ? <span className="text-[var(--primary-600)]">{fmtHours(n(entry.hours_worked))}</span>
                                  : isActive && <CardElapsed checkInAt={entry.check_in_at!} />}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Alerts panel */}
        <div className="xl:col-span-1">
          <Card className="h-full border border-[var(--danger-500)]/20 bg-[var(--danger-500)]/5 shadow-2xl shadow-[var(--danger-500)]/10">
            <div className="p-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[var(--danger-500)]" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Alerts</h3>
                {alerts.length > 0 && (
                  <span className="ml-auto bg-[var(--danger-500)] text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-lg shadow-[var(--danger-500)]/30">
                    {alerts.length}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : alerts.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[var(--success-100)] flex items-center justify-center mx-auto mb-2">
                    <Users size={18} className="text-[var(--success-700)]" />
                  </div>
                  <p className="text-sm text-[var(--gray-500)]">All clear! No alerts right now.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((entry) => {
                    const isAbsent    = entry.status === 'absent';
                    const isLateNoShow = entry.status === 'late' && !entry.check_in_at;
                    const isLateIn    = (entry.late_minutes ?? 0) > 0 && !!entry.check_in_at;
                    const isEarlyOut  = (entry.early_out_minutes ?? 0) > 0 && !!entry.check_out_at;
                    const alertBg     = isAbsent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';
                    const alertColor  = isAbsent ? '#ef4444' : '#f59e0b';
                    const alertBorder = isAbsent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';
                    return (
                      <div key={entry.user!.id} className="flex items-start gap-3 p-3.5 rounded-2xl border transition-all hover:bg-white/5 active:scale-[0.98]" style={{ backgroundColor: alertBg, borderColor: alertBorder }}>
                        <Avatar name={entry.user!.name} imageUrl={entry.user!.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-white truncate">{entry.user!.name}</p>
                          <p className="text-[11px] mt-1 font-bold leading-snug" style={{ color: alertColor }}>
                            {isAbsent    && 'NOT CHECKED IN'}
                            {isLateNoShow && `${entry.late_minutes}M LATE — NO-SHOW`}
                            {isLateIn    && !isLateNoShow && `ARRIVED ${entry.late_minutes}M LATE`}
                            {isEarlyOut  && `LEFT ${entry.early_out_minutes}M EARLY`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      {/* Employee Detail Modal */}
      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title="Attendance Detail"
        size="sm"
      >
        {selectedEmployee && (() => {
          const cfg = statusConfig[selectedEmployee.status];
          const breakMins = totalBreakMinutes(selectedEmployee);
          const typeLabels: Record<string, string> = {
            auto_ip: 'Auto (WiFi)',
            qr:      'QR Scan',
            manual:  'Manual',
            remote:  'Remote',
          };
          const checkedIn  = !!selectedEmployee.check_in_at;
          const checkedOut = !!selectedEmployee.check_out_at;
          return (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <Avatar name={selectedEmployee.user!.name} imageUrl={selectedEmployee.user!.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selectedEmployee.user!.name}</p>
                  <p className="text-[11px] text-[var(--on-glass-muted)] truncate">
                    {selectedEmployee.user!.job_title || selectedEmployee.user!.department || 'Employee'}
                  </p>
                </div>
                <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />
              </div>

              {/* Check-in / Check-out */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                  <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mb-2 flex items-center gap-1">
                    <LogIn size={10} className="text-[var(--success-500)]" /> Check-In
                  </p>
                  {checkedIn ? (
                    <div>
                      <p className="text-lg font-black text-white font-mono">{formatTime(selectedEmployee.check_in_at!)}</p>
                      {(selectedEmployee.late_minutes ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-[var(--warning-500)] mt-0.5">+{selectedEmployee.late_minutes}m late</p>
                      )}
                      {(selectedEmployee.early_checkin_minutes ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-[var(--success-500)] mt-0.5">{selectedEmployee.early_checkin_minutes}m early</p>
                      )}
                      <p className="text-[10px] text-[var(--on-glass-dim)] mt-1">
                        {typeLabels[selectedEmployee.check_in_type] || selectedEmployee.check_in_type}
                      </p>
                    </div>
                  ) : (
                    <p className="text-lg font-black text-[var(--on-glass-dim)]">—</p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                  <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mb-2 flex items-center gap-1">
                    <LogOut size={10} className="text-[var(--gray-400)]" /> Check-Out
                  </p>
                  {checkedOut ? (
                    <div>
                      <p className="text-lg font-black text-white font-mono">{formatTime(selectedEmployee.check_out_at!)}</p>
                      {(selectedEmployee.early_out_minutes ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-[var(--warning-500)] mt-0.5">-{selectedEmployee.early_out_minutes}m early</p>
                      )}
                      {selectedEmployee.auto_checked_out && (
                        <p className="text-[10px] text-[var(--on-glass-dim)] mt-1">Auto (WiFi lost)</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-lg font-black text-[var(--on-glass-dim)]">—</p>
                  )}
                </div>
              </div>

              {/* Hours row */}
              <div className="flex gap-2">
                {checkedIn && (
                  <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                    <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Time In</p>
                    {selectedEmployee.hours_worked != null ? (
                      <p className="text-sm font-black text-[var(--primary-600)]">{fmtHours(n(selectedEmployee.hours_worked))}</p>
                    ) : !checkedOut ? (
                      <p className="text-sm font-black text-[var(--primary-600)]"><CardElapsed checkInAt={selectedEmployee.check_in_at!} /></p>
                    ) : null}
                  </div>
                )}
                {breakMins > 0 && (
                  <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                    <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Break</p>
                    <p className="text-sm font-black text-white">{breakMins}m</p>
                  </div>
                )}
                {(selectedEmployee.overtime_hours ?? 0) > 0 && (
                  <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20">
                    <p className="text-[10px] font-bold text-[var(--primary-600)] uppercase tracking-widest">OT</p>
                    <p className="text-sm font-black text-[var(--primary-600)]">{fmtHours(n(selectedEmployee.overtime_hours))}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </DashboardLayout>
  );
}
