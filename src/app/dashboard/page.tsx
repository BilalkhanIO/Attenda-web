'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { KPICard, Card, Avatar, Badge, Skeleton, PageHeader, Button } from '@/components/ui';
import { attendanceApi } from '@/lib/api';
import { statusConfig, formatTime, getApiError } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import { Users, Clock, Wifi, Calendar, AlertTriangle, RefreshCw, LogIn, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

const n = (v: unknown) => Number(v) || 0;

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
  const [live, setLive] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [filter, setFilter] = useState<string>('all');

  const fetchLive = useCallback(async () => {
    try {
      const { data } = await attendanceApi.getToday();
      setLive(data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 60_000);
    return () => clearInterval(interval);
  }, [fetchLive]);

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

  const secondsAgo = Math.round((new Date().getTime() - lastUpdated.getTime()) / 1000);

  return (
    <DashboardLayout>
      <PageHeader
        title="Live Dashboard"
        subtitle={`Today's attendance overview`}
        actions={
          <div className="flex items-center gap-4 bg-white p-1.5 pl-4 rounded-xl border border-[var(--gray-200)] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success-500)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success-600)]"></span>
              </span>
              <span className="text-[11px] font-medium text-[var(--gray-500)] whitespace-nowrap">
                Updated {secondsAgo}s ago
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-8 py-0 border-none hover:bg-[var(--gray-100)] active:scale-95 transition-all" icon={<RefreshCw size={14} />} onClick={fetchLive}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {loading ? (
          Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (<>
          <KPICard title="In Office"   value={counts.in}     icon={<Wifi size={20} />}           color="var(--success-700)" bg="var(--success-100)" />
          <KPICard title="Late"        value={counts.late}   icon={<AlertTriangle size={20} />}  color="var(--warning-800)" bg="var(--warning-100)"
            delta={counts.late > 0 ? `${live.filter(e => e.status === 'late' && e.check_in_at).length} arrived` : undefined}
            deltaPositive={false}
          />
          <KPICard title="Checked Out" value={counts.out}    icon={<Clock size={20} />}          color="var(--gray-500)"    bg="var(--gray-100)" />
          <KPICard title="Remote"      value={counts.remote} icon={<Wifi size={20} />}           color="var(--purple-700)" bg="var(--purple-100)" />
          <KPICard title="On Leave"    value={counts.leave}  icon={<Calendar size={20} />}       color="var(--primary-600)" bg="var(--primary-100)" />
          <KPICard title="Absent"      value={counts.absent} icon={<AlertTriangle size={20} />}  color="var(--danger-800)" bg="var(--danger-100)"
            delta={counts.absent > 0 ? `${counts.absent} no-show` : undefined}
            deltaPositive={false}
          />
        </>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main attendance grid */}
        <div className="xl:col-span-3">
          <Card>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-[var(--gray-100)] overflow-x-auto">
              {(['all','in','late','remote','leave','absent','out'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap capitalize ${
                    filter === s
                      ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)]'
                      : 'text-[var(--gray-500)] hover:text-[var(--dark-950)]'
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
                        className="flex items-start gap-3 p-3 rounded-xl border border-[var(--gray-100)] hover:border-[var(--gray-200)] hover:shadow-sm transition-all"
                      >
                        <Avatar name={entry.user!.name} imageUrl={entry.user!.avatar_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--dark-950)] truncate">{entry.user!.name}</p>
                          <p className="text-xs text-[var(--gray-500)] truncate">{entry.user!.job_title || entry.user!.department}</p>

                          {/* Check-in / check-out times + work duration */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {checkedIn && (
                              <span className="flex items-center gap-1 text-xs text-[var(--gray-600)]">
                                <LogIn size={10} className="text-[var(--success-600)]" />
                                {formatTime(entry.check_in_at!)}
                                {(entry.late_minutes ?? 0) > 0 && (
                                  <span className="text-[var(--warning-700)] font-medium">+{entry.late_minutes}m</span>
                                )}
                              </span>
                            )}
                            {checkedOut && (
                              <span className="flex items-center gap-1 text-xs text-[var(--gray-600)]">
                                <LogOut size={10} className="text-[var(--gray-400)]" />
                                {formatTime(entry.check_out_at!)}
                                {(entry.early_out_minutes ?? 0) > 0 && (
                                  <span className="text-[var(--warning-700)] font-medium">-{entry.early_out_minutes}m</span>
                                )}
                              </span>
                            )}
                            {checkedIn && (
                              <span className="text-xs text-[var(--gray-500)]">
                                {entry.hours_worked != null
                                  ? <span className="font-medium text-[var(--dark-950)]">{fmtHours(n(entry.hours_worked))}</span>
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
          <Card className="h-full">
            <div className="p-5 border-b border-[var(--gray-100)]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[var(--warning-800)]" />
                <h3 className="text-sm font-bold text-[var(--dark-950)]">Alerts</h3>
                {alerts.length > 0 && (
                  <span className="ml-auto bg-[var(--danger-100)] text-[var(--danger-800)] text-xs font-bold rounded-full px-2 py-0.5">
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
                    const alertBg     = isEarlyOut ? 'var(--warning-50)' : isAbsent ? 'var(--danger-50)' : 'var(--warning-50)';
                    const alertColor  = isAbsent ? 'var(--danger-800)' : 'var(--warning-900)';
                    const alertBorder = isAbsent ? 'var(--danger-200)' : 'var(--warning-200)';
                    return (
                      <div key={entry.user!.id} className="flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-sm" style={{ backgroundColor: alertBg, borderColor: alertBorder }}>
                        <Avatar name={entry.user!.name} imageUrl={entry.user!.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: alertColor }}>{entry.user!.name}</p>
                          <p className="text-[11px] mt-0.5 leading-tight" style={{ color: alertColor }}>
                            {isAbsent    && 'Not checked in'}
                            {isLateNoShow && `${entry.late_minutes}m late — no-show`}
                            {isLateIn    && !isLateNoShow && `Arrived ${entry.late_minutes}m late${entry.check_in_at ? ` at ${formatTime(entry.check_in_at)}` : ''}`}
                            {isEarlyOut  && `Left ${entry.early_out_minutes}m early at ${formatTime(entry.check_out_at!)}`}
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
    </DashboardLayout>
  );
}
