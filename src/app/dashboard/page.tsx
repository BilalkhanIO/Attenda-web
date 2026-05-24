'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { KPICard, Card, Avatar, Badge, Skeleton, PageHeader, Button } from '@/components/ui';
import { attendanceApi } from '@/lib/api';
import { statusConfig, formatTime, getApiError } from '@/lib/utils';
import type { LiveAttendance } from '@/types';
import { Users, Clock, Wifi, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [live, setLive] = useState<LiveAttendance[]>([]);
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
    late:   live.filter(e => e.status === 'late').length,
    remote: live.filter(e => e.status === 'remote').length,
    leave:  live.filter(e => e.status === 'leave').length,
    absent: live.filter(e => e.status === 'absent').length,
    total:  live.length,
  };

  const alerts = live.filter(e => e.status === 'absent' || e.status === 'late');
  const filtered = filter === 'all' ? live : live.filter(e => e.status === filter);

  const secondsAgo = Math.round((new Date().getTime() - lastUpdated.getTime()) / 1000);

  return (
    <DashboardLayout>
      <PageHeader
        title="Live Dashboard"
        subtitle={`Today's attendance overview`}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--gray-500)]">
              Updated {secondsAgo}s ago
            </span>
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={fetchLive}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {loading ? (
          Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (<>
          <KPICard title="Checked In"  value={counts.in}     icon={<Wifi size={20} />}          color="var(--success-700)" bg="var(--success-100)" />
          <KPICard title="Checked Out" value={counts.in > 0 ? counts.total - counts.in - counts.absent - counts.leave - counts.remote : 0} icon={<Clock size={20} />} color="var(--gray-500)" bg="var(--gray-100)" />
          <KPICard title="Remote"      value={counts.remote} icon={<Wifi size={20} />}           color="var(--purple-700)" bg="var(--purple-100)" />
          <KPICard title="On Leave"    value={counts.leave}  icon={<Calendar size={20} />}       color="var(--primary-600)" bg="var(--primary-100)" />
          <KPICard title="Absent"      value={counts.absent} icon={<AlertTriangle size={20} />}  color="var(--danger-800)" bg="var(--danger-100)"
            delta={counts.absent > 0 ? `${counts.absent} employee${counts.absent > 1 ? 's' : ''} not in` : undefined}
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
                    return (
                      <div
                        key={entry.user.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-[var(--gray-100)] hover:border-[var(--gray-200)] hover:shadow-sm transition-all"
                      >
                        <Avatar name={entry.user.name} imageUrl={entry.user.avatar_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--dark-950)] truncate">{entry.user.name}</p>
                          <p className="text-xs text-[var(--gray-500)] truncate">{entry.user.job_title || entry.user.department}</p>
                          {entry.check_in_at && (
                            <p className="text-xs text-[var(--gray-500)] mt-0.5">
                              In: {formatTime(entry.check_in_at)}
                              {entry.minutes_late != null && entry.minutes_late > 0 && (
                                <span className="text-[var(--warning-800)] ml-1">+{entry.minutes_late}m late</span>
                              )}
                            </p>
                          )}
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
                    const cfg = statusConfig[entry.status];
                    return (
                      <div key={entry.user.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: cfg.bg }}>
                        <Avatar name={entry.user.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: cfg.color }}>{entry.user.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: cfg.color }}>
                            {entry.status === 'absent' ? 'Has not checked in' : `Late by ${entry.minutes_late}m`}
                          </p>
                          {entry.shift_start && (
                            <p className="text-xs opacity-70" style={{ color: cfg.color }}>
                              Shift: {formatTime(entry.shift_start)}
                            </p>
                          )}
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
