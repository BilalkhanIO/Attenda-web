'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, Input, Textarea,
  StatBox, SectionCard, RequestItem, Dropdown, DatePicker, DateTimePicker,
} from '@/components/ui';
import type { DropdownOption } from '@/components/ui';
import { attendanceApi, remoteApi, overtimeApi } from '@/lib/api';
import { statusConfig, formatTime, formatDate, getApiError, runDeferred } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import {
  Clock, Edit2, Download, Calendar, Coffee, PlayCircle, StopCircle,
  Home, Check, X, LogIn, LogOut, Wifi, WifiOff, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, intervalToDuration } from 'date-fns';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

// ─── local types ──────────────────────────────────────
interface RemoteSession {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  duration_type: string;
  created_at: string;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string };
}

interface OvertimeRequest {
  id: string;
  requested_minutes: number;
  reason?: string;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string; shift?: { name: string } };
}

interface BreakRecordLite {
  break_type: string;
  break_start: string;
  break_end?: string | null;
  duration_mins?: number | null;
  is_paid?: boolean;
}

interface TodayStatus {
  active_break?: { break_type: string; break_start: string; break_end?: string } | null;
  attendance?: { break_minutes?: number; break_records?: BreakRecordLite[] } | null;
  shift?: { breaks?: { id: string; name: string; break_kind?: string; break_minutes: number; allowed_count_per_shift?: number; is_paid?: boolean }[] } | null;
}

// ─── helpers ──────────────────────────────────────────
const n = (v: unknown) => Number(v) || 0;

function totalBreakMinutes(record?: { break_minutes?: number; break_records?: BreakRecordLite[] } | null) {
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
      <span className="text-sm font-bold text-[var(--primary-600)]">{dur}</span>
      <span className="block text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">In Progress</span>
    </div>
  );
}

// ─── Elapsed timer hook ────────────────────────────────
function useElapsed(checkInAt: string | undefined, checkOutAt: string | undefined) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!checkInAt || checkOutAt) return;
    const tick = () => {
      const dur = intervalToDuration({ start: new Date(checkInAt), end: new Date() });
      const h = dur.hours ?? 0;
      const m = dur.minutes ?? 0;
      const s = dur.seconds ?? 0;
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    const cancelFirstTick = runDeferred(tick);
    const id = setInterval(tick, 1000);
    return () => { cancelFirstTick(); clearInterval(id); };
  }, [checkInAt, checkOutAt]);
  // Without an active session the timer is blank, regardless of what the
  // interval last wrote — no state reset needed.
  return (!checkInAt || checkOutAt) ? '' : elapsed;
}

export default function AttendancePage() {
  const { hasPermission } = useAuth();

  // My own today's record
  const [myRecord, setMyRecord]     = useState<AttendanceRecord | null>(null);
  const [checkInLoading, setCheckInLoading]   = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const elapsed = useElapsed(myRecord?.check_in_at, myRecord?.check_out_at);

  // Org-wide table (managers / HR)
  const [records, setRecords]         = useState<AttendanceRecord[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');

  // Break tracking — sourced from today-status (single source of truth)
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);

  // Remote requests (managers)
  const [remoteSessions, setRemoteSessions] = useState<RemoteSession[]>([]);
  const [remoteActionId, setRemoteActionId]  = useState<string | null>(null);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [overtimeActionId, setOvertimeActionId] = useState<string | null>(null);
  const [rejectOvertimeId, setRejectOvertimeId] = useState<string | null>(null);
  const [rejectOvertimeReason, setRejectOvertimeReason] = useState('');

  // Override modal
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const form = useForm<OverrideForm>({ resolver: zodResolver(overrideSchema) });

  // Late arrival notice + leave check
  interface LateNoticeInfo { id: string; expected_time: string; reason: string; status: string; date?: string; }
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
    if (!hasPermission('attendance.late_notices.manage')) return;
    try {
      const { data } = await attendanceApi.getLateNotices({ status: 'pending' });
      setTeamNotices(data.data || []);
    } catch { /* ignore */ }
  }, [hasPermission]);

  const loadTodayStatus = useCallback(async () => {
    try {
      const { data } = await attendanceApi.getTodayStatus();
      setTodayStatus(data.data || null);
    } catch { /* ignore */ }
  }, []);

  const fetchOrgAttendance = useCallback(async () => {
    if (!hasPermission('attendance.view_team')) return;
    setTableLoading(true);
    try {
      const { data } = await attendanceApi.getToday({ date: selectedDate });
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setTableLoading(false);
    }
  }, [selectedDate, hasPermission]);

  const loadRemoteSessions = useCallback(async () => {
    if (!hasPermission('remote.approve')) return;
    try {
      const { data } = await remoteApi.getSessions({ status: 'pending' });
      setRemoteSessions(data.data || []);
    } catch { /* ignore */ }
  }, [hasPermission]);

  const loadOvertimeRequests = useCallback(async () => {
    if (!hasPermission('overtime.manage')) return;
    try {
      const { data } = await overtimeApi.getRequests({ status: 'pending' });
      setOvertimeRequests(data.data || []);
    } catch { /* ignore */ }
  }, [hasPermission]);

  useEffect(() => runDeferred(() => {
    loadMyRecord();
    loadTodayStatus();
    loadRemoteSessions();
    loadOvertimeRequests();
    loadTeamNotices();
  }), [loadMyRecord, loadTodayStatus, loadRemoteSessions, loadOvertimeRequests, loadTeamNotices]);

  useEffect(() => runDeferred(fetchOrgAttendance), [fetchOrgAttendance]);

  // ─── Check-in / Check-out ─────────────────────────────
  const handleCheckIn = async () => {
    setCheckInLoading(true);
    try {
      await attendanceApi.checkIn({ type: 'manual' });
      toast.success('Checked in successfully');
      loadMyRecord();
      loadTodayStatus();
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
      loadTodayStatus();
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCheckOutLoading(false);
    }
  };

  const handleRequestOvertime = async () => {
    if (!myRecord) return;
    setOvertimeLoading(true);
    try {
      await overtimeApi.request({
        attendance_id: myRecord.id,
        reason: `Worked ${myRecord.extra_office_minutes ?? 0}m after shift end`,
      });
      toast.success('Overtime request sent');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setOvertimeLoading(false);
    }
  };

  // ─── Break actions ─────────────────────────────────────
  const handleStartBreak = async (breakType: string, shiftBreakId?: string) => {
    setBreakLoading(true);
    try {
      await attendanceApi.startBreak(breakType, shiftBreakId);
      toast.success(`${breakType === 'meal' ? 'Meal' : 'Rest'} break started`);
      loadTodayStatus();
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
      loadTodayStatus();
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

  const handleApproveOvertime = async (id: string) => {
    setOvertimeActionId(id);
    try {
      await overtimeApi.approveRequest(id);
      toast.success('Overtime approved');
      loadOvertimeRequests();
      fetchOrgAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setOvertimeActionId(null);
    }
  };

  const handleRejectOvertime = (id: string) => {
    setRejectOvertimeId(id);
    setRejectOvertimeReason('');
  };

  const handleConfirmRejectOvertime = async () => {
    if (!rejectOvertimeId || !rejectOvertimeReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setOvertimeActionId(rejectOvertimeId);
    try {
      await overtimeApi.rejectRequest(rejectOvertimeId, rejectOvertimeReason);
      toast.success('Overtime rejected');
      setRejectOvertimeId(null);
      setRejectOvertimeReason('');
      loadOvertimeRequests();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setOvertimeActionId(null);
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
  const filtered = records.filter(r => !statusFilter || r.status === statusFilter);
  const statusOptions: DropdownOption[] = Object.entries(statusConfig).map(([key, cfg]) => ({ value: key, label: cfg.label }));
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
          hasPermission('attendance.export') && (
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* ── My Attendance Status Card ───────────────────── */}
        <div className="xl:col-span-2">
          <Card className="p-4 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--primary-600)]/5 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <div className="flex items-center justify-between mb-3 relative z-10">
              <div>
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em]">Employee Status</p>
                <h3 className="text-lg font-black text-white tracking-tight">My Attendance</h3>
              </div>
              <div>
                {myStatusConfig ? (
                  <Badge label={myStatusConfig.label} color={myStatusConfig.color} bg={myStatusConfig.bg} size="sm" />
                ) : (
                  <Badge label="NOT CHECKED IN" color="var(--on-glass-dim)" bg="#334155" size="sm" />
                )}
              </div>
            </div>

            {/* Content Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 relative z-10">
              <StatBox
                label="Check In"
                labelIcon={<LogIn size={10} className="text-[var(--success-500)]" />}
                value={<span className="font-mono">{myRecord?.check_in_at ? formatTime(myRecord.check_in_at) : '--:--'}</span>}
              />
              <StatBox
                label={myRecord?.check_out_at ? 'Check Out' : 'Live'}
                labelIcon={myRecord?.check_out_at
                  ? <LogOut size={10} className="text-[var(--on-glass-dim)]" />
                  : <Clock size={10} className="text-[var(--primary-600)]" />}
                value={
                  <span className={`font-mono ${myRecord?.check_out_at ? 'text-white' : 'text-[var(--primary-600)]'}`}>
                    {myRecord?.check_out_at ? formatTime(myRecord.check_out_at) : (elapsed || '00:00')}
                  </span>
                }
              />
              <StatBox
                label="Hours"
                labelIcon={<CheckCircle2 size={10} className="text-[var(--secondary)]" />}
                value={myRecord?.hours_worked != null ? `${n(myRecord.hours_worked).toFixed(1)}h` : '0.0h'}
              />
              <StatBox
                label="Method"
                labelIcon={<Wifi size={10} className="text-[var(--on-glass-dim)]" />}
                value={<span className="text-xs text-white/70 font-mono">{myRecord ? (typeLabel[myRecord.check_in_type || myRecord.type!] || 'MANUAL') : '---'}</span>}
              />
            </div>

            {/* Compliance Alerts */}
            {myRecord?.check_in_at && (
              ((myRecord.late_minutes ?? 0) > 0 || (myRecord.early_out_minutes ?? 0) > 0) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(myRecord.late_minutes ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 text-[10px] font-black text-[var(--danger-500)] uppercase tracking-widest">
                       <AlertTriangle size={10} /> {myRecord.late_minutes}M Late
                    </div>
                  )}
                  {(myRecord.early_out_minutes ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 text-[10px] font-black text-[var(--warning-500)] uppercase tracking-widest">
                       <LogOut size={10} /> {myRecord.early_out_minutes}M Early
                    </div>
                  )}
                </div>
              )
            )}

            {/* Main Actions */}
            <div className="flex items-center gap-3 relative z-10 pt-3 border-t border-[var(--glass-border)]">
              {!myRecord?.check_in_at ? (
                <>
                  <Button
                    size="sm"
                    icon={<LogIn size={14} />}
                    loading={checkInLoading}
                    onClick={handleCheckIn}
                  >
                    CHECK IN
                  </Button>
                  {!myLateNotice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<AlertTriangle size={14} />}
                      onClick={() => setLateNoticeModalOpen(true)}
                    >
                      Report Late
                    </Button>
                  )}
                </>
              ) : isCheckedIn && !isCheckedOut ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[var(--danger-500)]/30 text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10"
                  icon={<LogOut size={14} />}
                  loading={checkOutLoading}
                  onClick={handleCheckOut}
                >
                  CHECK OUT
                </Button>
              ) : isCheckedOut ? (
                <>
                  <div className="flex items-center gap-2 text-[var(--on-glass-muted)]">
                     <div className="w-6 h-6 rounded-full bg-[var(--success-500)]/20 flex items-center justify-center">
                        <Check size={12} className="text-[var(--success-500)]" />
                     </div>
                     <span className="text-xs font-bold uppercase tracking-widest">Complete</span>
                  </div>
                  {(myRecord.extra_office_minutes ?? 0) > 0 && (
                    <Button variant="outline" size="sm" icon={<Clock size={13} />} loading={overtimeLoading} onClick={handleRequestOvertime}>
                      Request Overtime
                    </Button>
                  )}
                </>
              ) : null}

              {myLateNotice && !myRecord?.check_in_at && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 rounded-xl text-[10px] font-black text-[var(--warning-500)] uppercase tracking-widest">
                   <Clock size={10} /> Late: {myLateNotice.expected_time}
                   <button onClick={handleCancelMyNotice} aria-label="Cancel late notice" className="ml-1 hover:text-white transition-colors">
                     <X size={12} />
                   </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Break Tracking Card ─────────────────────────── */}
        <div className="xl:col-span-1">
          <Card className={cn(
            "p-4 h-full flex flex-col transition-all duration-500",
            todayStatus?.active_break != null ? "bg-[var(--warning-500)]/10 border-[var(--warning-500)]/30" : "bg-[var(--glass-05)]"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                 <div className="w-8 h-8 rounded-xl bg-[var(--glass-10)] flex items-center justify-center">
                    <Coffee size={16} className={todayStatus?.active_break != null ? "text-[var(--warning-500)]" : "text-[var(--on-glass-dim)]"} />
                 </div>
                 <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Break Tracking</h3>
                    {todayStatus?.attendance && totalBreakMinutes(todayStatus.attendance) > 0 && (
                      <p className="text-[10px] text-[var(--on-glass-muted)] mt-0.5">
                        {totalBreakMinutes(todayStatus.attendance)}m today
                      </p>
                    )}
                 </div>
              </div>
            </div>

            {isCheckedIn ? (
              <div className="flex-1 flex flex-col">
                <div className="flex flex-col gap-2 mb-3">
                  {todayStatus?.active_break != null ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-white/5 border border-[var(--warning-500)]/20">
                         <p className="text-[10px] font-black text-[var(--warning-500)] uppercase tracking-[0.2em] mb-0.5">On Break</p>
                         <p className="text-sm font-black text-white uppercase">{todayStatus.active_break.break_type} Break</p>
                         {todayStatus.active_break.break_start && (
                           <p className="text-[11px] text-[var(--on-glass-muted)] mt-0.5">Since {formatTime(todayStatus.active_break.break_start)}</p>
                         )}
                      </div>
                      <Button className="w-full bg-white text-black hover:bg-white/90" size="sm" icon={<StopCircle size={14} />} loading={breakLoading} onClick={handleEndBreak}>
                        END BREAK
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {(todayStatus?.shift?.breaks?.length ? todayStatus.shift.breaks : [
                        { id: '', name: 'Rest Break', break_minutes: 15 },
                        { id: '', name: 'Meal Break', break_minutes: 60 },
                      ]).map(b => (
                        <button
                          key={b.id || b.name}
                          onClick={() => handleStartBreak(b.name, b.id || undefined)}
                          disabled={breakLoading}
                          className="p-3 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] hover:bg-[var(--glass-15)] hover:border-[var(--primary-600)]/30 transition-all group flex flex-col items-center gap-2"
                        >
                           <PlayCircle size={16} className="text-[var(--on-glass-dim)] group-hover:text-[var(--primary-600)] transition-colors" />
                           <span className="text-[10px] font-black text-white uppercase tracking-widest">{b.name}</span>
                           <span className="text-[9px] font-bold text-[var(--on-glass-muted)] uppercase">{b.break_minutes}m</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-3 border-t border-[var(--glass-border)] overflow-y-auto max-h-28 custom-scrollbar">
                   {todayStatus?.attendance?.break_records && todayStatus.attendance.break_records.length > 0 ? (
                     <div className="space-y-1">
                        {todayStatus.attendance.break_records.map((b, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] px-1">
                             <span className="font-bold text-[var(--on-glass-muted)] uppercase">{b.break_type}</span>
                             <span className="font-mono text-white/50">{formatTime(b.break_start)} {b.break_end && `- ${formatTime(b.break_end)}`}</span>
                          </div>
                        ))}
                     </div>
                   ) : (
                     <p className="text-[10px] text-center font-black text-[var(--on-glass-dim)] uppercase tracking-widest py-3">No breaks logged</p>
                   )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                 <WifiOff size={24} className="text-[var(--on-glass-dim)] mb-3" />
                 <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Check-in required</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Banner: approved leave today ───────────────── */}
      {leaveToday && !myRecord?.check_in_at && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-[var(--primary-600)]/20 bg-[var(--primary-600)]/5 backdrop-blur-xl flex items-center gap-3 slide-in-bottom">
          <Calendar size={16} className="text-[var(--primary-600)] shrink-0" />
          <div>
            <p className="text-xs font-black text-white">Approved Leave Active</p>
            <p className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-widest mt-0.5">
              {leaveToday.leave_type.replace(/_/g, ' ')} &middot; No check-in required
            </p>
          </div>
        </div>
      )}

      {/* ── Pending Requests (Managers) ──────────────────── */}
      {(remoteSessions.length > 0 || teamNotices.length > 0 || overtimeRequests.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
           {remoteSessions.length > 0 && (
              <SectionCard icon={<Home size={14} />} title="Remote Requests" count={remoteSessions.length} accentColor="var(--secondary)">
                 <div className="space-y-2">
                    {remoteSessions.map(s => (
                       <RequestItem key={s.id}
                         name={s.user?.name || ''} avatarUrl={s.user?.avatar_url}
                         primary={s.duration_type.replace(/_/g, ' ')}
                         onApprove={() => handleApproveRemote(s.id)}
                         onReject={() => handleRejectRemote(s.id)}
                         loading={!!remoteActionId}
                       />
                    ))}
                 </div>
              </SectionCard>
           )}
           {overtimeRequests.length > 0 && (
              <SectionCard icon={<Clock size={14} />} title="Overtime Requests" count={overtimeRequests.length} accentColor="var(--primary-600)">
                 <div className="space-y-2">
                    {overtimeRequests.map(r => (
                       <RequestItem key={r.id}
                         name={r.user?.name || ''} avatarUrl={r.user?.avatar_url}
                         primary={`${r.requested_minutes}m · ${r.attendance?.shift?.name || 'Shift'}`}
                         primaryColor="var(--primary-600)"
                         secondary={r.reason}
                         onApprove={() => handleApproveOvertime(r.id)}
                         onReject={() => handleRejectOvertime(r.id)}
                         loading={!!overtimeActionId}
                       />
                    ))}
                 </div>
              </SectionCard>
           )}
           {teamNotices.length > 0 && (
              <SectionCard icon={<AlertTriangle size={14} />} title="Exceptions" count={teamNotices.length} accentColor="var(--warning-500)">
                 <div className="space-y-2">
                    {teamNotices.map(n => {
                       const isEarly = n.reason.startsWith('[Early Departure]');
                       const cleanReason = isEarly ? n.reason.replace('[Early Departure]', '').trim() : n.reason;
                       const nDate = n.date ? format(new Date(n.date), 'MMM d') : 'Today';
                       return (
                         <RequestItem key={n.id}
                           name={n.user?.name || ''}
                           primary={`${nDate} · ${isEarly ? 'Departure' : 'Arrival'} @ ${n.expected_time}`}
                           primaryColor="var(--warning-500)"
                           secondary={cleanReason || undefined}
                           actions={<Button size="sm" variant="ghost" className="shrink-0 text-[10px] px-2 py-1 h-auto" onClick={() => handleAcknowledgeNotice(n.id)}>ACK</Button>}
                         />
                       );
                    })}
                 </div>
              </SectionCard>
           )}
        </div>
      )}

      {/* ── Global Attendance Registry ──────────────────── */}
      {hasPermission('attendance.view_team') && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end gap-3 px-4 py-3 bg-(--glass-05) border-b border-(--glass-border)">
            <DatePicker
              value={selectedDate}
              onChange={v => v && setSelectedDate(v)}
              className="w-44"
            />
            <Dropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Statuses"
              className="w-36"
            />
            <span className="label-xs ml-auto pb-2.5">{filtered.length} records</span>
          </div>

          <Table
            headers={['Employee', 'Status', 'Check In', 'Check Out', 'Hours', 'Method', '']}
            loading={tableLoading}
            emptyState={
              <div className="py-12 text-center">
                 <Clock size={24} className="mx-auto text-[var(--on-glass-dim)] mb-3" />
                 <p className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">No records found</p>
              </div>
            }
          >
            {filtered.map((record) => {
              const user = record.user;
              const cfg  = statusConfig[record.status] ?? statusConfig['in'];
              const cit  = record.check_in_type || record.type;
              return (
                <tr key={record.id} className="hover:bg-[var(--glass-05)] transition-all group">
                  <td className="py-3 px-4">
                    {user ? (
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} imageUrl={user.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{user.name}</p>
                          <p className="text-[10px] text-[var(--on-glass-muted)] truncate">{user.department || '—'}</p>
                        </div>
                      </div>
                    ) : <span className="text-xs text-[var(--on-glass-dim)]">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />
                      {record.is_overridden && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)]" title="Adjusted" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-bold text-white font-mono">
                      {record.check_in_at ? formatTime(record.check_in_at) : '—'}
                    </span>
                    {(record.late_minutes ?? 0) > 0 && (
                      <span className="block text-[10px] font-bold text-[var(--danger-500)] mt-0.5">+{record.late_minutes}m</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-bold text-white/50 font-mono">
                      {record.check_out_at ? formatTime(record.check_out_at) : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {record.hours_worked != null ? (
                      <span className="text-xs font-bold text-[var(--primary-600)]">{formatHours(n(record.hours_worked))}</span>
                    ) : record.check_in_at && !record.check_out_at ? (
                      <LiveDuration checkInAt={record.check_in_at} />
                    ) : (
                      <span className="text-xs text-[var(--on-glass-dim)]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] text-[var(--on-glass-muted)]">{cit ? (typeLabel[cit] || cit) : '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {hasPermission('attendance.override') && (
                      <button
                        onClick={() => openOverride(record)}
                        aria-label="Override attendance record"
                        title="Override"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--primary-600)] hover:bg-[var(--glass-15)] transition-all"
                      >
                        <Edit2 size={13} />
                      </button>
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
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOverrideRecord(null)}>Cancel</Button>
            <Button size="sm" onClick={form.handleSubmit(onOverride)} loading={form.formState.isSubmitting}>Save</Button>
          </>
        }
      >
        {overrideRecord && (
          <div className="space-y-4">
            {overrideRecord.user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <Avatar name={overrideRecord.user.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{overrideRecord.user.name}</p>
                  <p className="text-[11px] text-[var(--on-glass-muted)]">{formatDate(overrideRecord.date)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="check_in_at"
                render={({ field }) => (
                  <DateTimePicker
                    label="Check In"
                    value={field.value ? field.value.replace('T', ' ') : ''}
                    onChange={v => field.onChange(v ? v.replace(' ', 'T') : '')}
                    error={form.formState.errors.check_in_at?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="check_out_at"
                render={({ field }) => (
                  <DateTimePicker
                    label="Check Out"
                    value={field.value ? field.value.replace('T', ' ') : ''}
                    onChange={v => field.onChange(v ? v.replace(' ', 'T') : '')}
                    error={form.formState.errors.check_out_at?.message}
                  />
                )}
              />
            </div>
            <Textarea
              label="Reason"
              required
              placeholder="Explain why you are overriding this record..."
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
          </div>
        )}
      </Modal>

      {/* Reject Overtime Modal */}
      <Modal
        isOpen={!!rejectOvertimeId}
        onClose={() => { setRejectOvertimeId(null); setRejectOvertimeReason(''); }}
        title="Reject Overtime"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setRejectOvertimeId(null); setRejectOvertimeReason(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleConfirmRejectOvertime} loading={!!overtimeActionId}>Reject</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--on-glass-muted)]">Provide a reason — the employee will be notified.</p>
          <Textarea
            label="Rejection Reason"
            placeholder="e.g. Overtime not approved for this period…"
            rows={3}
            value={rejectOvertimeReason}
            onChange={(e) => setRejectOvertimeReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* ── Late Arrival Notice Modal ─────────────────────── */}
      <Modal
        isOpen={lateNoticeModalOpen}
        onClose={() => { setLateNoticeModalOpen(false); lateNoticeForm.reset(); }}
        title="Report Late Arrival"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setLateNoticeModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={lateNoticeForm.handleSubmit(handleSubmitLateNotice)}>Submit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--on-glass-muted)]">
            Your manager will be notified and won&apos;t receive a late alert until your expected arrival time passes.
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
