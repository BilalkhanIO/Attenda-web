'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, Input, Textarea,
  EmptyState
} from '@/components/ui';
import { attendanceApi, remoteApi } from '@/lib/api';
import { statusConfig, formatTime, formatDate, getApiError } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import {
  Clock, Edit2, Download, Calendar, Coffee, PlayCircle, StopCircle,
  Home, Check, X, LogIn, LogOut, Wifi, WifiOff, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { useAuth } from '@/lib/auth';

// ─── local types ──────────────────────────────────────
interface RemoteSession {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  duration_type: string;
  created_at: string;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string };
}

interface BreakStatus {
  on_break: boolean;
  break_type?: string;
  started_at?: string;
  total_break_minutes?: number;
  breaks?: { break_type: string; started_at: string; ended_at?: string; minutes?: number }[];
}

// ─── helpers ──────────────────────────────────────────
const n = (v: unknown) => Number(v) || 0;

const typeLabel: Record<string, string> = {
  auto_ip: 'Auto (WiFi)',
  qr:      'QR Scan',
  manual:  'Manual',
  remote:  'Remote',
};

const overrideSchema = z.object({
  check_in_at:  z.string().optional(),
  check_out_at: z.string().optional(),
  reason:       z.string().min(5, 'Reason must be at least 5 characters'),
});
type OverrideForm = z.infer<typeof overrideSchema>;

// ─── helpers ──────────────────────────────────────────
function formatHours(hours: number): string {
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function LiveDuration({ checkInAt }: { checkInAt: string }) {
  const calc = () => {
    const ms = Date.now() - new Date(checkInAt).getTime();
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const [dur, setDur] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setDur(calc()), 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInAt]);
  return (
    <div>
      <span className="text-sm font-medium text-[var(--primary-600)]">{dur}</span>
      <span className="block text-[10px] text-[var(--primary-400)]">in progress</span>
    </div>
  );
}

// ─── Elapsed timer hook ────────────────────────────────
function useElapsed(checkInAt: string | undefined, checkOutAt: string | undefined) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!checkInAt || checkOutAt) { setElapsed(''); return; }
    const tick = () => {
      const dur = intervalToDuration({ start: new Date(checkInAt), end: new Date() });
      const h = dur.hours ?? 0;
      const m = dur.minutes ?? 0;
      const s = dur.seconds ?? 0;
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkInAt, checkOutAt]);
  return elapsed;
}

export default function AttendancePage() {
  const { hasRole } = useAuth();

  // My own today's record
  const [myRecord, setMyRecord]     = useState<AttendanceRecord | null>(null);
  const [checkInLoading, setCheckInLoading]   = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const elapsed = useElapsed(myRecord?.check_in_at, myRecord?.check_out_at);

  // Org-wide table (managers / HR)
  const [records, setRecords]         = useState<AttendanceRecord[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');

  // Break tracking
  const [breakStatus, setBreakStatus] = useState<BreakStatus | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);

  // Remote requests (managers)
  const [remoteSessions, setRemoteSessions] = useState<RemoteSession[]>([]);
  const [remoteActionId, setRemoteActionId]  = useState<string | null>(null);

  // Override modal
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const form = useForm<OverrideForm>({ resolver: zodResolver(overrideSchema) });

  // Late arrival notice + leave check
  interface LateNoticeInfo { id: string; expected_time: string; reason: string; status: string; }
  interface LeaveInfo { id: string; leave_type: string; start_date: string; end_date: string; }
  const [leaveToday, setLeaveToday]   = useState<LeaveInfo | null>(null);
  const [myLateNotice, setMyLateNotice] = useState<LateNoticeInfo | null>(null);
  const [teamNotices, setTeamNotices]   = useState<(LateNoticeInfo & { user?: { id: string; name: string; department?: string } })[]>([]);
  const [lateNoticeModalOpen, setLateNoticeModalOpen] = useState(false);
  const lateNoticeForm = useForm<{ expected_time: string; reason: string }>({
    defaultValues: { expected_time: '', reason: '' },
  });

  // ─── Data loaders ──────────────────────────────────────
  const loadMyRecord = useCallback(async () => {
    try {
      const [recRes, checkRes] = await Promise.allSettled([
        attendanceApi.getMe({ days: 1 }),
        attendanceApi.getLeaveCheck(),
      ]);
      if (recRes.status === 'fulfilled') {
        const rows: AttendanceRecord[] = recRes.value.data.data || [];
        const today = format(new Date(), 'yyyy-MM-dd');
        setMyRecord(rows.find(r => r.date?.startsWith(today)) ?? null);
      }
      if (checkRes.status === 'fulfilled') {
        const info = checkRes.value.data.data;
        setLeaveToday(info.leave ?? null);
        setMyLateNotice(info.late_notice?.status !== 'cancelled' ? (info.late_notice ?? null) : null);
      }
    } catch { /* ignore */ }
  }, []);

  const loadTeamNotices = useCallback(async () => {
    if (!hasRole('manager', 'hr_admin', 'super_admin')) return;
    try {
      const { data } = await attendanceApi.getLateNotices({ status: 'pending' });
      setTeamNotices(data.data || []);
    } catch { /* ignore */ }
  }, [hasRole]);

  const loadBreakStatus = useCallback(async () => {
    try {
      const { data } = await attendanceApi.getBreakStatus();
      setBreakStatus(data.data || null);
    } catch { /* break endpoint may not be live */ }
  }, []);

  const fetchOrgAttendance = useCallback(async () => {
    if (!hasRole('manager', 'hr_admin', 'super_admin')) return;
    setTableLoading(true);
    try {
      const { data } = await attendanceApi.getToday({ date: selectedDate });
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setTableLoading(false);
    }
  }, [selectedDate, hasRole]);

  const loadRemoteSessions = useCallback(async () => {
    if (!hasRole('manager', 'hr_admin', 'super_admin')) return;
    try {
      const { data } = await remoteApi.getSessions({ status: 'pending' });
      setRemoteSessions(data.data || []);
    } catch { /* ignore */ }
  }, [hasRole]);

  useEffect(() => {
    loadMyRecord();
    loadBreakStatus();
    loadRemoteSessions();
    loadTeamNotices();
  }, [loadMyRecord, loadBreakStatus, loadRemoteSessions, loadTeamNotices]);

  useEffect(() => { fetchOrgAttendance(); }, [fetchOrgAttendance]);

  // ─── Check-in / Check-out ─────────────────────────────
  const handleCheckIn = async () => {
    setCheckInLoading(true);
    try {
      await attendanceApi.checkIn({ type: 'manual' });
      toast.success('Checked in successfully');
      loadMyRecord();
      loadBreakStatus();
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckOutLoading(true);
    try {
      await attendanceApi.checkOut();
      toast.success('Checked out successfully');
      loadMyRecord();
      loadBreakStatus();
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCheckOutLoading(false);
    }
  };

  // ─── Break actions ─────────────────────────────────────
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

  // ─── Remote session actions ────────────────────────────
  const handleApproveRemote = async (id: string) => {
    setRemoteActionId(id);
    try {
      await remoteApi.approveSession(id);
      toast.success('Remote session approved');
      loadRemoteSessions();
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRemoteActionId(null);
    }
  };

  const handleRejectRemote = async (id: string) => {
    setRemoteActionId(id);
    try {
      await remoteApi.rejectSession(id);
      toast.success('Remote session rejected');
      loadRemoteSessions();
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRemoteActionId(null);
    }
  };

  // ─── Override ──────────────────────────────────────────
  const openOverride = (record: AttendanceRecord) => {
    form.reset({
      check_in_at:  record.check_in_at  ? format(new Date(record.check_in_at),  "yyyy-MM-dd'T'HH:mm") : '',
      check_out_at: record.check_out_at ? format(new Date(record.check_out_at), "yyyy-MM-dd'T'HH:mm") : '',
      reason: '',
    });
    setOverrideRecord(record);
  };

  const onOverride = async (data: OverrideForm) => {
    if (!overrideRecord) return;
    try {
      await attendanceApi.override(overrideRecord.id, {
        check_in_at:  data.check_in_at  || undefined,
        check_out_at: data.check_out_at || undefined,
        reason:       data.reason,
      });
      toast.success('Attendance record updated');
      setOverrideRecord(null);
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  // ─── Late Notice actions ───────────────────────────────
  const handleSubmitLateNotice = async (values: { expected_time: string; reason: string }) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await attendanceApi.submitLateNotice({ date: today, expected_time: values.expected_time, reason: values.reason });
      setMyLateNotice(data.data);
      setLateNoticeModalOpen(false);
      lateNoticeForm.reset();
      toast.success('Late arrival notice submitted');
    } catch (err) { toast.error(getApiError(err)); }
  };

  const handleAcknowledgeNotice = async (id: string) => {
    try {
      await attendanceApi.acknowledgeLateNotice(id);
      toast.success('Notice acknowledged');
      loadTeamNotices();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const handleCancelMyNotice = async () => {
    if (!myLateNotice) return;
    try {
      await attendanceApi.cancelLateNotice(myLateNotice.id);
      setMyLateNotice(null);
      toast.success('Late notice cancelled');
    } catch (err) { toast.error(getApiError(err)); }
  };

  // ─── Derived values ────────────────────────────────────
  const filtered    = records.filter(r => !statusFilter || r.status === statusFilter);
  const isCheckedIn  = myRecord?.check_in_at && !myRecord?.check_out_at;
  const isCheckedOut = !!myRecord?.check_out_at;

  const myStatusConfig = myRecord
    ? statusConfig[myRecord.status] ?? statusConfig['in']
    : null;

  // ─── Render ────────────────────────────────────────────
  return (
    <DashboardLayout>
      <PageHeader
        title="Attendance"
        subtitle="Track and manage daily attendance"
        actions={
          hasRole('hr_admin', 'super_admin') && (
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              onClick={async () => {
                try {
                  const { data } = await attendanceApi.getReport({ start_date: selectedDate, end_date: selectedDate });
                  const rows: AttendanceRecord[] = data.data || [];
                  const csv = [
                    'Employee,Status,Check In,Check Out,Hours,Type',
                    ...rows.map(r => [
                      r.user?.name || '',
                      r.status,
                      r.check_in_at  ? format(new Date(r.check_in_at),  'HH:mm') : '',
                      r.check_out_at ? format(new Date(r.check_out_at), 'HH:mm') : '',
                      r.hours_worked ? n(r.hours_worked).toFixed(1) : '',
                      r.check_in_type || r.type || '',
                    ].join(','))
                  ].join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  a.download = `attendance-${selectedDate}.csv`;
                  a.click();
                } catch (err) { toast.error(getApiError(err)); }
              }}
            >
              Export CSV
            </Button>
          )
        }
      />

      {/* ── On approved leave today banner ───────────────── */}
      {leaveToday && !myRecord?.check_in_at && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--primary-200)] bg-[var(--primary-50)] px-4 py-3 text-sm text-[var(--primary-700)]">
          <Calendar size={16} className="shrink-0" />
          <span>You have approved <strong>{leaveToday.leave_type.replace(/_/g, ' ')}</strong> today — no check-in required.</span>
        </div>
      )}

      {/* ── Late notice banner ────────────────────────────── */}
      {myLateNotice && !myRecord?.check_in_at && (
        <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${myLateNotice.status === 'acknowledged' ? 'border-[var(--success-300)] bg-[var(--success-50)] text-[var(--success-700)]' : 'border-[var(--warning-300)] bg-[var(--warning-50)] text-[var(--warning-700)]'}`}>
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">
            {myLateNotice.status === 'acknowledged' ? 'Manager acknowledged your late notice' : 'Late arrival notice submitted'} — expected at <strong>{myLateNotice.expected_time}</strong>.
          </span>
          <button onClick={handleCancelMyNotice} className="ml-2 rounded p-0.5 hover:bg-black/10">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── My Attendance Today ───────────────────────────── */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[var(--primary-600)]" />
          <h3 className="text-sm font-bold text-[var(--dark-950)]">My Attendance Today</h3>
          <div className="ml-auto">
            {myStatusConfig ? (
              <Badge label={myStatusConfig.label} color={myStatusConfig.color} bg={myStatusConfig.bg} />
            ) : (
              <Badge label="Not Checked In" color="var(--gray-500)" bg="var(--gray-100)" />
            )}
          </div>
        </div>

        {/* Status info strip */}
        {myRecord?.check_in_at && (
          <div className="flex flex-wrap items-center gap-5 mb-4 p-3 rounded-xl bg-[var(--gray-50)]">
            <div className="flex items-center gap-2">
              <LogIn size={14} className="text-[var(--success-600)]" />
              <div>
                <p className="text-[10px] font-semibold text-[var(--gray-500)] uppercase tracking-wide">Check In</p>
                <p className="text-sm font-bold text-[var(--dark-950)] font-mono">{formatTime(myRecord.check_in_at)}</p>
              </div>
            </div>

            {myRecord.check_out_at ? (
              <div className="flex items-center gap-2">
                <LogOut size={14} className="text-[var(--gray-500)]" />
                <div>
                  <p className="text-[10px] font-semibold text-[var(--gray-500)] uppercase tracking-wide">Check Out</p>
                  <p className="text-sm font-bold text-[var(--dark-950)] font-mono">{formatTime(myRecord.check_out_at)}</p>
                </div>
              </div>
            ) : elapsed ? (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[var(--primary-600)]" />
                <div>
                  <p className="text-[10px] font-semibold text-[var(--gray-500)] uppercase tracking-wide">Elapsed</p>
                  <p className="text-sm font-bold text-[var(--primary-600)] font-mono">{elapsed}</p>
                </div>
              </div>
            ) : null}

            {myRecord.check_out_at && myRecord.hours_worked != null && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[var(--gray-500)]" />
                <div>
                  <p className="text-[10px] font-semibold text-[var(--gray-500)] uppercase tracking-wide">Hours</p>
                  <p className="text-sm font-bold text-[var(--dark-950)]">
                    {n(myRecord.hours_worked).toFixed(1)}h
                    {myRecord.net_hours_worked != null && myRecord.net_hours_worked !== myRecord.hours_worked && (
                      <span className="text-xs font-normal text-[var(--gray-500)]"> · {n(myRecord.net_hours_worked).toFixed(1)}h net</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {(myRecord.check_in_type || myRecord.type) && (
              <div className="flex items-center gap-2 ml-auto">
                <Wifi size={14} className="text-[var(--gray-400)]" />
                <span className="text-xs text-[var(--gray-500)]">
                  {typeLabel[myRecord.check_in_type || myRecord.type!] || myRecord.check_in_type || myRecord.type}
                  {myRecord.auto_checked_out && ' · auto out'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Compliance chips */}
        {myRecord?.check_in_at && (
          (myRecord.late_minutes ?? 0) > 0 ||
          (myRecord.early_out_minutes ?? 0) > 0 ||
          myRecord.adherence_score != null
        ) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(myRecord.late_minutes ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--warning-100)] text-[var(--warning-800)]">
                <AlertTriangle size={11} /> {myRecord.late_minutes} min late
              </span>
            )}
            {(myRecord.early_out_minutes ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--warning-100)] text-[var(--warning-800)]">
                <LogOut size={11} /> Left {myRecord.early_out_minutes} min early
              </span>
            )}
            {myRecord.adherence_score != null && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${
                myRecord.adherence_score >= 90 ? 'bg-[var(--success-100)] text-[var(--success-700)]'
                : myRecord.adherence_score >= 70 ? 'bg-[var(--warning-100)] text-[var(--warning-800)]'
                : 'bg-[var(--danger-100)] text-[var(--danger-700)]'
              }`}>
                <CheckCircle2 size={11} /> {myRecord.adherence_score}% adherence
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {!myRecord?.check_in_at && (
            <>
              <Button
                icon={<LogIn size={14} />}
                loading={checkInLoading}
                onClick={handleCheckIn}
              >
                Check In
              </Button>
              {/* Report Late — show if no active notice yet */}
              {!myLateNotice && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<AlertTriangle size={14} />}
                  onClick={() => setLateNoticeModalOpen(true)}
                >
                  Report Late Arrival
                </Button>
              )}
            </>
          )}
          {isCheckedIn && !isCheckedOut && (
            <Button
              variant="outline"
              icon={<LogOut size={14} />}
              loading={checkOutLoading}
              onClick={handleCheckOut}
            >
              Check Out
            </Button>
          )}
          {/* Pre-announced late badge */}
          {isCheckedIn && myRecord?.late_notice_id && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--warning-100)] px-2.5 py-1 text-xs font-semibold text-[var(--warning-800)]">
              <AlertTriangle size={11} /> Pre-announced late
            </span>
          )}
          {isCheckedOut && (
            <p className="text-sm text-[var(--gray-500)]">Work day complete · Have a great evening!</p>
          )}
        </div>
      </Card>

      {/* ── Break Tracking (only while checked in) ───────── */}
      {isCheckedIn && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Coffee size={16} className="text-[var(--primary-600)]" />
            <h3 className="text-sm font-bold text-[var(--dark-950)]">Break Tracking</h3>
            {breakStatus?.total_break_minutes != null && breakStatus.total_break_minutes > 0 && (
              <span className="ml-auto text-xs text-[var(--gray-500)]">
                {breakStatus.total_break_minutes} min total today
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
                <Button variant="outline" size="sm" icon={<StopCircle size={14} />} loading={breakLoading} onClick={handleEndBreak}>
                  End Break
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" icon={<PlayCircle size={14} />} loading={breakLoading} onClick={() => handleStartBreak('rest')}>
                  Rest Break
                </Button>
                <Button variant="outline" size="sm" icon={<Coffee size={14} />} loading={breakLoading} onClick={() => handleStartBreak('meal')}>
                  Meal Break
                </Button>
              </>
            )}
          </div>

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
                    {b.minutes != null && <span className="text-xs text-[var(--gray-500)]">{b.minutes} min</span>}
                    {!b.ended_at && <Badge label="Active" color="var(--warning-800)" bg="var(--warning-100)" size="sm" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Remote Work Requests (managers only) ─────────── */}
      {hasRole('manager', 'hr_admin', 'super_admin') && remoteSessions.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Home size={16} className="text-[var(--purple-700)]" />
            <h3 className="text-sm font-bold text-[var(--dark-950)]">Pending Remote Work Requests</h3>
            <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-[var(--warning-100)] text-[var(--warning-800)] rounded-full">
              {remoteSessions.length}
            </span>
          </div>
          <div className="space-y-3">
            {remoteSessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                {session.user && <Avatar name={session.user.name} imageUrl={session.user.avatar_url} size="sm" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--dark-950)] truncate">{session.user?.name || '—'}</p>
                  <p className="text-xs text-[var(--gray-500)]">
                    {session.attendance?.date ? formatDate(session.attendance.date) : '—'}
                    {' · '}
                    {session.duration_type.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" icon={<Check size={13} />} loading={remoteActionId === session.id} onClick={() => handleApproveRemote(session.id)}>
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" icon={<X size={13} />} loading={remoteActionId === session.id} onClick={() => handleRejectRemote(session.id)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Team Late Notices (pending, for managers) ────── */}
      {hasRole('manager', 'hr_admin', 'super_admin') && teamNotices.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-[var(--warning-600)]" />
            <h3 className="text-sm font-bold text-[var(--dark-950)]">Pending Late Arrival Notices</h3>
            <span className="ml-auto rounded-full bg-[var(--warning-100)] px-2 py-0.5 text-xs font-semibold text-[var(--warning-800)]">
              {teamNotices.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {teamNotices.map((notice) => (
              <div key={notice.id} className="flex items-center gap-3 rounded-xl border border-[var(--warning-200)] bg-[var(--warning-50)] p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {notice.user && <Avatar name={notice.user.name} size="xs" />}
                    <span className="text-sm font-semibold text-[var(--dark-950)]">{notice.user?.name ?? '—'}</span>
                    {notice.user?.department && (
                      <span className="text-xs text-[var(--gray-500)]">· {notice.user.department}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--gray-500)]">
                    Expected at <strong>{notice.expected_time}</strong> · {notice.reason}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Check size={13} />}
                  onClick={() => handleAcknowledgeNotice(notice.id)}
                >
                  Acknowledge
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Org-wide Attendance Table (managers / HR) ─────── */}
      {hasRole('manager', 'hr_admin', 'super_admin') && (
        <Card>
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
            headers={['Employee', 'Status', 'Check In', 'Check Out', 'Work Time', 'Type', 'Actions']}
            loading={tableLoading}
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
              const cfg  = statusConfig[record.status] ?? statusConfig['in'];
              const cit  = record.check_in_type || record.type;
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
                    {(record.late_minutes ?? 0) > 0 && (
                      <span className="block text-[10px] font-semibold text-[var(--warning-800)]">+{record.late_minutes}m late</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-mono text-[var(--dark-950)]">
                      {record.check_out_at ? formatTime(record.check_out_at) : '—'}
                    </span>
                    {record.auto_checked_out && (
                      <span className="block text-[10px] text-[var(--gray-400)]">auto</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {record.hours_worked != null ? (
                      <div>
                        <span className="text-sm text-[var(--dark-950)]">{formatHours(n(record.hours_worked))}</span>
                        {record.net_hours_worked != null &&
                         Math.abs(n(record.net_hours_worked) - n(record.hours_worked)) >= 0.05 && (
                          <span className="block text-[10px] text-[var(--gray-400)]">
                            {formatHours(n(record.net_hours_worked))} net
                          </span>
                        )}
                      </div>
                    ) : record.check_in_at && !record.check_out_at ? (
                      <LiveDuration checkInAt={record.check_in_at} />
                    ) : (
                      <span className="text-sm text-[var(--gray-400)]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-[var(--gray-500)]">{cit ? (typeLabel[cit] || cit) : '—'}</span>
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
      )}

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
                {(() => {
                  const cfg = statusConfig[overrideRecord.status] ?? statusConfig['in'];
                  return <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />;
                })()}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Check In Time" type="datetime-local" error={form.formState.errors.check_in_at?.message} {...form.register('check_in_at')} />
              <Input label="Check Out Time" type="datetime-local" error={form.formState.errors.check_out_at?.message} {...form.register('check_out_at')} />
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

      {/* ── Late Arrival Notice Modal ─────────────────────── */}
      <Modal
        isOpen={lateNoticeModalOpen}
        onClose={() => { setLateNoticeModalOpen(false); lateNoticeForm.reset(); }}
        title="Report Late Arrival"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setLateNoticeModalOpen(false)}>Cancel</Button>
            <Button onClick={lateNoticeForm.handleSubmit(handleSubmitLateNotice)}>Submit Notice</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--gray-500)]">
            Let your manager know you'll be arriving late. They'll be notified immediately and will not receive a late alert until your expected arrival time passes.
          </p>
          <Input
            label="Expected Arrival Time"
            type="time"
            error={lateNoticeForm.formState.errors.expected_time?.message}
            {...lateNoticeForm.register('expected_time', { required: 'Required' })}
          />
          <Textarea
            label="Reason"
            placeholder="e.g. Medical appointment, traffic delay…"
            rows={3}
            error={lateNoticeForm.formState.errors.reason?.message}
            {...lateNoticeForm.register('reason', { required: 'Required', minLength: { value: 5, message: 'At least 5 characters' } })}
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}
