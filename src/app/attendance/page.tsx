'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, Input, Textarea,
  EmptyState
} from '@/components/ui';
import { attendanceApi } from '@/lib/api';
import { statusConfig, formatTime, formatDate, getApiError } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import { Clock, Edit2, Download, Calendar, Coffee, PlayCircle, StopCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth';

interface BreakStatus {
  on_break: boolean;
  break_type?: string;
  started_at?: string;
  total_break_minutes?: number;
  breaks?: { break_type: string; started_at: string; ended_at?: string; minutes?: number }[];
}

interface TodayRecord {
  check_in_at?: string;
  check_out_at?: string;
}

const overrideSchema = z.object({
  check_in_at:  z.string().optional(),
  check_out_at: z.string().optional(),
  reason:       z.string().min(5, 'Please provide a reason (min 5 characters)'),
});
type OverrideForm = z.infer<typeof overrideSchema>;

export default function AttendancePage() {
  const { hasRole } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');

  // Break tracking (employee self-service)
  const [breakStatus, setBreakStatus] = useState<BreakStatus | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);

  const form = useForm<OverrideForm>({ resolver: zodResolver(overrideSchema) });

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await attendanceApi.getToday({ date: selectedDate });
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const loadBreakStatus = useCallback(async () => {
    try {
      const { data } = await attendanceApi.getBreakStatus();
      setBreakStatus(data.data || null);
    } catch {
      // break endpoint may not exist yet — silently ignore
    }
  }, []);

  const loadTodayRecord = useCallback(async () => {
    try {
      const { data } = await attendanceApi.getMe({ days: 1 });
      const rows: TodayRecord[] = data.data || [];
      setTodayRecord(rows[0] || null);
    } catch {
      // ignore
    }
  }, []);

  const handleStartBreak = async (breakType: string) => {
    setBreakLoading(true);
    try {
      await attendanceApi.startBreak(breakType);
      toast.success(`${breakType === 'meal' ? 'Meal' : 'Rest'} break started`);
      loadBreakStatus();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setBreakLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setBreakLoading(true);
    try {
      await attendanceApi.endBreak();
      toast.success('Break ended');
      loadBreakStatus();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setBreakLoading(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  useEffect(() => {
    loadBreakStatus();
    loadTodayRecord();
  }, [loadBreakStatus, loadTodayRecord]);

  const openOverride = (record: AttendanceRecord) => {
    form.reset({
      check_in_at:  record.check_in_at ? format(new Date(record.check_in_at), "yyyy-MM-dd'T'HH:mm") : '',
      check_out_at: record.check_out_at ? format(new Date(record.check_out_at), "yyyy-MM-dd'T'HH:mm") : '',
      reason: '',
    });
    setOverrideRecord(record);
  };

  const onOverride = async (data: OverrideForm) => {
    if (!overrideRecord) return;
    try {
      await attendanceApi.override(overrideRecord.id, {
        check_in_at:  data.check_in_at || undefined,
        check_out_at: data.check_out_at || undefined,
        reason:       data.reason,
      });
      toast.success('Attendance record updated');
      setOverrideRecord(null);
      fetchAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const filtered = records.filter(r => !statusFilter || r.status === statusFilter);

  const typeLabel: Record<string, string> = {
    auto_ip: 'Auto (IP)',
    qr:      'QR Scan',
    manual:  'Manual',
    remote:  'Remote',
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Attendance"
        subtitle="Track and manage daily attendance records"
        actions={
          hasRole('hr_admin', 'super_admin') && <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={async () => {
            try {
              const { data } = await attendanceApi.getReport({ start_date: selectedDate, end_date: selectedDate });
              const rows = data.data || records;
              const csv = ['Employee,Status,Check In,Check Out,Hours,Type',
                ...rows.map((r: AttendanceRecord) => [
                  r.user?.name || '',
                  r.status,
                  r.check_in_at ? format(new Date(r.check_in_at), 'HH:mm') : '',
                  r.check_out_at ? format(new Date(r.check_out_at), 'HH:mm') : '',
                  r.hours_worked?.toFixed(1) || '',
                  r.type,
                ].join(','))
              ].join('\n');
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              a.download = `attendance-${selectedDate}.csv`;
              a.click();
            } catch (err) { toast.error(getApiError(err)); }
          }}>Export CSV</Button>
        }
      />

      {/* ── Break Tracking Card (employee self-service, only when checked in) ── */}
      {todayRecord?.check_in_at && !todayRecord?.check_out_at && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Coffee size={16} className="text-[var(--primary-600)]" />
            <h3 className="text-sm font-bold text-[var(--dark-950)]">Break Tracking</h3>
            {breakStatus?.total_break_minutes != null && breakStatus.total_break_minutes > 0 && (
              <span className="ml-auto text-xs text-[var(--gray-500)]">
                {breakStatus.total_break_minutes} min total break today
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {breakStatus?.on_break ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--warning-100)] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[var(--warning-800)] animate-pulse" />
                  <span className="text-sm font-semibold text-[var(--warning-800)]">
                    On {breakStatus.break_type === 'meal' ? 'Meal' : 'Rest'} Break
                  </span>
                  {breakStatus.started_at && (
                    <span className="text-xs text-[var(--warning-800)] opacity-75">
                      since {formatTime(breakStatus.started_at)}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<StopCircle size={14} />}
                  loading={breakLoading}
                  onClick={handleEndBreak}
                >
                  End Break
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<PlayCircle size={14} />}
                  loading={breakLoading}
                  onClick={() => handleStartBreak('rest')}
                >
                  Rest Break
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Coffee size={14} />}
                  loading={breakLoading}
                  onClick={() => handleStartBreak('meal')}
                >
                  Meal Break
                </Button>
              </>
            )}
          </div>

          {/* Break history for today */}
          {breakStatus?.breaks && breakStatus.breaks.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-semibold text-[var(--gray-500)] uppercase tracking-wide mb-2">Today&apos;s Breaks</p>
              {breakStatus.breaks.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[var(--gray-50)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Coffee size={11} className="text-[var(--gray-500)]" />
                    <span className="text-xs font-medium text-[var(--dark-950)] capitalize">{b.break_type} break</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--gray-500)] font-mono">{formatTime(b.started_at)}</span>
                    {b.ended_at && (
                      <>
                        <span className="text-xs text-[var(--gray-500)]">–</span>
                        <span className="text-xs text-[var(--gray-500)] font-mono">{formatTime(b.ended_at)}</span>
                      </>
                    )}
                    {b.minutes != null && (
                      <span className="text-xs text-[var(--gray-500)]">{b.minutes} min</span>
                    )}
                    {!b.ended_at && (
                      <Badge label="Active" color="var(--warning-800)" bg="var(--warning-100)" size="sm" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--gray-100)]">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--gray-500)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none"
          >
            <option value="">All Statuses</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <span className="text-sm text-[var(--gray-500)] ml-auto">{filtered.length} records</span>
        </div>

        <Table
          headers={['Employee', 'Status', 'Check In', 'Check Out', 'Hours', 'Type', 'Actions']}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<Clock size={24} />}
              title="No attendance records"
              description="No records found for the selected date and filters."
            />
          }
        >
          {filtered.map((record) => {
            const user = record.user;
            const cfg  = statusConfig[record.status];
            return (
              <tr key={record.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] transition-colors">
                <td className="py-3 px-4">
                  {user ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} imageUrl={user.avatar_url} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--dark-950)]">{user.name}</p>
                        <p className="text-xs text-[var(--gray-500)]">{user.department}</p>
                      </div>
                    </div>
                  ) : <span className="text-xs text-[var(--gray-500)]">—</span>}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
                    {record.is_overridden && (
                      <span className="text-xs text-[var(--primary-600)] font-medium">edited</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-mono text-[var(--dark-950)]">
                    {record.check_in_at ? formatTime(record.check_in_at) : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-mono text-[var(--dark-950)]">
                    {record.check_out_at ? formatTime(record.check_out_at) : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-[var(--gray-500)]">
                    {record.hours_worked ? `${record.hours_worked.toFixed(1)}h` : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-[var(--gray-500)]">{typeLabel[record.type] || record.type}</span>
                </td>
                <td className="py-3 px-4">
                  {hasRole('manager', 'hr_admin', 'super_admin') && (
                    <Button variant="ghost" size="sm" icon={<Edit2 size={12} />} onClick={() => openOverride(record)}>
                      Override
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* Override Modal */}
      <Modal
        isOpen={!!overrideRecord}
        onClose={() => setOverrideRecord(null)}
        title="Override Attendance"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverrideRecord(null)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onOverride)} loading={form.formState.isSubmitting}>
              Save Override
            </Button>
          </>
        }
      >
        {overrideRecord && (
          <div className="space-y-4">
            {overrideRecord.user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gray-50)]">
                <Avatar name={overrideRecord.user.name} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{overrideRecord.user.name}</p>
                  <p className="text-xs text-[var(--gray-500)]">{formatDate(overrideRecord.date)}</p>
                </div>
                <Badge label={statusConfig[overrideRecord.status].label} color={statusConfig[overrideRecord.status].color} bg={statusConfig[overrideRecord.status].bg} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Check In Time"
                type="datetime-local"
                error={form.formState.errors.check_in_at?.message}
                {...form.register('check_in_at')}
              />
              <Input
                label="Check Out Time"
                type="datetime-local"
                error={form.formState.errors.check_out_at?.message}
                {...form.register('check_out_at')}
              />
            </div>
            <Textarea
              label="Reason for Override"
              required
              placeholder="Explain why you are overriding this record..."
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
            <p className="text-xs text-[var(--gray-500)]">
              This action will be logged with your name and timestamp for audit purposes.
            </p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
