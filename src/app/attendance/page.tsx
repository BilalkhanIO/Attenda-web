'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, Input, Textarea,
  EmptyState
} from '@/components/ui';
import { attendanceApi, remoteApi, overtimeApi } from '@/lib/api';
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

interface BreakStatus {
  on_break: boolean;
  break_type?: string;
  started_at?: string;
  total_break_minutes?: number;
  breaks?: { break_type: string; started_at: string; ended_at?: string; minutes?: number }[];
  available_breaks?: { id: string; name: string; break_kind?: string; break_minutes: number; allowed_count_per_shift?: number; is_paid?: boolean }[];
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
  const [overtimeLoading, setOvertimeLoading] = useState(false);
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
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [overtimeActionId, setOvertimeActionId] = useState<string | null>(null);

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

  const loadOvertimeRequests = useCallback(async () => {
    if (!hasRole('manager', 'hr_admin', 'super_admin')) return;
    try {
      const { data } = await overtimeApi.getRequests({ status: 'pending' });
      setOvertimeRequests(data.data || []);
    } catch { /* ignore */ }
  }, [hasRole]);

  useEffect(() => {
    loadMyRecord();
    loadBreakStatus();
    loadRemoteSessions();
    loadOvertimeRequests();
    loadTeamNotices();
  }, [loadMyRecord, loadBreakStatus, loadRemoteSessions, loadOvertimeRequests, loadTeamNotices]);

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

  const handleRejectOvertime = async (id: string) => {
    const reason = window.prompt('Rejection reason');
    if (!reason) return;
    setOvertimeActionId(id);
    try {
      await overtimeApi.rejectRequest(id, reason);
      toast.success('Overtime rejected');
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* ── My Attendance Status Card ───────────────────── */}
        <div className="xl:col-span-2">
          <Card className="p-6 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-600)]/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <div className="flex items-start justify-between mb-8 relative z-10">
              <div>
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em] mb-1.5">Employee Status</p>
                <h3 className="text-2xl font-black text-white tracking-tight">My Attendance</h3>
              </div>
              <div className="flex flex-col items-end">
                {myStatusConfig ? (
                  <Badge label={myStatusConfig.label} color={myStatusConfig.color} bg={myStatusConfig.bg} />
                ) : (
                  <Badge label="NOT CHECKED IN" color="var(--on-glass-dim)" bg="#334155" />
                )}
              </div>
            </div>

            {/* Content Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
              {/* Check In */}
              <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                 <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                   <LogIn size={12} className="text-[var(--success-500)]" /> Check In
                 </p>
                 <p className="text-xl font-black text-white font-mono">
                   {myRecord?.check_in_at ? formatTime(myRecord.check_in_at) : '--:--'}
                 </p>
              </div>

              {/* Check Out / Elapsed */}
              <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                 {myRecord?.check_out_at ? (
                   <>
                    <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <LogOut size={12} className="text-[var(--on-glass-dim)]" /> Check Out
                    </p>
                    <p className="text-xl font-black text-white font-mono">{formatTime(myRecord.check_out_at)}</p>
                   </>
                 ) : (
                   <>
                    <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Clock size={12} className="text-[var(--primary-600)]" /> Hours Worked
                    </p>
                    <p className="text-xl font-black text-[var(--primary-600)] font-mono">{elapsed || '00:00'}</p>
                   </>
                 )}
              </div>

              {/* Total Hours */}
              <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                 <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                   <CheckCircle2 size={12} className="text-[var(--secondary)]" /> Total Hours
                 </p>
                 <p className="text-xl font-black text-white">
                   {myRecord?.hours_worked != null ? `${n(myRecord.hours_worked).toFixed(1)}h` : '0.0h'}
                 </p>
              </div>

              {/* Method */}
              <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                 <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                   <Wifi size={12} className="text-[var(--on-glass-dim)]" /> Method
                 </p>
                 <p className="text-sm font-bold text-white/70 truncate">
                   {myRecord ? (typeLabel[myRecord.check_in_type || myRecord.type!] || 'MANUAL') : '---'}
                 </p>
              </div>
            </div>

            {/* Compliance Alerts */}
            {myRecord?.check_in_at && (
              ((myRecord.late_minutes ?? 0) > 0 || (myRecord.early_out_minutes ?? 0) > 0) && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {(myRecord.late_minutes ?? 0) > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 text-[10px] font-black text-[var(--danger-500)] uppercase tracking-widest">
                       <AlertTriangle size={12} /> {myRecord.late_minutes}M Late Arrival
                    </div>
                  )}
                  {(myRecord.early_out_minutes ?? 0) > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 text-[10px] font-black text-[var(--warning-500)] uppercase tracking-widest">
                       <LogOut size={12} /> {myRecord.early_out_minutes}M Early Exit
                    </div>
                  )}
                </div>
              )
            )}

            {/* Main Actions */}
            <div className="flex items-center gap-4 relative z-10 pt-4 border-t border-[var(--glass-border)]">
              {!myRecord?.check_in_at ? (
                <>
                  <Button
                    size="lg"
                    className="px-10"
                    icon={<LogIn size={18} />}
                    loading={checkInLoading}
                    onClick={handleCheckIn}
                  >
                    CHECK IN
                  </Button>
                  {!myLateNotice && (
                    <Button
                      variant="ghost"
                      size="lg"
                      icon={<AlertTriangle size={18} />}
                      onClick={() => setLateNoticeModalOpen(true)}
                    >
                      Report Late
                    </Button>
                  )}
                </>
              ) : isCheckedIn && !isCheckedOut ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="px-10 border-[var(--danger-500)]/30 text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10"
                  icon={<LogOut size={18} />}
                  loading={checkOutLoading}
                  onClick={handleCheckOut}
                >
                  CHECK OUT
                </Button>
              ) : isCheckedOut ? (
                <>
                  <div className="flex items-center gap-3 text-[var(--on-glass-muted)]">
                     <div className="w-8 h-8 rounded-full bg-[var(--success-500)]/20 flex items-center justify-center">
                        <Check size={16} className="text-[var(--success-500)]" />
                     </div>
                     <span className="text-sm font-bold uppercase tracking-widest">Attendance Complete</span>
                  </div>
                  {(myRecord.extra_office_minutes ?? 0) > 0 && (
                    <Button variant="outline" size="sm" icon={<Clock size={14} />} loading={overtimeLoading} onClick={handleRequestOvertime}>
                      Request Overtime
                    </Button>
                  )}
                </>
              ) : null}

              {/* Late notice pending indicator */}
              {myLateNotice && !myRecord?.check_in_at && (
                <div className="flex items-center gap-3 px-4 py-2 bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 rounded-2xl text-[10px] font-black text-[var(--warning-500)] uppercase tracking-widest">
                   <Clock size={12} /> Late notice active: {myLateNotice.expected_time}
                   <button onClick={handleCancelMyNotice} className="ml-2 hover:text-white transition-colors">
                     <X size={14} />
                   </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Break Tracking Card ─────────────────────────── */}
        <div className="xl:col-span-1">
          <Card className={cn(
            "p-6 h-full flex flex-col transition-all duration-500",
            breakStatus?.on_break ? "bg-[var(--warning-500)]/10 border-[var(--warning-500)]/30" : "bg-[var(--glass-05)]"
          )}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-[var(--glass-10)] flex items-center justify-center">
                    <Coffee size={20} className={breakStatus?.on_break ? "text-[var(--warning-500)]" : "text-[var(--on-glass-dim)]"} />
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Break Tracking</h3>
                    {breakStatus?.total_break_minutes != null && (
                      <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest mt-0.5">
                        {breakStatus.total_break_minutes}m total today
                      </p>
                    )}
                 </div>
              </div>
            </div>

            {isCheckedIn ? (
              <div className="flex-1 flex flex-col">
                <div className="flex flex-col gap-3 mb-6">
                  {breakStatus?.on_break ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/5 border border-[var(--warning-500)]/20">
                         <p className="text-[10px] font-black text-[var(--warning-500)] uppercase tracking-[0.2em] mb-1">Status: On Break</p>
                         <p className="text-lg font-black text-white uppercase">{breakStatus.break_type} Break Active</p>
                         {breakStatus.started_at && (
                           <p className="text-xs font-medium text-[var(--on-glass-muted)] mt-1">Started at {formatTime(breakStatus.started_at)}</p>
                         )}
                      </div>
                      <Button className="w-full h-14 bg-white text-black hover:bg-white/90" icon={<StopCircle size={18} />} loading={breakLoading} onClick={handleEndBreak}>
                        END BREAK
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {(breakStatus?.available_breaks?.length ? breakStatus.available_breaks : [
                        { id: '', type: 'rest', name: 'Rest Break', break_minutes: 15, allowed_count_per_shift: 0 },
                        { id: '', type: 'meal', name: 'Meal Break', break_minutes: 60, allowed_count_per_shift: 0 },
                      ] as { id: string; name: string; break_kind?: string; break_minutes: number; allowed_count_per_shift?: number; is_paid?: boolean; type?: string }[]).map(b => (
                        <button
                          key={b.id || b.name}
                          onClick={() => handleStartBreak(b.type ?? b.name, b.id || undefined)}
                          disabled={breakLoading}
                          className="p-5 rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] hover:bg-[var(--glass-15)] hover:border-[var(--primary-600)]/30 transition-all group flex flex-col items-center gap-3"
                        >
                           <PlayCircle size={20} className="text-[var(--on-glass-dim)] group-hover:text-[var(--primary-600)] transition-colors" />
                           <span className="text-[10px] font-black text-white uppercase tracking-widest">{b.name}</span>
                           <span className="text-[9px] font-bold text-[var(--on-glass-muted)] uppercase">{b.break_minutes}m{b.allowed_count_per_shift ? ` x ${b.allowed_count_per_shift}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* History Scroll */}
                <div className="mt-auto pt-4 border-t border-[var(--glass-border)] overflow-y-auto max-h-32 custom-scrollbar">
                   {breakStatus?.breaks && breakStatus.breaks.length > 0 ? (
                     <div className="space-y-2">
                        {breakStatus.breaks.map((b, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] px-2">
                             <span className="font-bold text-[var(--on-glass-muted)] uppercase">{b.break_type}</span>
                             <span className="font-mono text-white/50">{formatTime(b.started_at)} {b.ended_at && `- ${formatTime(b.ended_at)}`}</span>
                          </div>
                        ))}
                     </div>
                   ) : (
                     <p className="text-[10px] text-center font-black text-[var(--on-glass-dim)] uppercase tracking-widest py-4">No activity logged</p>
                   )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                 <WifiOff size={32} className="text-[var(--on-glass-dim)] mb-4" />
                 <p className="text-xs font-black text-[var(--on-glass-dim)] uppercase tracking-widest leading-relaxed">Check-in required for break tracking</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Banner: approved leave today ───────────────── */}
      {leaveToday && !myRecord?.check_in_at && (
        <div className="mb-6 p-5 rounded-[2rem] border border-[var(--primary-600)]/20 bg-[var(--primary-600)]/5 backdrop-blur-xl flex items-center gap-4 slide-in-bottom">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-600)]/20 flex items-center justify-center">
            <Calendar size={20} className="text-[var(--primary-600)]" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">Approved Leave in Progress</p>
            <p className="text-xs font-medium text-[var(--on-glass-muted)] uppercase tracking-widest mt-1">
              {leaveToday.leave_type.replace(/_/g, ' ')} Active &middot; No manual presence required
            </p>
          </div>
        </div>
      )}

      {/* ── Pending Requests (Managers) ──────────────────── */}
      {hasRole('manager', 'hr_admin', 'super_admin') && (remoteSessions.length > 0 || teamNotices.length > 0 || overtimeRequests.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
           {remoteSessions.length > 0 && (
              <Card className="p-6 border-[var(--secondary)]/20 bg-[var(--secondary)]/5">
                 <div className="flex items-center gap-3 mb-6">
                    <Home size={18} className="text-[var(--secondary)]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Remote Work Requests</h3>
                    <span className="ml-auto w-6 h-6 rounded-lg bg-[var(--secondary)]/20 flex items-center justify-center text-[10px] font-black text-[var(--secondary)]">{remoteSessions.length}</span>
                 </div>
                 <div className="space-y-3">
                    {remoteSessions.map(s => (
                       <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--dark-950)]/40 border border-[var(--glass-border)]">
                          <Avatar name={s.user?.name || ''} imageUrl={s.user?.avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-black text-white truncate">{s.user?.name}</p>
                             <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">{s.duration_type.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleApproveRemote(s.id)} disabled={!!remoteActionId} className="w-8 h-8 rounded-lg bg-[var(--success-500)] text-white flex items-center justify-center hover:brightness-110 transition-all"><Check size={14} /></button>
                             <button onClick={() => handleRejectRemote(s.id)} disabled={!!remoteActionId} className="w-8 h-8 rounded-lg bg-[var(--danger-500)] text-white flex items-center justify-center hover:brightness-110 transition-all"><X size={14} /></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </Card>
           )}
           {overtimeRequests.length > 0 && (
              <Card className="p-6 border-[var(--primary-600)]/20 bg-[var(--primary-600)]/5">
                 <div className="flex items-center gap-3 mb-6">
                    <Clock size={18} className="text-[var(--primary-600)]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Overtime Requests</h3>
                    <span className="ml-auto w-6 h-6 rounded-lg bg-[var(--primary-600)]/20 flex items-center justify-center text-[10px] font-black text-[var(--primary-600)]">{overtimeRequests.length}</span>
                 </div>
                 <div className="space-y-3">
                    {overtimeRequests.map(r => (
                       <div key={r.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--dark-950)]/40 border border-[var(--glass-border)]">
                          <Avatar name={r.user?.name || ''} imageUrl={r.user?.avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-black text-white truncate">{r.user?.name}</p>
                             <p className="text-[10px] font-bold text-[var(--primary-600)] uppercase tracking-widest">
                               {r.requested_minutes}m · {r.attendance?.shift?.name || 'Shift'}
                             </p>
                             {r.reason && <p className="text-xs text-[var(--on-glass-muted)] truncate mt-1">{r.reason}</p>}
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleApproveOvertime(r.id)} disabled={!!overtimeActionId} className="w-8 h-8 rounded-lg bg-[var(--success-500)] text-white flex items-center justify-center hover:brightness-110 transition-all"><Check size={14} /></button>
                             <button onClick={() => handleRejectOvertime(r.id)} disabled={!!overtimeActionId} className="w-8 h-8 rounded-lg bg-[var(--danger-500)] text-white flex items-center justify-center hover:brightness-110 transition-all"><X size={14} /></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </Card>
           )}
           {teamNotices.length > 0 && (
              <Card className="p-6 border-[var(--warning-500)]/20 bg-[var(--warning-500)]/5">
                 <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle size={18} className="text-[var(--warning-500)]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Attendance Exceptions</h3>
                    <span className="ml-auto w-6 h-6 rounded-lg bg-[var(--warning-500)]/20 flex items-center justify-center text-[10px] font-black text-[var(--warning-500)]">{teamNotices.length}</span>
                 </div>
                 <div className="space-y-3">
                    {teamNotices.map(n => {
                       const isEarly = n.reason.startsWith('[Early Departure]');
                       const cleanReason = isEarly ? n.reason.replace('[Early Departure]', '').trim() : n.reason;
                       const nDate = (n as any).date ? format(new Date((n as any).date), 'MMM d') : 'Today';
                       return (
                         <div key={n.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--dark-950)]/40 border border-[var(--glass-border)]">
                            <Avatar name={n.user?.name || ''} size="sm" />
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-black text-white truncate">{n.user?.name}</p>
                               <p className="text-[10px] font-bold text-[var(--warning-500)] uppercase tracking-widest">
                                 {nDate} &middot; {isEarly ? 'Departure' : 'Arrival'} @ {n.expected_time}
                               </p>
                               <p className="text-xs text-[var(--on-glass-muted)] truncate mt-1">{cleanReason}</p>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 py-0" onClick={() => handleAcknowledgeNotice(n.id)}>ACKNOWLEDGE</Button>
                         </div>
                       );
                    })}
                 </div>
              </Card>
           )}
        </div>
      )}

      {/* ── Global Attendance Registry ──────────────────── */}
      {hasRole('manager', 'hr_admin', 'super_admin') && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 p-6 bg-[var(--glass-05)] border-b border-[var(--glass-border)]">
            <div className="relative group">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)] group-focus-within:text-[var(--primary-600)] transition-colors" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="pl-9 pr-4 py-2.5 text-[13px] font-bold bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-xl text-white outline-none focus:border-[var(--primary-600)] transition-all cursor-pointer"
              />
            </div>

            <div className="h-8 w-px bg-[var(--glass-border)] hidden sm:block" />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 text-[13px] font-bold bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-xl text-white outline-none focus:border-[var(--primary-600)] appearance-none cursor-pointer pr-10"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
            >
              <option value="" className="bg-[var(--dark-950)]">ALL STATUSES</option>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <option key={key} value={key} className="bg-[var(--dark-950)]">{cfg.label.toUpperCase()}</option>
              ))}
            </select>

            <span className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em] ml-auto">
               {filtered.length} Records Found
            </span>
          </div>

          <Table
            headers={['Employee', 'Status', 'Check In', 'Check Out', 'Hours', 'Method', 'Actions']}
            loading={tableLoading}
            emptyState={
              <div className="py-24 text-center">
                 <Clock size={32} className="mx-auto text-[var(--on-glass-dim)] mb-4" />
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
                  <td className="py-4 px-6">
                    {user ? (
                      <div className="flex items-center gap-4">
                        <Avatar name={user.name} imageUrl={user.avatar_url} size="md" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-black text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{user.name}</p>
                          <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest truncate">{user.department || 'No Department'}</p>
                        </div>
                      </div>
                    ) : <span className="text-xs text-[var(--on-glass-dim)]">—</span>}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />
                      {record.is_overridden && (
                        <div className="w-2 h-2 rounded-full bg-[var(--primary-600)]" title="Manually Adjusted" />
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-black text-white font-mono">
                      {record.check_in_at ? formatTime(record.check_in_at) : '—'}
                    </span>
                    {(record.late_minutes ?? 0) > 0 && (
                      <span className="block text-[10px] font-black text-[var(--danger-500)] uppercase tracking-widest mt-0.5">+{record.late_minutes}M</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-black text-white/50 font-mono">
                      {record.check_out_at ? formatTime(record.check_out_at) : '—'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {record.hours_worked != null ? (
                      <div>
                        <span className="text-[13px] font-black text-[var(--primary-600)]">{formatHours(n(record.hours_worked))}</span>
                      </div>
                    ) : record.check_in_at && !record.check_out_at ? (
                      <LiveDuration checkInAt={record.check_in_at} />
                    ) : (
                      <span className="text-sm text-[var(--on-glass-dim)]">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">{cit ? (typeLabel[cit] || cit) : '—'}</span>
                  </td>
                  <td className="py-4 px-6">
                    {hasRole('manager', 'hr_admin', 'super_admin') && (
                      <button
                        onClick={() => openOverride(record)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--primary-600)] hover:bg-[var(--glass-15)] transition-all"
                      >
                        <Edit2 size={16} />
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
          <div className="space-y-6">
            {overrideRecord.user && (
              <div className="flex items-center gap-4 p-5 rounded-3xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <Avatar name={overrideRecord.user.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-white tracking-tight">{overrideRecord.user.name}</p>
                  <p className="text-xs font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">{formatDate(overrideRecord.date)}</p>
                </div>
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
          </div>
        )}
      </Modal>

      {/* ── Late Arrival Notice Modal ─────────────────────── */}
      <Modal
        isOpen={lateNoticeModalOpen}
        onClose={() => { setLateNoticeModalOpen(false); lateNoticeForm.reset(); }}
        title="Report Late Arrival"
        footer={
          <div className="flex gap-4 justify-end">
            <Button variant="ghost" onClick={() => setLateNoticeModalOpen(false)}>Cancel</Button>
            <Button onClick={lateNoticeForm.handleSubmit(handleSubmitLateNotice)}>Submit Notice</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed">
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
